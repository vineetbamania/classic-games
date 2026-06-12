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
        document.getElementById("q").value = ""; // fresh query
        push({ type: "search", title: "Search Songs", sel: 0 }); // sel 0=input, 1=Go button
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
    if (cur().type !== "search") return;
    var val = (document.getElementById("q").value || "").trim();
    if (!val) {
        goBack();
        return;
    }
    S.query = val;
    push({ type: "loading", title: "Searching…" });
    searchAll(val, function (items) {
        replaceTop({ type: "list", title: 'Search: "' + val + '"', items: items, sel: 0, source: "tracks" });
    });
}

// Search all three sources in parallel and merge: full songs first (Audius, then
// experimental YouTube), then mainstream 30-sec previews (iTunes). Always resolves
// — each source has its own failure path and a 10s overall guard — so a slow or
// dead source (Piped is often down) can't hang the search.
function searchAll(q, done) {
    var b = { saavn: null, audius: null, yt: null, itunes: null },
        finished = false;
    function emit() {
        if (finished) return;
        finished = true;
        // JioSaavn (full mainstream) first, then Audius (full), YouTube
        // (experimental full), then iTunes (30-sec previews) last.
        done([].concat(b.saavn || [], b.audius || [], b.yt || [], b.itunes || []));
    }
    function check() {
        if (b.saavn !== null && b.audius !== null && b.yt !== null && b.itunes !== null) emit();
    }
    searchJioSaavn(q, function (s) { b.saavn = s; check(); }, function () { b.saavn = []; check(); });
    searchTracks(q, function (a) { b.audius = a; check(); }, function () { b.audius = []; check(); });
    searchYt(q, function (y) { b.yt = y; check(); }, function () { b.yt = []; check(); });
    searchPreviews(q, function (p) { b.itunes = p; check(); }, function () { b.itunes = []; check(); });
    setTimeout(function () {
        b.saavn = b.saavn || [];
        b.audius = b.audius || [];
        b.yt = b.yt || [];
        b.itunes = b.itunes || [];
        emit();
    }, 10000);
}

// ---- playback ----
function playItem(items, idx) {
    S.queue = items;
    S.qi = idx;
    var it = items[idx];
    S.current = it;
    S.status = "loading";
    if (it.src === "yt" && !it.url) {
        // YouTube/Piped streams are resolved lazily (a second API call) so the
        // search list loads fast; if it can't be resolved, mark it unavailable.
        resolveYt(it.vid, function (url) {
            if (S.current !== it) return; // user already moved on
            if (url) {
                it.url = url;
                playUrl(url);
            } else {
                S.status = "error";
                if (cur().type === "now") render();
            }
        });
    } else {
        playUrl(it.url);
    }
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
    // Up/Down only navigate lists now; on the now-playing screen they fall
    // through to the device (handled in the keydown listener above).
    var c = cur();
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
        var kc = e.keyCode,
            k = e.key;
        // Two zones: the text input (c.sel 0) and the SEARCH button (c.sel 1).
        // The number keys must stay free for typing, so we navigate between zones
        // with the D-pad only (ArrowUp/Down), never with 2/4/6/8.
        if (c.sel === 1) {
            // SEARCH button focused (input blurred -> value is committed)
            if (kc === 38 || k === "ArrowUp") {
                e.preventDefault();
                c.sel = 0;
                render();
            } else if (kc === 37 || k === "ArrowLeft") {
                e.preventDefault();
                goBack();
            } else if (kc === 13 || kc === 53 || kc === 32 || kc === 27 || k === "Enter" || k === "5" || k === " " || k === "SoftLeft") {
                e.preventDefault();
                submitSearch();
            }
            return;
        }
        // Text input focused: only intercept D-pad keys; let number keys type.
        if (kc === 40 || k === "ArrowDown") {
            e.preventDefault();
            c.sel = 1; // move down to the SEARCH button
            render();
        } else if (kc === 13 || k === "Enter") {
            e.preventDefault();
            submitSearch(); // center/OK from the field also searches
        } else if (kc === 27 || k === "Escape" || k === "SoftLeft") {
            e.preventDefault();
            submitSearch(); // LSK acts as "Search"
        } else if (kc === 37 || k === "ArrowLeft") {
            e.preventDefault();
            goBack();
        }
        return;
    }
    var cmd = commandOf(e);
    if (!cmd) return;
    // On the now-playing screen, let Up/Down pass straight through (no
    // preventDefault, no handling) so the phone's own hardware volume can act on
    // them. A web app cannot set device volume, and audio.volume is ignored on
    // Cloud Phone — so consuming these keys here would only block the device.
    if ((cmd === "up" || cmd === "down") && c.type === "now") return;
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
    // Search submit is wired on the input itself, because on a feature phone the
    // typed text isn't committed to .value until the IME fires `change` (when you
    // press OK to confirm the field) — and the confirm key may never reach the
    // window as Enter. `change` is the reliable trigger; only act if there's text
    // so a blur with an empty field doesn't bounce the user back.
    var q = document.getElementById("q");
    function searchIfTyped() {
        if (cur().type === "search" && (q.value || "").trim()) submitSearch();
    }
    q.addEventListener("change", searchIfTyped);
    q.addEventListener("search", searchIfTyped);
    q.addEventListener("keydown", function (e) {
        if (e.keyCode === 13 || e.key === "Enter") {
            e.preventDefault();
            submitSearch();
        }
    });
    S.stack = [homeScreen()];
    render();
}
if (document.readyState === "loading")
    window.addEventListener("DOMContentLoaded", boot);
else boot();
