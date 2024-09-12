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

// Seeded random number generator
const seed = dbg.seed = Date.now();
const seededRandom = (s) => {
    const random = (from = 0, to = 1) => {
        const value = (2 ** 31 - 1 & (s = Math.imul(48271, s + seed))) / 2 ** 31;
        return from + value * (to - from);
    };
    for (let i = 0; i < 20; i++) {
        random();
    }
    return random;
};

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

const playerTriangle = [
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
];

const playerCircle = [
    {
        x: [0],
        y: [-.25],
        w: .7,
        color: 2,
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
];

const player = {
    pos: { x: 1.5, y: 0 },
    vel: Vec.zero(),
    rot: 0,
    age: 0,
    damping: .8,
    gravity: 10,
    physics: {
        bounce: 0,
        friction: 0,
    },
    jump: 20,
    shapes: playerTriangle,
    shadow: .25,
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
    shadow: .1,
};

const cloud = {
    pos: { x: 6, y: -3 },
    shapes: [
        {
            x: [-1.5],
            y: [-1],
            w: 2,
            color: 11,
        }, {
            x: [.15],
            y: [-1.75],
            w: 2,
            color: 11,
        }, {
            x: [1.5],
            y: [-1],
            w: 2,
            color: 11,
        }, {
            x: [-1.5, 1.5],
            y: [-.5, -.5],
            w: 1,
            color: 11,
        },
    ],
};

const star = {
    star: { x: 5, y: 0 },
    pos: Vec.zero(),
    age: 0,
    shapes: [
        {
            x: [0, -.07, -.26, -.12, -.16, 0, .16, .12, .26, .07],
            y: [-.5, -.32, -.3, -.18, 0, -.09, 0, -.18, -.3, -.32],
            w: .1,
            color: 1,
            fill: true,
        }
    ],
    shadow: .15,
};

let entities = [flag, player, cloud, star];

const ground = (x) => .8 - .9 * Math.sin(x) - .8 * Math.sin(.2 * x);

const input = {
    paused: false,
    primary: false,
    dragStart: Vec.zero(),
    dragEnd: Vec.zero(),
};

const draw = () => {
    update();

    // Screen coordinates
    ctx.save();
    ctx.scale(canvas.width, canvas.width);

    // Sky
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

    // Drag direction
    const drag = Vec.limit(Vec.subtract(input.dragEnd, input.dragStart), .8);
    const showDrag = player.grounded && Vec.length(drag) > .01;
    if (showDrag) {
        ctx.save();
        ctx.translate(player.pos.x, player.pos.y - .2);
        ctx.rotate(Vec.angle(drag));
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(3 * Vec.length(drag) + .2, 0);
        ctx.strokeStyle = colors[0];
        ctx.lineWidth = .25;
        ctx.lineCap = "round";
        ctx.stroke();
        ctx.restore();
    }

    // Dive streaks
    if (player.diving) {
        const streaks = 5;
        const rand = seededRandom(Math.round(20 * player.age));
        for (let i = 0; i < streaks; i++) {
            ctx.save();
            ctx.translate(.5 * (rand() - .5), .5 * (rand() - .5));
            ctx.beginPath();
            const start = Vec.add(
                Vec.add(player.pos, Vec.scale(Vec.normalize(player.vel), -.3)),
                { x: 0, y: -.3 });
            const end = Vec.subtract(start, Vec.scale(Vec.normalize(player.vel), .1 + .05 * Vec.length(player.vel)));
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.strokeStyle = colors[0];
            ctx.lineCap = "round";
            ctx.lineWidth = .1;
            ctx.globalAlpha = (i + 1) / streaks;
            ctx.stroke();
            ctx.restore();
        }
    }

    // Shapes
    for (const e of entities.filter(e => e.shapes)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot ?? 0);
        ctx.lineJoin = ctx.lineCap = "round";
        for (const shape of e.shapes) {
            ctx.beginPath();
            ctx.moveTo(shape.x[0], shape.y[0]);
            for (let i = 1; i < shape.x.length - 1; i++) {
                ctx.lineTo(shape.x[i], shape.y[i]);
            }
            ctx.lineTo(shape.x[shape.x.length - 1], shape.y[shape.y.length - 1]);
            ctx.fillStyle = ctx.strokeStyle = colors[shape.color];
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

    // Drag trajectory
    if (showDrag) {
        ctx.save();
        ctx.fillStyle = colors[0];
        let { pos } = player;
        let vel = Vec.scale(drag, player.jump);
        const dt = .5 / Vec.length(vel);
        let dist = .1;
        for (let i = 0; i < 10; i++) {
            pos = Vec.add(pos, Vec.scale(vel, dt));
            vel = Vec.scale(Vec.add(vel, { x: 0, y: player.gravity * dt }), player.damping ** dt);
            dist += Vec.length(vel) * dt;
            const r = 1 - Math.exp(-dist);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y - .2, .1 * r, 0, 2 * Math.PI);
            ctx.globalAlpha = Math.max(0, -.16 * dist * (dist - 5));
            ctx.fill();
        }
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
            document.body.append(pre);
        }
        pre.innerText = JSON.stringify(dbg, (k, v) => v.toFixed == null ? v : Number(v.toFixed(3)), 2);
    }

    ctx.restore(); // World coordinates
    ctx.restore(); // Screen coordinates

    requestAnimationFrame(draw);
};

let last = performance.now();
const update = () => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;

    if (input.paused) {
        return;
    }

    // Check if player has stopped on ground
    player.grounded = player.pos.y >= ground(player.pos.x)
        && Vec.length(player.vel) * dt < .01;

    // Detect dive
    player.diving = !player.grounded && input.primary;
    player.gravity = player.diving ? 30 : 10;
    player.physics.bounce = player.diving ? .9 : 0;
    player.shapes = player.diving ? playerCircle : playerTriangle;

    // Detect drag
    if (!input.primary) {
        const drag = Vec.subtract(input.dragEnd, input.dragStart);
        if (player.grounded && Vec.length(drag) > .02) {
            player.vel = Vec.add(player.vel, Vec.scale(drag, player.jump));
        }
        input.dragStart = input.dragEnd = Vec.zero();
    }

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
    flag.rot = .1 * Math.sin(1.5 * flag.age);

    // Star animation
    for (const e of entities.filter(e => e.star)) {
        e.pos = Vec.add(e.star, { x: 0, y: .05 * Math.sin(2 * e.age) });
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
    x: e.pageX / canvas.width,
    y: e.pageY / canvas.height
});
document.addEventListener("pointerdown", (e) => {
    input.primary = true;
    input.dragStart = input.dragEnd = getScreenCoords(e);
});
document.addEventListener("pointermove", (e) => {
    if (input.primary) {
        input.dragEnd = getScreenCoords(e);
    }
});
document.addEventListener("pointerup", () => {
    input.primary = false
});
document.addEventListener("pointercancel", () => {
    input.primary = false;
    input.dragEnd = input.dragStart;
});
document.addEventListener("blur", () => input.paused = true);
document.addEventListener("focus", () => input.paused = false);

// Canvas resizing
const resize = () => {
    const unit = 32;
    const size = Math.min(Math.floor(Math.min(window.innerWidth, window.innerHeight) / unit), 24);
    canvas.width = canvas.height = size * unit;
    canvas.style.left = `${(window.innerWidth - canvas.width) / 2}px`;
    canvas.style.top = `${(window.innerHeight - canvas.height) / 2}px`;
};
window.addEventListener("resize", resize);

resize();
draw();
