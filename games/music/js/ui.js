// ==================== UI (DOM rendering of the current screen) ====================
// Reads the global app state `S` and paints the header / body / footer. DOM (not
// canvas) is the right tool here: real text, ellipsis, and scrollIntoView for
// D-pad list navigation on a tiny screen.
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

function render() {
    var hdr = document.getElementById("hdr"),
        body = document.getElementById("body"),
        ftr = document.getElementById("ftr");

    if (S.screen === "home") {
        hdr.textContent = "CloudFM ♪";
        body.innerHTML = S.genres
            .map(function (g, i) {
                return (
                    '<div class="row' +
                    (i === S.gi ? " sel" : "") +
                    '"><span class="nm">' +
                    esc(g.label) +
                    "</span></div>"
                );
            })
            .join("");
        ftr.textContent = "▲▼ Move · 5/OK Open";
    } else if (S.screen === "loading") {
        hdr.textContent = esc(S.genres[S.gi].label);
        body.innerHTML = '<div class="msg">Loading…</div>';
        ftr.textContent = "Please wait…";
    } else if (S.screen === "list") {
        hdr.textContent = esc(S.genres[S.gi].label);
        if (S.error) body.innerHTML = '<div class="msg">' + esc(S.error) + "</div>";
        else if (!S.stations.length)
            body.innerHTML = '<div class="msg">No stations</div>';
        else
            body.innerHTML = S.stations
                .map(function (st, i) {
                    var meta =
                        (st.bitrate ? st.bitrate + "k " : "") +
                        (st.countrycode || "");
                    return (
                        '<div class="row' +
                        (i === S.si ? " sel" : "") +
                        '"><span class="nm">' +
                        esc(st.name) +
                        '</span><span class="mt">' +
                        esc(meta) +
                        "</span></div>"
                    );
                })
                .join("");
        ftr.textContent = "▲▼ · 5/OK Play · ◀ Back";
    } else if (S.screen === "now") {
        hdr.textContent = "Now Playing";
        var st = S.current || {},
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
        var meta =
            (st.codec || "") +
            (st.bitrate ? " " + st.bitrate + "k" : "") +
            (st.countrycode ? " · " + st.countrycode : "");
        body.innerHTML =
            '<div class="np-name">' +
            esc(st.name || "") +
            "</div>" +
            '<div class="np-meta">' +
            esc(meta) +
            "</div>" +
            '<div class="np-status">' +
            icon +
            "</div>" +
            '<div class="np-vol">VOL ' +
            (S.muted ? "MUTED" : volBars(S.volume)) +
            "</div>";
        ftr.textContent =
            "5/OK Play/Pause · ▲▼ Vol · ◀ Back";
    }

    var sel = body.querySelector(".sel");
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: "nearest" });
}
