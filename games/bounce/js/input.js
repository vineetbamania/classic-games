// ==================== INPUT ====================
// Cloud Phone feature phones deliver: arrow/D-pad keys, the numeric T9
// keypad (2/4/6/8 directional, 5 = action), soft keys, and Enter. We accept
// arrows + WASD (desktop testing) + the numeric keypad + soft keys.
//
// Exposes the globals `left`/`right`/`jump`/`actQ` read by the engine (game.js),
// and toggles `muted` / calls initAudio() from audio.js.
var left = false,
    right = false,
    jump = false,
    actQ = [];

// key -> movement flag. Listed once so keydown and keyup can't drift apart
// (a mismatch there is a classic "stuck key" bug).
var MOVEKEY = {
    ArrowLeft: "left", Left: "left", a: "left", A: "left", "4": "left",
    ArrowRight: "right", Right: "right", d: "right", D: "right", "6": "right",
    ArrowUp: "jump", Up: "jump", w: "jump", W: "jump", "2": "jump", "8": "jump",
};
function setMove(name, val) {
    if (name === "left") left = val;
    else if (name === "right") right = val;
    else jump = val;
}
// Safety net: drop every held key. A missed keyup (focus leaves the window, an
// overlay grabs it, the Cloud Phone host drops it) is the usual reason a button
// "hangs up" — the down stays latched with no up to clear it. Clearing on focus
// loss / tab hide guarantees the ball can't keep propelling on its own.
function clearMoves() {
    left = right = jump = false;
}

window.addEventListener("keydown", function (e) {
    initAudio();
    var m = MOVEKEY[e.key];
    if (m) {
        setMove(m, true);
        e.preventDefault();
        return;
    }
    switch (e.key) {
        case " ":
        case "Enter":
        case "5": // center keypad key = OK / select
        case "SoftLeft": // left soft key = select / start
            e.preventDefault();
            actQ.push("menu");
            break;
        case "p":
        case "P":
        case "SoftRight": // right soft key = pause / back
        case "#":
            actQ.push("pause");
            break;
        case "m":
        case "M":
        case "0":
            muted = !muted;
            break;
    }
});
window.addEventListener("keyup", function (e) {
    var m = MOVEKEY[e.key];
    if (m) setMove(m, false);
});
window.addEventListener("blur", clearMoves);
document.addEventListener("visibilitychange", function () {
    if (document.hidden) clearMoves();
});
