// ==================== RENDER ====================
// All canvas drawing. Reads engine state/constants (game.js) and the tile
// atlas (atlas.js); everything here runs per-frame from loop() in game.js.

// Render a tile exactly as the original engine did: pick the recipe for
// the base tile value, honour the variant bit (64), and run its draw ops.
function drawTile(v, x, y) {
    if (!sheetReady) return;
    var variant = v & 64 ? 1 : 0,
        base = v & 0x3f,
        rec = TILE[base];
    if (!rec) return; // sky / unmapped -> background shows through
    if (rec.n) rec = variant ? rec.v : rec.n;
    for (var k = 0; k < rec.length; k++) {
        var op = rec[k];
        if (op === "F") {
            ctx.fillStyle = variant ? "#1060B0" : "#B0E0F0";
            ctx.fillRect(x, y, T, T);
        } else if (op === "C") {
            var i = base - 13;
            ctx.drawImage(ATLASIMG[DA[i]], x, y);
            ctx.drawImage(ATLASIMG[DB[i]], x, y);
        } else if (op === "BG" || op === "OBJ") {
            // parallax background / dynamic objects are engine-managed
        } else if (op[0] === "Q") {
            ctx.drawImage(ATLASIMG[op[1]], x, y);
        } else if (op[0] === "R") {
            ctx.drawImage(getRot(op[1], op[2]), x, y);
        }
    }
}

function drawBall(bx, by) {
    var r = BALLR;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(bx, by + r + 1, r * 0.8, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    // Body - exact original red
    var g = ctx.createRadialGradient(bx - 1.5, by - 1.5, 1, bx, by, r);
    g.addColorStop(0, "#ff6040");
    g.addColorStop(0.3, "#d42910");
    g.addColorStop(1, "#6a0808");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#4a0404";
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Highlight
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.beginPath();
    ctx.arc(bx - 1.5, by - 1.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // Face
    if (ball.onGround && ball.faceT > 0) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(bx - 2, by - 1, 4, 1);
        ctx.fillRect(bx - 3, by, 6, 1);
    } else if (ball.vy < -3) {
        ctx.fillStyle = "#fff";
        ctx.fillRect(bx - 1, by - 3, 2, 2);
        ctx.fillRect(bx - 2, by - 2, 4, 1);
    }
}

function render() {
    ctx.fillStyle = "#B0E0F0"; // original Bounce sky blue
    ctx.fillRect(0, 0, W, H);
    if (shake > 0) {
        var sx = (Math.random() - 0.5) * 6,
            sy = (Math.random() - 0.5) * 6;
        ctx.save();
        ctx.translate(sx, sy);
        shake--;
        drawWorld();
        ctx.restore();
    } else drawWorld();
    drawHUD();
    drawOverlay();
}

function drawWorld() {
    if (!levData) return;
    var ox = Math.floor(camX),
        oy = Math.floor(camY);
    // (Original has a plain sky background — no grid.)
    // Tiles
    var sc = Math.max(0, Math.floor(ox / T)),
        ec = Math.min(levData.cols, Math.ceil((ox + W) / T) + 1);
    var sr = Math.max(0, Math.floor(oy / T)),
        er = Math.min(levData.rows, Math.ceil((oy + H) / T) + 1);
    for (var r = sr; r < er; r++)
        for (var c = sc; c < ec; c++) {
            var idx = r * levData.cols + c,
                v = levData.tiles[idx];
            if (v === 0 || (RING[v] && levData.col[idx])) continue;
            drawTile(v, c * T - ox, r * T - oy);
        }
    drawBall(ball.x - ox, ball.y - oy);
}

function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, W, 14);
    ctx.fillStyle = "#fff";
    ctx.font = 'bold 7px "Courier New",monospace';
    ctx.textAlign = "left";
    ctx.fillText("LV" + level, 4, 10);
    ctx.textAlign = "right";
    ctx.fillText(String(score), W - 4, 10);
    ctx.textAlign = "center";
    for (var i = 0; i < lives; i++)
        ctx.fillText("♥", W / 2 - 10 + i * 10, 10);
}

function drawOverlay() {
    if (phase === "title") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = 'bold 9px "Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillText("NOKIA BOUNCE", W / 2, 48);
        ctx.font = '7px "Courier New",monospace';
        ctx.fillText("11 Original Levels", W / 2, 60);
        ctx.fillText("4 6 Move   2 Jump", W / 2, 74);
        ctx.fillText("(or arrow keys)", W / 2, 86);
        ctx.fillText("Press 5 / Enter to start", W / 2, 100);
    } else if (phase === "paused") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = 'bold 9px "Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillText("PAUSED", W / 2, 60);
    } else if (phase === "gameover") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#e03020";
        ctx.font = 'bold 9px "Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", W / 2, 52);
        ctx.fillStyle = "#fff";
        ctx.font = '7px "Courier New",monospace';
        ctx.fillText("Score: " + score, W / 2, 68);
        ctx.fillText("Press Enter to retry", W / 2, 82);
    } else if (phase === "levelComplete") {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.font = 'bold 9px "Courier New",monospace';
        ctx.textAlign = "center";
        ctx.fillText("LEVEL " + level + " CLEAR!", W / 2, 60);
    }
}
