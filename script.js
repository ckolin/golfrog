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
    jump: 10,
    sprite: {
        img: "frog",
    },
    shadow: 0.03,
};

const flag = {
    pos: { x: 0.9, y: 0.825 },
    sprite: {
        img: "flag",
    },
    shadow: 0.02,
};

const entities = [player, flag];

const ground = (x) => 0.8 - 0.05 * Math.sin(10 * x) + 0.05 * Math.sin(2 * x);

const input = {
    primary: false,
    dragStart: Vec.zero(),
    dragEnd: Vec.zero(),
};

const draw = () => {
    update();

    canvas.width = canvas.height = 600;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(canvas.width, canvas.height);

    // Shadow
    for (const e of entities.filter(e => e.shadow)) {
        ctx.save();
        const y = ground(e.pos.x);
        const d = y - e.pos.y;
        const r = 0.5 + Math.exp(d);
        ctx.beginPath();
        ctx.ellipse(e.pos.x, y + 0.05, e.shadow * r, e.shadow * r / 3, 0, 0, 2 * Math.PI);
        ctx.fillStyle = "#000";
        ctx.globalAlpha = 0.25 * Math.exp(-2 * d);
        ctx.fill();
        ctx.restore();
    }

    // Sprite
    for (const e of entities.filter(e => e.sprite)) {
        ctx.save();
        ctx.translate(e.pos.x, e.pos.y);
        ctx.rotate(e.rot);
        const img = document.getElementById(e.sprite.img);
        let frame = 0;
        let frameWidth = img.naturalWidth;
        if (e.sprite.animation) {
            frame = Math.floor(e.age / e.sprite.animation.delay) % e.sprite.animation.frames;
            frameWidth = img.naturalWidth / e.sprite.animation.frames;
        }
        const size = Vec.scale({ x: 1, y: 1 }, e.sprite.scale ?? 0.1);
        ctx.translate(-size.x / 2, -size.y / 2); // Center image
        ctx.drawImage(img, frameWidth * frame, 0, frameWidth, img.naturalHeight, 0, 0, size.x, size.y);
        ctx.restore();
    }

    // Debug overlay
    if (location.hash === "#debug") {
        ctx.save();
        ctx.lineWidth = 0.01;
        ctx.globalAlpha = 0.3;
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

    // Detect drag
    if (!input.primary) {
        const drag = Vec.subtract(input.dragEnd, input.dragStart);
        const grounded = player.pos.y >= ground(player.pos.x)
            && Vec.length(player.vel) < 1e-2;
        if (grounded && Vec.length(drag) > 0.02) {
            player.vel = Vec.add(player.vel, Vec.scale(drag, -player.jump));
        }
        input.dragStart = input.dragEnd = Vec.zero();
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

    dbg.dt = dt;
    dbg.player = player;
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
