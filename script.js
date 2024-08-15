const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", {
    alpha: false,
    desynchronized: true
});

const dbg = {};

const player = {
    pos: { x: 0.1, y: 0.5 },
    vel: Vec.zero(),
    damping: 0.3,
    gravity: 1,
    bounce: 1,
};

const entities = [player];

const ground = (x) => 0.8 - 0.05 * Math.sin(10 * x) + 0.05 * Math.sin(2 * x);

const draw = () => {
    update();

    canvas.width = canvas.height = 600;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas.width, canvas.height);

    // Debug overlay
    if (location.hash === "#debug") {
        ctx.save();
        ctx.lineWidth = 0.01;
        ctx.globalAlpha = 0.3;
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
            const end = Vec.add(entity.pos, entity.vel);
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
            pre.style.color = "#fff";
            pre.style.background = "#0008";
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
        e.vel = Vec.scale(e.vel, Math.pow(e.damping, dt));
    }
    // Bounce off ground
    for (const e of entities.filter(e => e.bounce)) {
        if (e.pos.y > ground(e.pos.x)) {
            e.pos.y = ground(e.pos.x);
            e.vel.y *= -e.bounce;
        }
    }

    dbg.dt = dt;
    dbg.player = player;
};

draw();
