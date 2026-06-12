// ==================== iTunes SEARCH (30-second previews of mainstream songs) ====================
// The iTunes Search API has the whole mainstream catalogue and returns https
// preview URLs (~30s, AAC) playable in <audio>. It sends no CORS header, but it
// DOES support JSONP (?callback=…), which loads via a <script> tag and sidesteps
// CORS entirely — works on localhost, GitHub Pages, and Cloud Phone alike.
var _jsonpN = 0;
function jsonp(url, ok, fail) {
    var name = "__cfm_jsonp_" + _jsonpN++;
    var s = document.createElement("script");
    var timer = setTimeout(function () {
        cleanup();
        if (fail) fail();
    }, 9000);
    function cleanup() {
        clearTimeout(timer);
        try {
            delete window[name];
        } catch (e) {
            window[name] = undefined;
        }
        if (s.parentNode) s.parentNode.removeChild(s);
    }
    window[name] = function (data) {
        cleanup();
        ok(data);
    };
    s.onerror = function () {
        cleanup();
        if (fail) fail();
    };
    s.src = url + (url.indexOf("?") < 0 ? "?" : "&") + "callback=" + name;
    document.head.appendChild(s);
}

function searchPreviews(q, cb, err) {
    var url =
        "https://itunes.apple.com/search?media=music&entity=song&limit=25&term=" +
        encodeURIComponent(q);
    jsonp(
        url,
        function (d) {
            var list = (d && d.results) || [],
                out = [];
            for (var i = 0; i < list.length && out.length < 20; i++) {
                var t = list[i],
                    u = t.previewUrl || "";
                if (!/^https:/i.test(u)) continue;
                out.push({
                    kind: "track",
                    src: "itunes",
                    preview: true,
                    id: "it" + (t.trackId || i),
                    name: (t.trackName || "Unknown").trim(),
                    sub: t.artistName || "",
                    url: u,
                    duration: 30,
                    art: (t.artworkUrl100 || "").replace("100x100", "200x200"),
                });
            }
            cb(out);
        },
        err,
    );
}
