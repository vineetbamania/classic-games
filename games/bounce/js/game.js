// ==================== ENGINE CORE (constants, state, physics, loop, boot) ====================
// Loaded LAST. Other modules (atlas/audio/input/render) define helpers that are
// only *called* from here at runtime, so forward references resolve fine.

// ---- constants ----
var W = 128,
    H = 128,
    T = 12,
    S = 2; // game size, tile size, canvas scale
var GRAVITY = 0.3,
    BOUNCE = -5.5,
    MAXSPD = 2.2,
    ACCEL = 0.6, // reach full speed in ~4 frames — snappy but not instant
    BALLR = 5;
var JUMP = -6.0;
var canvas,
    ctx,
    sheet,
    sheetReady = false;

// ---- collision sets (physics; independent of the visual atlas) ----
// Determined from the level data + JAR collision class: only tiles 1, 2 and 10
// form structural walls/floors (long contiguous runs across every level). All
// other non-empty tiles (13,14,…,29,30…) are isolated *objects* that sit inside
// open corridors — the ball passes through them, so they must NOT be solid, or
// they seal the level (e.g. the 13/14 pair that used to wall off level 1).
// Bit 6 (64) is a variant flag, so each value is registered with and without it.
var SOLID = {},
    SPIKE = {},
    RING = {};
[1, 2, 10].forEach(function (v) {
    SOLID[v] = SOLID[v | 64] = true;
});
SPIKE[3] = SPIKE[3 | 64] = true;
RING[29] = RING[29 | 64] = true;

// ---- game state ----
var phase = "title",
    level = 1,
    score = 0,
    lives = 3,
    levData = null;
var ball,
    camX = 0,
    camY = 0,
    shake = 0,
    transTimer = 0;

// ==================== LEVEL LOADING ====================
function loadLevel(n) {
    var lv = LEVELS[String(n)];
    if (!lv) return false;
    levData = {
        num: n,
        sx: lv.sx,
        sy: lv.sy,
        gdir: lv.g,
        cols: lv.c,
        rows: lv.r,
        tiles: lv.t,
        col: new Array(lv.t.length),
    };
    ball = {
        x: levData.sx * T + T / 2,
        y: levData.sy * T + T / 2,
        vx: 0,
        vy: BOUNCE * (levData.gdir ? -1 : 1),
        r: BALLR,
        onGround: false,
        faceT: 0,
    };
    camX = ball.x - W / 2;
    camY = ball.y - H / 2;
    return true;
}

// ==================== PHYSICS ====================
function getTile(col, row) {
    if (col < 0 || col >= levData.cols || row < 0 || row >= levData.rows)
        return 1;
    var idx = row * levData.cols + col,
        t = levData.tiles[idx];
    return RING[t] && levData.col[idx] ? 0 : t;
}
function tileAt(px, py) {
    return getTile(Math.floor(px / T), Math.floor(py / T));
}
// Squared distance from point (px,py) to segment (ax,ay)->(bx,by).
function segDist2(px, py, ax, ay, bx, by) {
    var dx = bx - ax,
        dy = by - ay,
        l2 = dx * dx + dy * dy;
    var t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var cx = ax + t * dx,
        cy = ay + t * dy;
    return (px - cx) * (px - cx) + (py - cy) * (py - cy);
}

