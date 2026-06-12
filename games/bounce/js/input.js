// ==================== INPUT (built for Cloud Phone's remote/laggy key stream) ====================
// On Cloud Phone the app runs in a browser on a server and key events travel
// over the network from the handset. A `keyup` can be DROPPED or arrive late, so
// we must NOT depend on it to stop the ball — that's why a held button used to
// "hang up" and keep propelling.
//
// Instead each control is a DEAD-MAN'S SWITCH: every `keydown` refreshes a short
// deadline; the control stays active only while keydowns keep arriving (the host
// auto-repeats them while a key is physically held). The moment they stop — real
// release, dropped keyup, or a disconnection — the deadline lapses and the control
// auto-releases. A `keyup`, when it does arrive, just clears the deadline early so
// release feels instant. We also read BOTH `keyCode` and `key` because the T9
// digits arrive inconsistently as one or the other on the handset.
//
// Exposes globals `left`/`right`/`jump`/`down`/`actQ` (read by game.js) and `muted`.
var left = false,
    right = false,
    jump = false,
    down = false,
    actQ = [];

// HOLD_MS must exceed the gap between auto-repeat keydowns (incl. the longer
// initial repeat delay + network jitter) so a held key never flickers, yet be
// short enough that a dropped keyup only over-travels briefly. ~380ms is a safe
// middle for Chromium-style auto-repeat (≈250ms initial delay) over a mobile link.
var HOLD_MS = 380;
var until = { left: 0, right: 0, up: 0, down: 0 };
var lastAct = {};
function nowMs() {
    return typeof performance !== "undefined" && performance.now
        ? performance.now()
        : Date.now();
}

// Resolve an event to a movement control, preferring keyCode (most reliable on
// the handset) and falling back to KeyboardEvent.key.
function ctrlOf(e) {
    switch (e.keyCode) {
        case 37: case 52: return "left"; // ArrowLeft / T9 '4'
        case 39: case 54: return "right"; // ArrowRight / T9 '6'
        case 38: case 50: return "up"; // ArrowUp / T9 '2'
        case 40: case 56: return "down"; // ArrowDown / T9 '8'
    }
    switch (e.key) {
        case "ArrowLeft": case "Left": case "a": case "A": case "4": return "left";
        case "ArrowRight": case "Right": case "d": case "D": case "6": return "right";
        case "ArrowUp": case "Up": case "w": case "W": case "2": return "up";
        case "ArrowDown": case "Down": case "s": case "S": case "8": return "down";
    }
    return null;
}

// One-shot actions (menu/pause/mute) debounced so auto-repeat can't fire them
// many times while the key is held.
function fireAction(name) {
    var t = nowMs();
    if (t - (lastAct[name] || 0) < 300) return;
    lastAct[name] = t;
    if (name === "mute") muted = !muted;
    else actQ.push(name);
}

window.addEventListener("keydown", function (e) {
    initAudio();
    var c = ctrlOf(e);
    if (c) {
        until[c] = nowMs() + HOLD_MS; // (re)arm the dead-man's switch
        e.preventDefault();
        return;
    }
    // action keys (keyCode first, then key)
    if (e.keyCode === 13 || e.keyCode === 53 || e.keyCode === 27) {
        e.preventDefault();
        fireAction("menu"); // Enter / T9 '5' / LSK(Escape) = OK / select / start
        return;
    }
    switch (e.key) {
        case " ":
        case "Enter":
        case "5":
        case "SoftLeft":
            e.preventDefault();
            fireAction("menu");
            break;
        case "p":
        case "P":
        case "SoftRight":
        case "#":
            fireAction("pause");
            break;
        case "m":
        case "M":
        case "0":
            fireAction("mute");
            break;
    }
});

// keyup is best-effort: when it arrives it releases instantly; when it's lost the
// dead-man's switch above still releases the control on its own.
window.addEventListener("keyup", function (e) {
    var c = ctrlOf(e);
    if (c) until[c] = 0;
});

// Focus loss / tab hidden = release everything immediately.
function clearMoves() {
    until.left = until.right = until.up = until.down = 0;
    left = right = jump = down = false;
}
window.addEventListener("blur", clearMoves);
document.addEventListener("visibilitychange", function () {
    if (document.hidden) clearMoves();
});

// Called once per frame by the engine: derive the boolean controls from the
// deadlines. Anything not refreshed within HOLD_MS auto-releases.
function pollInput() {
    var t = nowMs();
    left = t < until.left;
    right = t < until.right;
    jump = t < until.up;
    down = t < until.down;
}
