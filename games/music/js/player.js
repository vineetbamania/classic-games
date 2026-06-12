// ==================== AUDIO PLAYER (HTML5 <audio> wrapper) ====================
// Cloud Phone runs a server-side Chromium and streams audio to the handset, so a
// plain <audio> element is all we need. We surface playback state through a
// callback so the UI can show Connecting / Buffering / Playing / Paused / Error.
// Audio is started from a key press (a user gesture), which satisfies Chromium's
// autoplay policy.
var audio = null,
    playerOnState = null;

function playerInit(el, stateCb) {
    audio = el;
    playerOnState = stateCb;
    audio.preload = "none";
    var MAP = {
        loadstart: "loading",
        waiting: "buffering",
        stalled: "buffering",
        playing: "playing",
        pause: "paused",
        error: "error",
    };
    Object.keys(MAP).forEach(function (ev) {
        audio.addEventListener(ev, function () {
            if (playerOnState) playerOnState(MAP[ev]);
        });
    });
}

function playStation(url) {
    if (playerOnState) playerOnState("loading");
    audio.src = url;
    try {
        audio.load();
    } catch (e) {}
    var p = audio.play();
    if (p && p.catch)
        p.catch(function () {
            if (playerOnState) playerOnState("error");
        });
}

function togglePlay() {
    if (!audio.src) return;
    if (audio.paused) {
        var p = audio.play();
        if (p && p.catch)
            p.catch(function () {
                if (playerOnState) playerOnState("error");
            });
    } else {
        audio.pause();
    }
}

function setVolume(v) {
    v = v < 0 ? 0 : v > 1 ? 1 : v;
    audio.volume = v;
    return v;
}

function setMuted(m) {
    audio.muted = m;
}
