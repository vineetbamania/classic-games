// ==================== APP (screen stack + T9/D-pad input + boot) ====================
// Screens live on a stack so Back is always "pop". Tracks (Audius) and stations
// (Radio-Browser) share one playable-item shape, so the list/now screens and the
// play queue are generic. Input is discrete (the part Cloud Phone's remote key
// channel handles well); nav keys may auto-repeat, action keys fire once.
var SECTIONS = [
    { label: "Search Songs", act: "search" },
    { label: "Trending Songs", act: "trending" },
    { label: "Radio Stations", act: "radio" },
    { label: "Favourites", act: "favorites" },
];

var S = {
    stack: [],
    current: null, // playing item
    queue: [], // list the current item came from (for Next / auto-advance)
    qi: -1,
    status: "idle",
    volume: 0.8,
    muted: false,
    query: "",
};

function cur() {
    return S.stack[S.stack.length - 1];
}
function homeScreen() {
    return { type: "menu", title: "CloudFM ♪", items: SECTIONS, sel: 0 };
}
function push(scr) {
    S.stack.push(scr);
    render();
}
function replaceTop(scr) {
    S.stack[S.stack.length - 1] = scr;
    render();
}
function goBack() {
    if (S.stack.length > 1) {
        S.stack.pop();
        render();
    }
}

// ---- screen openers ----
function openMenuItem(act) {
    if (act === "search") {
        push({ type: "search", title: "Search Songs" });
    } else if (act === "trending") {
        push({ type: "loading", title: "Trending Songs" });
        trendingTracks(
            function (items) {
                replaceTop({ type: "list", title: "Trending Songs", items: items, sel: 0, source: "tracks" });
            },
            function () {
                replaceTop({ type: "list", title: "Trending Songs", items: [], sel: 0, source: "tracks", error: "Couldn't reach Audius" });
            },
        );
    } else if (act === "radio") {
        push({ type: "genres", title: "Radio Stations", items: GENRES, sel: 0 });
    } else if (act === "favorites") {
        push({ type: "list", title: "Favourites", items: favList(), sel: 0, source: "favorites" });
    }
}

function openGenre(genre) {
    push({ type: "loading", title: genre.label });
    fetchStations(
        genre,
        function (items) {
            replaceTop({ type: "list", title: genre.label, items: items, sel: 0, source: "stations", error: items.length ? null : "No stations" });
        },
        function () {
            replaceTop({ type: "list", title: genre.label, items: FALLBACK.slice(), sel: 0, source: "stations" });
        },
    );
}

function submitSearch() {
    var val = (document.getElementById("q").value || "").trim();
    if (!val) {
        goBack();
        return;
    }
    S.query = val;
    push({ type: "loading", title: "Search" });
    searchTracks(
        val,
        function (items) {
            replaceTop({ type: "list", title: 'Search: "' + val + '"', items: items, sel: 0, source: "tracks" });
        },
        function () {
            replaceTop({ type: "list", title: "Search", items: [], sel: 0, source: "tracks", error: "Search failed" });
        },
    );
}

// ---- playback ----
function playItem(items, idx) {
    S.queue = items;
    S.qi = idx;
    S.current = items[idx];
    S.status = "loading";
    playUrl(S.current.url);
}
function selectInList() {
    var c = cur();
    if (!c.items || !c.items.length) return;
    playItem(c.items, c.sel);
    push({ type: "now", title: "Now Playing" });
}
function next() {
    if (S.queue && S.qi < S.queue.length - 1) {
        playItem(S.queue, S.qi + 1);
        render();
    }
}
function prev() {
    if (S.queue && S.qi > 0) {
        playItem(S.queue, S.qi - 1);
        render();
    }
}

// ---- favourites ----
function toggleCurrentFav() {
    var c = cur(),
        it = null;
    if (c.type === "now") it = S.current;
    else if (c.type === "list" && c.items.length) it = c.items[c.sel];
    if (!it) return;
    toggleFav(it);
    if (c.type === "list" && c.source === "favorites") {
        c.items = favList();
        if (c.sel >= c.items.length) c.sel = Math.max(0, c.items.length - 1);
    }
    render();
}

