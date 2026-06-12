// ==================== UI (DOM rendering of the current screen) ====================
// Renders the top screen of the stack returned by cur() (defined in app.js).
function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
}
function cssUrl(u) {
    return String(u || "").replace(/['"\\)]/g, "");
}
function volBars(v) {
    var n = Math.round(v * 10),
        s = "";
    for (var i = 0; i < 10; i++) s += i < n ? "▮" : "▯";
    return s;
}
function fmtTime(s) {
    s = Math.max(0, Math.floor(s || 0));
    var m = Math.floor(s / 60),
        ss = s % 60;
    return m + ":" + (ss < 10 ? "0" : "") + ss;
}
function itemRow(it, selected) {
    var star = isFav(it) ? "★ " : "";
    var meta =
        it.kind === "track"
            ? it.duration
                ? fmtTime(it.duration)
                : ""
            : (it.bitrate ? it.bitrate + "k " : "") + (it.countrycode || "");
    return (
        '<div class="row' +
        (selected ? " sel" : "") +
        '"><span class="nm">' +
        esc(star + it.name) +
        (it.sub ? ' <span class="sub">— ' + esc(it.sub) + "</span>" : "") +
        '</span><span class="mt">' +
        esc(meta) +
        "</span></div>"
    );
}

function renderList(c) {
    if (c.error) return '<div class="msg">' + esc(c.error) + "</div>";
    if (!c.items.length)
        return (
            '<div class="msg">' +
            (c.source === "favorites"
                ? "No favourites yet.<br>Press # on a song to add it."
                : "Nothing found.") +
            "</div>"
        );
    return c.items
        .map(function (it, i) {
            return itemRow(it, i === c.sel);
        })
        .join("");
}

function renderNow() {
    var it = S.current || {},
        isTrack = it.kind === "track",
        st = S.status,
        playGlyph = st === "playing" ? "❚❚" : "▶",
        statusText =
            st === "buffering"
                ? "Buffering…"
                : st === "loading"
                  ? "Connecting…"
                  : st === "error"
                    ? "⚠ Stream unavailable"
                    : "";
    var progress;
    if (isTrack) {
        var t = curTime(),
            d = curDur() || it.duration || 0,
            pct = d ? Math.min(100, (t / d) * 100) : 0;
        progress =
            '<div class="bar"><div class="fill" style="width:' +
            pct.toFixed(1) +
            '%"></div></div>' +
            '<div class="ptime"><span>' +
            fmtTime(t) +
            "</span><span>" +
            fmtTime(d) +
            "</span></div>";
    } else {
        progress = '<div class="live">● LIVE</div>';
    }
    return (
        '<div class="player">' +
        '<div class="art"' +
        (it.art ? ' style="background-image:url(\'' + cssUrl(it.art) + "')\"" : "") +
        ">" +
        (it.art ? "" : "♪") +
        "</div>" +
        '<div class="ptitle">' +
        (isFav(it) ? "★ " : "") +
        esc(it.name || "") +
        "</div>" +
        '<div class="partist">' +
        esc(it.sub || "") +
        "</div>" +
        progress +
        '<div class="transport">' +
        '<div class="tbtn">◀◀<i>1</i></div>' +
        '<div class="tbtn play">' +
        playGlyph +
        "<i>5</i></div>" +
        '<div class="tbtn">▶▶<i>6</i></div>' +
        "</div>" +
        '<div class="pvol">VOL ' +
        (S.muted ? "MUTED" : volBars(S.volume)) +
        "</div>" +
        '<div class="pstatus">' +
        statusText +
        "</div>" +
        "</div>"
    );
}

function render() {
    var c = cur(),
        hdr = document.getElementById("hdr"),
        body = document.getElementById("body"),
        ftr = document.getElementById("ftr"),
        inp = document.getElementById("q");

    inp.style.display = c.type === "search" ? "block" : "none";
    hdr.textContent = c.title || "CloudFM";

    if (c.type === "menu" || c.type === "genres") {
        body.innerHTML = c.items
            .map(function (m, i) {
                return (
                    '<div class="row' +
                    (i === c.sel ? " sel" : "") +
                    '"><span class="nm">' +
                    esc(m.label) +
                    "</span></div>"
                );
            })
            .join("");
        ftr.textContent = c.type === "menu" ? "▲▼ Move · 5/OK Open" : "▲▼ · 5/OK Open · ◀ Back";
    } else if (c.type === "loading") {
        body.innerHTML = '<div class="msg">Loading…</div>';
        ftr.textContent = "Please wait…";
    } else if (c.type === "search") {
        body.innerHTML =
            '<div class="msg">Type a song or artist,<br>then press 5/OK to search.</div>';
        ftr.textContent = "Type · 5/OK Search · ◀ Back";
        inp.value = S.query || "";
        try {
            inp.focus();
        } catch (e) {}
    } else if (c.type === "list") {
        body.innerHTML = renderList(c);
        ftr.textContent = "▲▼ · 5 Play · # Fav · ◀ Back";
    } else if (c.type === "now") {
        body.innerHTML = renderNow();
        ftr.textContent = "5 Play · 6 Next · ▲▼ Vol · ◀ Back";
    }

    var sel = body.querySelector(".sel");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
}
