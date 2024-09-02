const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
});

const dbg = {};

// https://lospec.com/palette-list/ammo-8
const colors = [
    "#040c06", "#112318", "#1e3a29", "#305d42",
    "#4d8061", "#89a257", "#bedc7f", "#eeffcc",
];

const camera = {
    pos: { x: 5, y: -2 },
    vel: Vec.zero(),
    size: 10,
};
const screenToWorld = (pos) => Vec.add(
    Vec.scale(Vec.subtract(pos, { x: .5, y: .5 }), camera.size),
    camera.pos);
const worldToScreen = (pos) => Vec.add(
    Vec.scale(Vec.subtract(pos, camera.pos), camera.size ** -1),
    { x: .5, y: .5 });

const player = {
    pos: { x: 1, y: 5 },
    vel: Vec.zero(),
    rot: 0,
    damping: .2,
    gravity: 8,
    collision: {
        bounce: 0,
        friction: 1e-20,
    },
    jump: 30,
    shapes: [
        {
            x: [-.3, 0, .3],
            y: [0, -.5, 0],
            color: colors[5],
        },
    ],
    shadow: 0.25,
};

const flag = {
    pos: { x: 8, y: 0 },
    stick: true,
    age: 0,
    shapes: [
        {
            x: [-.05, -.05, .05, .05],
            y: [0, -.4, -.4, 0],
            color: colors[5],
        }, {
            x: [-.05, -.05, .4],
            y: [-.4, -.8, -.4],
            color: colors[6],
        }
    ],
    shadow: 0.1,
};

let entities = [flag, player];

const ground = (x) => 0.8 - 0.5 * Math.sin(x) + 0.5 * Math.sin(0.2 * x);

const input = {
    primary: false,
    dragStart: Vec.zero(),
    dragEnd: Vec.zero(),
};

