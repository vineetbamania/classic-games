// ==================== AUDIO PLAYER (HTML5 <audio> wrapper) ====================
// Cloud Phone streams <audio>/<video> element output to the handset (unlike Web
// Audio synthesis, which only plays on the server). Playback starts from a key
// press (user gesture) to satisfy autoplay policy.
//   onState(status)   -> loading|buffering|playing|paused|error|ended
//   onProgress()       -> fired on timeupdate / loadedmetadata (for the seek bar)
var audio = null,
    playerOnState = null,
    playerOnProgress = null;

function playerInit(el, stateCb, progressCb) {
    audio = el;
    playerOnState = stateCb;
    playerOnProgress = progressCb;
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
    audio.addEventListener("ended", function () {
        if (playerOnState) playerOnState("ended");
    });
    audio.addEventListener("timeupdate", function () {
        if (playerOnProgress) playerOnProgress();
    });
    audio.addEventListener("loadedmetadata", function () {
        if (playerOnProgress) playerOnProgress();
    });
}

function playUrl(url) {
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
function curTime() {
    return audio.currentTime || 0;
}
function curDur() {
    return isFinite(audio.duration) ? audio.duration : 0;
}
