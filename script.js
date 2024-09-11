const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true,
});

const dbg = {};

// https://lospec.com/palette-list/snap-12
const colors = [
    "#ffffff", "#ffd588", "#72cb48", "#b2d4d4",
    "#c45544", "#cc9155", "#0a8a71", "#66aaf7",
    "#7f3355", "#000000", "#114c77", "#8891aa",
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
    pos: { x: 1, y: 0 },
    vel: Vec.zero(),
    rot: 0,
    damping: .8,
    gravity: 10,
    physics: {
        bounce: 0,
        friction: 0,
    },
    jump: 30,
    shapes: [
        {
            x: [-.3, 0, .3],
            y: [0, -.5, 0],
            color: 2,
            fill: true,
        }, {
            x: [-.12],
            y: [-.55],
            w: .2,
            color: 0,
        }, {
            x: [.12],
            y: [-.55],
            w: .2,
            color: 0,
        }, {
            x: [-.1],
            y: [-.55],
            w: .1,
            color: 9,
        }, {
            x: [.1],
            y: [-.55],
            w: .1,
            color: 9,
        }
    ],
    shadow: 0.25,
};

const flag = {
    pos: { x: 8, y: 0 },
    stick: true,
    age: 0,
    shapes: [
        {
            x: [0, 0],
            y: [0, -.4],
            color: 5,
        }, {
            x: [0, 0, .4],
            y: [-.4, -.7, -.4],
            color: 4,
            fill: true,
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
    ctx.fillStyle = colors[10];
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // World coordinates
    ctx.save();
    ctx.translate(.5, .5);
    ctx.scale(camera.size ** -1, camera.size ** -1);
    ctx.translate(-camera.pos.x, -camera.pos.y);

    // Ground
    ctx.save()
    ctx.beginPath();
    const steps = canvas.width >> 3;
    for (let i = 0; i <= steps; i++) {
        const x = i / steps;
        const p = screenToWorld({ x, y: 0 });
        ctx.lineTo(p.x, ground(p.x));
    }
    ctx.fillStyle = colors[6];
    const bottomRight = screenToWorld({ x: 1, y: 1 });
    ctx.lineTo(bottomRight.x, bottomRight.y);
    const bottomLeft = screenToWorld({ x: 0, y: 1 });
    ctx.lineTo(bottomLeft.x, bottomLeft.y);
    ctx.fill();

    ctx.clip(); // Ground clip

    // Shadows
    for (const e of entities.filter(e => e.shadow)) {
        ctx.save();
        const y = ground(e.pos.x);
        const d = y - e.pos.y;
        const r = .5 + Math.exp(.3 * d);
        ctx.beginPath();
        ctx.ellipse(e.pos.x, y + .1, e.shadow * r, e.shadow * r / 3, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#000";
        ctx.globalAlpha = .2 * Math.exp(-d);
        ctx.fill();
        ctx.restore();
    }

    ctx.restore(); // Ground clip

    // Shapes
    for (const e of entities.filter(e => e.shapes)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot);
        ctx.lineJoin = ctx.lineCap = "round";
        for (const shape of e.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape.x[0], shape.y[0]);
            for (let i = 1; i < shape.x.length - 1; i++) {
                ctx.lineTo(shape.x[i], shape.y[i]);
            }
            ctx.lineTo(shape.x[shape.x.length - 1], shape.y[shape.y.length - 1]);
            ctx.strokeStyle = ctx.fillStyle = colors[shape.color];
            ctx.lineWidth = shape.w ?? .15;
            if (shape.fill) {
                ctx.closePath();
                ctx.fill();
            }
            ctx.stroke();
        }
        ctx.restore();
    }

    // Particles
    for (const e of entities.filter(e => e.particle)) {
        ctx.save();
        ctx.fillStyle = colors[e.particle.color];
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

    ctx.restore(); // World coordinates

    // Drag trajectory
    const drag = Vec.subtract(input.dragEnd, input.dragStart);
    if (player.grounded && Vec.length(drag) > .01) {
        const dt = .02 / Vec.length(drag);
        let trajectory = [];
        let { pos } = player;
        let vel = Vec.add(player.vel, Vec.scale(drag, player.jump));
        for (let i = 0; i < 10; i++) {
            pos = Vec.add(pos, Vec.scale(vel, dt));
            vel = Vec.scale(Vec.add(vel, { x: 0, y: player.gravity * dt }), player.damping ** dt);
            trajectory.push(pos);
        }
        ctx.save();
        ctx.fillStyle = colors[0];
        for (const t of trajectory) {
            const dist = Vec.distance(player.pos, t);
            const s = worldToScreen(Vec.add(t, { x: 0, y: -.2 }));
            const r = 1 - Math.exp(-dist);
            ctx.beginPath();
            ctx.arc(s.x, s.y, .01 * r, 0, 2 * Math.PI);
            ctx.globalAlpha = Math.max(0, -.16 * dist * (dist - 5));
            ctx.fill();
        }
        ctx.restore();
    }

    ctx.restore(); // Screen coordinates

    requestAnimationFrame(draw);
};

let last = performance.now();
const update = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    // Check if player has stopped on ground
    player.grounded = player.pos.y >= ground(player.pos.x)
        && Vec.length(player.vel) < .1;

    // Win condition
    if (Vec.distance(player.pos, flag.pos) < .5) {
        const pos = Vec.add(flag.pos, { x: 0, y: -.2 });
        for (let i = 0; i < 50; i++) {
            const vel = Vec.scale(
                Vec.rotate(
                    { x: 0, y: -1 },
                    1.5 * (Math.random() - .5)),
                5 * (Math.random() + .2));
            entities.push({
                pos,
                vel,
                gravity: 2,
                damping: .3,
                physics: {
                    bounce: 0,
                    friction: 1e-5,
                },
                age: 0,
                ttl: 2 * (Math.random() + .2),
                particle: {
                    size: .08,
                    color: 4,
                },
            });
        }
        flag.pos = Vec.add(flag.pos, { x: 10, y: 0 });
    }

    // Flag animation
    flag.rot = .1 * Math.sin(flag.age);

    // Detect drag
    if (!input.primary) {
        const drag = Vec.subtract(input.dragEnd, input.dragStart);
        if (player.grounded && Vec.length(drag) > .02) {
            player.vel = Vec.add(player.vel, Vec.scale(drag, player.jump));
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
    // Velocity
    for (const e of entities.filter(e => e.vel)) {
        e.pos = Vec.add(e.pos, Vec.scale(e.vel, dt));
    }
    // Ground collision
    for (const e of entities.filter(e => e.physics)) {
        const x = .01;
        const y = ground(e.pos.x + x) - ground(e.pos.x);
        const g = Vec.normalize({ x, y });
        const normal = { x: -g.y, y: g.x };
        if (e.pos.y > ground(e.pos.x)) {
            e.pos.y = ground(e.pos.x);
            const ref = Vec.add(e.vel, Vec.scale(normal, -2 * Vec.dot(e.vel, normal)));
            const a = Vec.angle(g);
            const rot = Vec.rotate(ref, -a);
            e.vel = Vec.rotate({ x: e.physics.friction ** dt * rot.x, y: e.physics.bounce * rot.y }, a);
        }
    }
    // Damping
    for (const e of entities.filter(e => e.damping)) {
        e.vel = Vec.scale(e.vel, e.damping ** dt);
    }
    // Gravity
    for (const e of entities.filter(e => e.gravity)) {
        e.vel = Vec.add(e.vel, { x: 0, y: e.gravity * dt });
    }

    entities = entities.filter(e => !e.kill);

    // Debugging
    dbg.dt = dt;
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
