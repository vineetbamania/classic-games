// ==================== UI (DOM rendering of the current screen) ====================
// Renders the top screen of the stack returned by cur() (defined in app.js).
function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
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
    var meta = "";
    if (it.kind === "track") meta = it.duration ? fmtTime(it.duration) : "";
    else meta = (it.bitrate ? it.bitrate + "k " : "") + (it.countrycode || "");
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

function render() {
    var c = cur(),
        hdr = document.getElementById("hdr"),
        body = document.getElementById("body"),
        ftr = document.getElementById("ftr"),
        inp = document.getElementById("q");

    inp.style.display = c.type === "search" ? "block" : "none";
    hdr.textContent = c.title || "CloudFM";

    if (c.type === "menu") {
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
        ftr.textContent = "▲▼ Move · 5/OK Open";
    } else if (c.type === "genres") {
        body.innerHTML = c.items
            .map(function (g, i) {
                return (
                    '<div class="row' +
                    (i === c.sel ? " sel" : "") +
                    '"><span class="nm">' +
                    esc(g.label) +
                    "</span></div>"
                );
            })
            .join("");
        ftr.textContent = "▲▼ · 5/OK Open · ◀ Back";
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
        if (c.error) body.innerHTML = '<div class="msg">' + esc(c.error) + "</div>";
        else if (!c.items.length)
            body.innerHTML =
                '<div class="msg">' +
                (c.source === "favorites" ? "No favourites yet.<br>Press # on a track to add." : "Nothing found.") +
                "</div>";
        else
            body.innerHTML = c.items
                .map(function (it, i) {
                    return itemRow(it, i === c.sel);
                })
                .join("");
        ftr.textContent = "▲▼ · 5 Play · # Fav · ◀ Back";
    } else if (c.type === "now") {
        var it = S.current || {},
            isTrack = it.kind === "track",
            status = S.status,
            icon =
                status === "playing"
                    ? "▶ Playing"
                    : status === "paused"
                      ? "⏸ Paused"
                      : status === "buffering"
                        ? "⏳ Buffering…"
                        : status === "loading"
                          ? "⏳ Connecting…"
                          : status === "error"
                            ? "⚠ Unavailable"
                            : "■ Stopped";
        var prog = "";
        if (isTrack) {
            var t = curTime(),
                d = curDur() || it.duration || 0,
                pct = d ? Math.min(100, (t / d) * 100) : 0;
            prog =
                '<div class="bar"><div class="fill" style="width:' +
                pct.toFixed(1) +
                '%"></div></div>' +
                '<div class="np-meta">' +
                fmtTime(t) +
                " / " +
                fmtTime(d) +
                "</div>";
        } else {
            prog = '<div class="np-meta">● LIVE</div>';
        }
        body.innerHTML =
            '<div class="np-name">' +
            (isFav(it) ? "★ " : "") +
            esc(it.name || "") +
            "</div>" +
            '<div class="np-meta">' +
            esc(it.sub || "") +
            "</div>" +
            '<div class="np-status">' +
            icon +
            "</div>" +
            prog +
            '<div class="np-vol">VOL ' +
            (S.muted ? "MUTED" : volBars(S.volume)) +
            "</div>";
        ftr.textContent = isTrack
            ? "5 Play/Pause · ▶ Next · # Fav · ◀ Back"
            : "5 Play/Pause · # Fav · ◀ Back";
    }

    var sel = body.querySelector(".sel");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
}