function update() {
    if (phase === "levelComplete") {
        transTimer--;
        if (transTimer <= 0) advanceLevel();
        return;
    }
    if (phase !== "playing" || !levData) return;

    var gd = levData.gdir ? -1 : 1,
        b = ball;

    // Remember where the ball was this frame so ring pickup can be tested along
    // the whole path it travels (a fast bounce can otherwise tunnel past a ring).
    var px = b.x,
        py = b.y;

    // Horizontal control is intentionally snappy: the ball moves only while a
    // direction is held, ramps to full speed in a few frames, reverses instantly,
    // and STOPS the moment the key is released (no coasting/glide).
    var dir = (right ? 1 : 0) - (left ? 1 : 0);
    if (dir !== 0) {
        if (dir > 0 && b.vx < 0) b.vx = 0; // instant turn-around
        if (dir < 0 && b.vx > 0) b.vx = 0;
        b.vx += dir * ACCEL;
        if (b.vx > MAXSPD) b.vx = MAXSPD;
        if (b.vx < -MAXSPD) b.vx = -MAXSPD;
    } else {
        b.vx = 0; // released -> stop now
    }

    if (jump && b.onGround) {
        b.vy = JUMP * gd;
        b.onGround = false;
        sndJump();
    }

    b.vy += GRAVITY * gd;
    b.x += b.vx;

    // Horizontal collision
    var lt = tileAt(b.x - b.r, b.y),
        rt = tileAt(b.x + b.r, b.y);
    if (SPIKE[lt] || SPIKE[rt]) {
        die();
        return;
    }
    if (SOLID[lt]) {
        b.x = (Math.floor((b.x - b.r) / T) + 1) * T + b.r;
        b.vx = Math.abs(b.vx) * 0.3;
    }
    if (SOLID[rt]) {
        b.x = Math.floor((b.x + b.r) / T) * T - b.r;
        b.vx = -Math.abs(b.vx) * 0.3;
    }

    // Wrap
    var mw = levData.cols * T;
    if (b.x < -b.r) b.x = mw + b.r;
    if (b.x > mw + b.r) b.x = -b.r;

    b.y += b.vy;
    b.onGround = false;

    // Vertical collision
    if (b.vy > 0) {
        var bl = tileAt(b.x - b.r + 2, b.y + b.r),
            br = tileAt(b.x + b.r - 2, b.y + b.r),
            bm = tileAt(b.x, b.y + b.r);
        if (SPIKE[bl] || SPIKE[br] || SPIKE[bm]) {
            die();
            return;
        }
        if (SOLID[bl] || SOLID[br] || SOLID[bm]) {
            b.y = Math.floor((b.y + b.r) / T) * T - b.r;
            b.vy = BOUNCE * gd;
            b.onGround = true;
            b.faceT = 8;
            sndBounce();
        }
    } else if (b.vy < 0) {
        var tl = tileAt(b.x - b.r + 2, b.y - b.r),
            tr = tileAt(b.x + b.r - 2, b.y - b.r),
            tm = tileAt(b.x, b.y - b.r);
        if (SOLID[tl] || SOLID[tr] || SOLID[tm]) {
            b.y = (Math.floor((b.y - b.r) / T) + 1) * T + b.r;
            b.vy = 0;
        }
    }

    // Rings — swept check: collect if the ball's travel segment this frame
    // (px,py)->(b.x,b.y) passes within reach of a ring centre. This is immune to
    // the fast bouncing in tight spaces that a single-point test tunnels through.
    // If the ball wrapped horizontally this frame, don't sweep across the seam.
    var spx = Math.abs(b.x - px) > T * 2 ? b.x : px,
        reach = (b.r + T / 2) * (b.r + T / 2);
    var r0 = Math.floor((Math.min(py, b.y) - T) / T),
        r1 = Math.floor((Math.max(py, b.y) + T) / T),
        c0 = Math.floor((Math.min(spx, b.x) - T) / T),
        c1 = Math.floor((Math.max(spx, b.x) + T) / T);
    for (var row = r0; row <= r1; row++) {
        for (var col = c0; col <= c1; col++) {
            var t = getTile(col, row);
            if (!RING[t]) continue;
            var idx = row * levData.cols + col;
            if (levData.col[idx]) continue;
            var rx = col * T + T / 2,
                ry = row * T + T / 2;
            if (segDist2(rx, ry, spx, py, b.x, b.y) < reach) {
                levData.col[idx] = true;
                score += 100;
                sndPickup();
                refreshHUD();
            }
        }
    }

    // Camera
    camX += (b.x - W / 2 - camX) * 0.08;
    camY += (b.y - H / 2 + 20 - camY) * 0.08;
    var mx = levData.cols * T - W,
        my = levData.rows * T - H;
    if (camX < -20) camX = -20;
    if (camX > mx + 20) camX = mx + 20;
    if (camY < -20) camY = -20;
    if (camY > my + 20) camY = my + 20;

    if (gd > 0) {
        if (b.y > camY + H + 60) die();
        if (b.y < -20) levelComplete();
    } else {
        if (b.y < camY - 60) die();
        if (b.y > levData.rows * T + 20) levelComplete();
    }

    if (b.faceT > 0) b.faceT--;
}

function die() {
    lives--;
    shake = 12;
    sndDie();
    if (lives <= 0) phase = "gameover";
    else {
        loadLevel(level);
        phase = "playing";
    }
    refreshHUD();
}
function levelComplete() {
    phase = "levelComplete";
    score += 500;
    transTimer = 90;
    sndLevel();
    refreshHUD();
}
function advanceLevel() {
    level++;
    if (level > 11) {
        level = 1;
        score = 0;
        lives = 3;
    }
    loadLevel(level);
    phase = "playing";
    refreshHUD();
}

// ==================== HUD (DOM mirror of the on-canvas HUD) ====================
function refreshHUD() {
    document.getElementById("hlvl").textContent = "Level " + level;
    document.getElementById("hscore").textContent = "Score: " + score;
    var h = "";
    for (var i = 0; i < lives; i++) h += "♥";
    document.getElementById("hlives").textContent = h;
}

// ==================== LOOP ====================
function loop() {
    var act;
    while ((act = actQ.shift())) {
        switch (phase) {
            case "title":
                if (act === "menu") {
                    score = 0;
                    lives = 3;
                    level = 1;
                    loadLevel(1);
                    phase = "playing";
                    refreshHUD();
                }
                break;
            case "gameover":
                if (act === "menu") {
                    loadLevel(level);
                    phase = "playing";
                    refreshHUD();
                }
                break;
            case "playing":
                if (act === "pause") phase = "paused";
                break;
            case "paused":
                if (act === "menu" || act === "pause") phase = "playing";
                break;
        }
    }
    update();
    render();
    requestAnimationFrame(loop);
}

// ==================== BOOT ====================
sheet = new Image();
sheet.onload = function () {
    buildAtlas(); // slice + transform the 67 tile images once
    sheetReady = true;
};
sheet.src = "assets/sprites.png";

canvas = document.getElementById("c");
canvas.width = W * S;
canvas.height = H * S;
ctx = canvas.getContext("2d");
ctx.scale(S, S);
ctx.imageSmoothingEnabled = false;

loadLevel(1);
refreshHUD();
loop();