const draw = () => {
    update();

    canvas.width = canvas.height = 512;
    ctx.imageSmoothingEnabled = false;

    // Screen coordinates
    ctx.save();
    ctx.scale(canvas.width, canvas.width);
    ctx.fillStyle = colors[2];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World coordinates
    ctx.save();
    ctx.translate(.5, .5);
    ctx.scale(camera.size ** -1, camera.size ** -1);
    ctx.translate(-camera.pos.x, -camera.pos.y);

    // Ground
    {
        ctx.beginPath();
        const steps = canvas.width >> 3;
        for (let i = 0; i <= steps; i++) {
            const x = i / steps;
            const p = screenToWorld({ x, y: 0 });
            ctx.lineTo(p.x, ground(p.x));
        }
        ctx.lineWidth = .2;
        ctx.strokeStyle = ctx.fillStyle = colors[4];
        ctx.stroke();
        const bottomRight = screenToWorld({ x: 1, y: 1 });
        ctx.lineTo(bottomRight.x, bottomRight.y);
        const bottomLeft = screenToWorld({ x: 0, y: 1 });
        ctx.lineTo(bottomLeft.x, bottomLeft.y);
        ctx.fill();
    }

    // Shadows
    for (const e of entities.filter(e => e.shadow)) {
        ctx.save();
        const y = ground(e.pos.x);
        const d = y - e.pos.y;
        const r = .5 + Math.exp(d);
        ctx.beginPath();
        ctx.ellipse(e.pos.x, y + .1, e.shadow * r, e.shadow * r / 3, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#000";
        ctx.globalAlpha = .2 * Math.exp(-2 * d);
        ctx.fill();
        ctx.restore();
    }

    // Shapes
    for (const e of entities.filter(e => e.shapes)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot);
        for (const shape of e.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape.x[0], shape.y[0]);
            for (let i = 1; i < shape.x.length; i++) {
                ctx.lineTo(shape.x[i], shape.y[i]);
            }
            ctx.closePath();
            ctx.strokeStyle = ctx.fillStyle = shape.color;
            ctx.lineJoin = ctx.lineCap = "round";
            ctx.lineWidth = .1;
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    // Particles
    for (const e of entities.filter(e => e.particle)) {
        ctx.save();
        ctx.fillStyle = e.particle.color;
        ctx.globalAlpha = 1 - (e.age / e.ttl) ** 4;
        ctx.beginPath();
        ctx.arc(e.pos.x, e.pos.y, e.particle.size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.restore();
    }

    // Debug overlay
    if (location.hash === "#debug") {
        ctx.save();
        ctx.lineWidth = .05;
        ctx.globalAlpha = .5;
        // Origin
        for (let entity of entities.filter(e => e.pos)) {
            ctx.fillStyle = "#f00";
            ctx.fillRect(
                entity.pos.x - ctx.lineWidth,
                entity.pos.y - ctx.lineWidth,
                2 * ctx.lineWidth,
                2 * ctx.lineWidth);
        }
        // Velocity vector
        for (let entity of entities.filter(e => e.vel)) {
            const end = Vec.add(entity.pos, Vec.scale(entity.vel, .1));
            ctx.beginPath();
            ctx.moveTo(entity.pos.x, entity.pos.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = "#0f0";
            ctx.stroke();
        }
        ctx.restore();
        // Debug object
        let pre = document.getElementById("dbg");
        if (pre == null) {
            pre = document.createElement("pre");
            pre.id = "dbg";
            pre.style.position = "absolute";
            pre.style.pointerEvents = "none";
            pre.style.color = "white";
            pre.style.textShadow = "1px 1px black";
            document.body.prepend(pre);
        }
        pre.innerText = JSON.stringify(dbg, (k, v) => v.toFixed == null ? v : Number(v.toFixed(3)), 2);
    }

    // World coordinates
    ctx.restore();

    // Drag trajectory
    {
        const drag = Vec.subtract(input.dragEnd, input.dragStart);
        const len = Vec.length(drag);
        if (len > .01) {
            ctx.save();
            // TODO: Begin line with a radius away from player
            const pos = worldToScreen(Vec.add(player.pos, { x: 0, y: -.2 }));
            const end = Vec.add(pos, drag);
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(end.x, end.y);
            ctx.lineWidth = .05 * (1 - Math.exp(-5 * len));
            ctx.globalAlpha = .5 * Math.exp(-3 * len);
            ctx.strokeStyle = colors[7];
            ctx.lineJoin = ctx.lineCap = "round";
            ctx.setLineDash([0, 1.5 * ctx.lineWidth]);
            ctx.stroke();
            ctx.restore();
        }
    }

    // Screen coordinates
    ctx.restore();

    requestAnimationFrame(draw);
};

let last = performance.now();
const update = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    const grounded = player.pos.y >= ground(player.pos.x)
        && Vec.length(player.vel) < 1e-2;

    // Win condition
    if (grounded && Vec.distance(player.pos, flag.pos) < .2) {
        for (let i = 0; i < 50; i++) {
            const vel = Vec.scale(
                Vec.rotate(
                    { x: 0, y: -1 },
                    1.5 * (Math.random() - .5)),
                5 * (Math.random() + .2));
            entities.push({
                pos: flag.pos,
                vel,
                gravity: 2,
                damping: .3,
                collision: {
                    bounce: 0,
                    friction: 1e-5,
                },
                age: 0,
                ttl: 2 * (Math.random() + .2),
                particle: {
                    size: .08,
                    color: colors[6],
                },
            });
        }
        flag.pos = Vec.add(flag.pos, { x: 10, y: 0 });
    }

    // Flag animation
    flag.rot = .1 * Math.sin(flag.age);

    // Detect drag
    if (!input.primary) {
        const drag = Vec.subtract(input.dragStart, input.dragEnd);
        if (grounded && Vec.length(drag) > .02) {
            player.vel = Vec.add(player.vel, Vec.scale(drag, -player.jump));
        }
        input.dragStart = input.dragEnd = Vec.zero();
    }

    // Age
    for (const e of entities.filter(e => e.age != null)) {
        e.age += dt;
        if (e.ttl && e.age > e.ttl) {
            e.kill = true;
        }
    }
    // Stick
    for (const e of entities.filter(e => e.stick)) {
        e.pos.y = ground(e.pos.x);
    }
    // Gravity
    for (const e of entities.filter(e => e.gravity)) {
        e.vel = Vec.add(e.vel, { x: 0, y: e.gravity * dt });
    }
    // Velocity
    for (const e of entities.filter(e => e.vel)) {
        e.pos = Vec.add(e.pos, Vec.scale(e.vel, dt));
    }
    // Damping
    for (const e of entities.filter(e => e.damping)) {
        e.vel = Vec.scale(e.vel, e.damping ** dt);
    }
    // Ground collision
    for (const e of entities.filter(e => e.collision)) {
        const g = ground(e.pos.x);
        if (e.pos.y > g) {
            e.pos.y = g;
            e.vel.y *= -e.collision.bounce;
        }
        if (Math.abs(e.pos.y - g) < 1e-3) {
            e.vel.x *= e.collision.friction ** dt;
        }
    }

    entities = entities.filter(e => !e.kill);

    // Debugging
    dbg.dt = dt;
    dbg.camera = camera;
    dbg.input = input;
};

const getScreenCoords = (e) => ({
    x: e.offsetX / canvas.width,
    y: e.offsetY / canvas.height
});
canvas.addEventListener("mousedown", (e) => {
    input.primary = true;
    input.dragStart = input.dragEnd = getScreenCoords(e);
});
canvas.addEventListener("mousemove", (e) => {
    if (input.primary) {
        input.dragEnd = getScreenCoords(e);
    }
});
canvas.addEventListener("mouseup", (e) => {
    input.primary = false;
});
canvas.addEventListener("mouseleave", () => {
    input.primary = false;
    input.dragStart = input.dragEnd;
});

draw();