// ---- navigation / actions ----
function move(d) {
    var c = cur();
    if (c.type === "now") {
        S.volume = setVolume(S.volume + (d < 0 ? 0.1 : -0.1));
        if (S.muted && S.volume > 0) {
            S.muted = false;
            setMuted(false);
        }
        render();
        return;
    }
    var n = c.items ? c.items.length : 0;
    if (!n) return;
    c.sel = (c.sel + d + n) % n;
    render();
}
function activate() {
    var c = cur();
    if (c.type === "menu") openMenuItem(c.items[c.sel].act);
    else if (c.type === "genres") openGenre(c.items[c.sel]);
    else if (c.type === "list") selectInList();
    else if (c.type === "now") togglePlay();
}
function rightAction() {
    if (cur().type === "now") next();
    else activate();
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
function commandOf(e) {
    var kc = e.keyCode,
        k = e.key;
    if (kc === 38 || kc === 50 || k === "ArrowUp" || k === "2" || k === "w" || k === "W") return "up";
    if (kc === 40 || kc === 56 || k === "ArrowDown" || k === "8" || k === "s" || k === "S") return "down";
    if (kc === 37 || kc === 52 || kc === 8 || k === "ArrowLeft" || k === "4" || k === "a" || k === "A" || k === "Backspace") return "back";
    if (kc === 39 || kc === 54 || k === "ArrowRight" || k === "6" || k === "d" || k === "D") return "right";
    if (kc === 13 || kc === 53 || kc === 32 || kc === 27 || k === "Enter" || k === "5" || k === " " || k === "SoftLeft") return "ok";
    if (kc === 49 || k === "1") return "prev"; // player: previous track
    if (k === "#" || k === "*") return "fav";
    if (kc === 48 || k === "0" || k === "m" || k === "M") return "mute";
    return null;
}

window.addEventListener("keydown", function (e) {
    var c = cur();
    if (c.type === "search") {
        // The handset's text-input method types digits/letters into #q, so the
        // number keys must stay free. We only intercept OK/Enter (run search) and
        // D-pad Left / LSK-Escape (leave search) — Back here is the arrow, not '4'.
        if (e.keyCode === 13 || e.key === "Enter") {
            e.preventDefault();
            submitSearch();
        } else if (e.keyCode === 37 || e.key === "ArrowLeft" || e.keyCode === 27 || e.key === "Escape") {
            e.preventDefault();
            goBack();
        }
        return;
    }
    var cmd = commandOf(e);
    if (!cmd) return;
    e.preventDefault();
    if (cmd === "up") return move(-1); // nav may auto-repeat (hold to scroll)
    if (cmd === "down") return move(1);
    if (e.repeat) return; // action keys fire once per physical press
    if (!debounced(cmd)) return;
    if (cmd === "ok") activate();
    else if (cmd === "right") rightAction();
    else if (cmd === "prev") {
        if (cur().type === "now") prev();
    } else if (cmd === "back") goBack();
    else if (cmd === "fav") toggleCurrentFav();
    else if (cmd === "mute") {
        S.muted = !S.muted;
        setMuted(S.muted);
        render();
    }
});

// ---- boot ----
function onPlayerState(st) {
    if (st === "ended") {
        S.status = "idle";
        next(); // auto-advance the queue
        return;
    }
    S.status = st;
    if (cur().type === "now") render();
}
function boot() {
    playerInit(
        document.getElementById("audio"),
        onPlayerState,
        function () {
            if (cur().type === "now" && S.current && S.current.kind === "track") render();
        },
    );
    setVolume(S.volume);
    S.stack = [homeScreen()];
    render();
}
if (document.readyState === "loading")
    window.addEventListener("DOMContentLoaded", boot);
else boot();
