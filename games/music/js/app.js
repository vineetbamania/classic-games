// ==================== APP (state machine + T9/D-pad input + boot) ====================
// Three screens in a small stack:  home (genres) -> list (stations) -> now (playing).
// Input here is DISCRETE (navigate / select / back / volume), which is exactly
// what Cloud Phone's remote key channel handles well — no held-button / dropped-
// keyup problems like a real-time game has. So plain keydown is fine; we only
// debounce the "action" keys so auto-repeat can't double-fire them, while letting
// up/down repeat (hold to scroll a list or ramp the volume).
var S = {
    screen: "home",
    genres: GENRES,
    gi: 0, // selected genre (home)
    stations: [],
    si: 0, // selected station (list)
    error: null,
    current: null, // station playing now
    status: "idle", // idle|loading|buffering|playing|paused|error
    volume: 0.8,
    muted: false,
};

function openGenre() {
    S.screen = "loading";
    S.error = null;
    render();
    fetchStations(
        S.genres[S.gi],
        function (list) {
            S.stations = list;
            S.si = 0;
            S.error = list.length ? null : "No stations found";
            S.screen = "list";
            render();
        },
        function () {
            // every mirror failed -> offline fallback so the app still works
            S.stations = FALLBACK.slice();
            S.si = 0;
            S.error = null;
            S.screen = "list";
            render();
        },
    );
}

function playSelected() {
    var st = S.stations[S.si];
    if (!st) return;
    S.current = st;
    S.status = "loading";
    S.screen = "now";
    render();
    playStation(st.url);
}

function goBack() {
    if (S.screen === "now") {
        S.screen = "list"; // keep playing in the background
        render();
    } else if (S.screen === "list") {
        S.screen = "home";
        render();
    }
}

function move(d) {
    if (S.screen === "home") {
        S.gi = (S.gi + d + S.genres.length) % S.genres.length;
        render();
    } else if (S.screen === "list" && S.stations.length) {
        S.si = (S.si + d + S.stations.length) % S.stations.length;
        render();
    } else if (S.screen === "now") {
        // up (d<0) raises volume, down lowers it
        S.volume = setVolume(S.volume + (d < 0 ? 0.1 : -0.1));
        if (S.muted && S.volume > 0) {
            S.muted = false;
            setMuted(false);
        }
        render();
    }
}

function activate() {
    if (S.screen === "home") openGenre();
    else if (S.screen === "list") playSelected();
    else if (S.screen === "now") togglePlay();
}

// ---- input ----
function nowMs() {
    return typeof performance !== "undefined" && performance.now
        ? performance.now()
        : new Date().getTime();
}
var lastAct = {};
function debounced(name) {
    var t = nowMs();
    if (t - (lastAct[name] || 0) < 150) return false;
    lastAct[name] = t;
    return true;
}
// Resolve a key event to a command, reading keyCode first (most reliable on the
// handset) and KeyboardEvent.key as a fallback.
function commandOf(e) {
    var kc = e.keyCode,
        k = e.key;
    if (kc === 38 || kc === 50 || k === "ArrowUp" || k === "2" || k === "w" || k === "W") return "up";
    if (kc === 40 || kc === 56 || k === "ArrowDown" || k === "8" || k === "s" || k === "S") return "down";
    if (kc === 37 || kc === 52 || kc === 8 || k === "ArrowLeft" || k === "4" || k === "a" || k === "A" || k === "Backspace") return "back";
    if (kc === 13 || kc === 53 || kc === 32 || kc === 27 || kc === 39 || kc === 54 ||
        k === "Enter" || k === "5" || k === " " || k === "SoftLeft" || k === "ArrowRight" || k === "6" || k === "d" || k === "D") return "ok";
    if (kc === 48 || k === "0" || k === "#" || k === "m" || k === "M") return "mute";
    return null;
}

window.addEventListener("keydown", function (e) {
    var c = commandOf(e);
    if (!c) return;
    e.preventDefault();
    // Navigation may auto-repeat (hold to scroll a list / ramp the volume).
    if (c === "up") return move(-1);
    if (c === "down") return move(1);
    // Action keys must fire once per physical press: ignore auto-repeat
    // (e.repeat where the platform sets it) plus a tiny debounce as backup.
    if (e.repeat) return;
    if (!debounced(c)) return;
    if (c === "ok") activate();
    else if (c === "back") goBack();
    else if (c === "mute") {
        S.muted = !S.muted;
        setMuted(S.muted);
        render();
    }
});

// ---- boot ----
function boot() {
    playerInit(document.getElementById("audio"), function (status) {
        S.status = status;
        if (S.screen === "now") render(); // only the now-screen shows status
    });
    setVolume(S.volume);
    render();
}
if (document.readyState === "loading")
    window.addEventListener("DOMContentLoaded", boot);
else boot();
