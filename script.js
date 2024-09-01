const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
});

const dbg = {};

const player = {
    pos: { x: 0.1, y: 0.5 },
    vel: Vec.zero(),
    rot: 0,
    damping: 0.3,
    gravity: 0.8,
    collision: {
        bounce: 0,
        friction: 1e-20,
    },
    jump: 5,
    shapes: [
        {
            x: [-.3, 0, .3],
            y: [0, -.5, 0],
            color: "green",
        },
    ],
    shadow: 0.25,
};

const flag = {
    pos: { x: 0.9, y: 0 },
    stick: true,
    age: 0,
    shapes: [
        {
            x: [-.05, -.05, .05, .05],
            y: [0, -.2, -.2, 0],
            color: "brown",
        }, {
            x: [-.05, -.05, .4],
            y: [-.2, -.6, -.2],
            color: "red",
        }
    ],
    shadow: 0.1,
};

let entities = [flag, player];
const ground = (x) => 0.8 - 0.05 * Math.sin(10 * x) + 0.05 * Math.sin(2 * x);

const input = {
    primary: false,
    dragStart: Vec.zero(),
    dragEnd: Vec.zero(),
};

const draw = () => {
    update();

    canvas.width = canvas.height = 512;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas.width, canvas.height);

    // Ground
    {
        ctx.beginPath();
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const x = i / steps;
            ctx.lineTo(x, ground(x));
        }
        ctx.lineWidth = 0.04;
        ctx.strokeStyle = "#8b9bb4";
        ctx.stroke();
        ctx.lineTo(1, 1);
        ctx.lineTo(0, 1);
        ctx.fillStyle = "#c0cbdc";
        ctx.fill();
    }

    // Shadows
    for (const e of entities.filter(e => e.shadow)) {
        ctx.save();
        const y = ground(e.pos.x);
        const d = y - e.pos.y;
        const r = (0.5 + Math.exp(d)) * .1;
        ctx.beginPath();
        ctx.ellipse(e.pos.x, y, e.shadow * r, e.shadow * r / 3, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#000";
        ctx.globalAlpha = 0.2 * Math.exp(-2 * d);
        ctx.fill();
        ctx.restore();
    }

    // Drag trajectory
    {
        ctx.save();
        ctx.beginPath();
        let drag = Vec.subtract(input.dragEnd, input.dragStart);
        const len = Vec.length(drag);
        const pos = Vec.add(player.pos, { x: 0, y: -.02 });
        const end = Vec.add(pos, drag);
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(end.x, end.y);
        ctx.lineWidth = 0.05 * (1 - Math.exp(-5 * len));
        ctx.globalAlpha = 0.5 * Math.exp(-3 * len);
        ctx.strokeStyle = "#000";
        ctx.setLineDash([0.01, 0.01]);
        ctx.stroke();
        ctx.restore();
    }

    // Shapes
    for (const e of entities.filter(e => e.shapes)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot);
        ctx.scale(.1, .1);
        for (const shape of e.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape.x[0], shape.y[0]);
            for (let i = 1; i < shape.x.length; i++) {
                ctx.lineTo(shape.x[i], shape.y[i]);
            }
            ctx.closePath();
            ctx.strokeStyle = ctx.fillStyle = shape.color;
            ctx.lineJoin = ctx.lineCap = "round";
            ctx.lineWidth = 0.1;
            ctx.stroke();
            ctx.fill();
        }
        ctx.restore();
    }

    // Particles
    for (const e of entities.filter(e => e.particle)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot);
        const s = e.particle.size;
        ctx.fillStyle = e.particle.color;
        ctx.globalAlpha = 1 - (e.age / e.ttl) ** 4;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
    }

    // Debug overlay
    if (location.hash === "#debug") {
        ctx.save();
        ctx.lineWidth = 0.005;
        ctx.globalAlpha = 0.5;
        // Drag
        ctx.beginPath();
        ctx.moveTo(input.dragStart.x, input.dragStart.y);
        ctx.lineTo(input.dragEnd.x, input.dragEnd.y);
        ctx.stroke();
        // Ground
        ctx.beginPath();
        const steps = 100;
        for (let i = 0; i <= steps; i++) {
            const x = i / steps;
            ctx.lineTo(x, ground(x));
        }
        ctx.strokeStyle = "#00f";
        ctx.stroke();
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
            const end = Vec.add(entity.pos, Vec.scale(entity.vel, 0.1));
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
    if (grounded && Vec.distance(player.pos, flag.pos) < 0.05) {
        for (let i = 0; i < 100; i++) {
            const vel = Vec.scale(
                Vec.rotate(
                    { x: 0, y: -1 },
                    2 * (Math.random() - 0.5)),
                Math.random() + 0.2);
            const color = ["#f77622", "#feae34", "#fee761"][Math.floor(Math.random() * 3)];
            entities.push({
                pos: flag.pos,
                vel,
                gravity: 0.5,
                damping: 0.1,
                collision: {
                    bounce: 0.8,
                    friction: 1e-5,
                },
                age: 0,
                ttl: Math.random() + 1,
                particle: {
                    size: 0.015,
                    color,
                },
            });
        }
        flag.pos = Vec.add(flag.pos, { x: 10, y: 0 });
    }

    // Flag animation
    flag.rot = 0.1 * Math.sin(flag.age);

    // Detect drag
    if (!input.primary) {
        const drag = Vec.subtract(input.dragStart, input.dragEnd);
        if (grounded && Vec.length(drag) > 0.02) {
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

    dbg.dt = dt;
    dbg.input = input;
};

const getRelativeCoords = (e) => ({ x: e.offsetX / canvas.width, y: e.offsetY / canvas.height });

canvas.addEventListener("mousedown", (e) => {
    input.primary = true;
    input.dragStart = input.dragEnd = getRelativeCoords(e);
});
canvas.addEventListener("mousemove", (e) => {
    if (input.primary) {
        input.dragEnd = getRelativeCoords(e);
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
