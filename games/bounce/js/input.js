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
window.addEventListener("keydown", function (e) {
    initAudio();
    switch (e.key) {
        case "ArrowLeft":
        case "Left":
        case "a":
        case "4":
            left = true;
            break;
        case "ArrowRight":
        case "Right":
        case "d":
        case "6":
            right = true;
            break;
        case "ArrowUp":
        case "Up":
        case "w":
        case "2":
        case "8":
            jump = true;
            break;
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
    switch (e.key) {
        case "ArrowLeft":
        case "Left":
        case "a":
        case "4":
            left = false;
            break;
        case "ArrowRight":
        case "Right":
        case "d":
        case "6":
            right = false;
            break;
        case "ArrowUp":
        case "Up":
        case "w":
        case "2":
        case "8":
            jump = false;
            break;
    }
});
