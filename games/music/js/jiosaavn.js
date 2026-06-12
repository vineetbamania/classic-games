// ==================== JioSaavn (FULL mainstream songs: Bollywood + English) ====================
// JioSaavn's own API has no CORS and DES-encrypts media URLs, so a backend is
// required to decrypt + add CORS. We try a LIST of public JioSaavnAPI instances
// in order (resilience — demos rate-limit / go down) and understand BOTH common
// response shapes:
//   • "flat"     — cyberboysumanjay/JioSaavnAPI  (array of songs, `media_url`)
//   • "saavndev" — sumitkolhe/jiosaavn-api        ({data:{results:[{downloadUrl:[…]}]}})
// For reliability deploy your own (Vercel/Render, India region) and put it FIRST.
var JIOSAAVN_HOSTS = [
    { base: "https://saavnapi-nine.vercel.app", path: function (q) { return "/result/?query=" + encodeURIComponent(q); }, kind: "flat" },
    { base: "https://saavn.dev", path: function (q) { return "/api/search/songs?query=" + encodeURIComponent(q) + "&limit=25"; }, kind: "saavndev" },
];

function _svFetch(url, ms, ok, fail) {
    var done = false,
        timer = setTimeout(function () { if (!done) { done = true; fail(); } }, ms || 8000);
    fetch(url)
        .then(function (r) { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
        .then(function (j) { if (done) return; done = true; clearTimeout(timer); ok(j); })
        .catch(function () { if (done) return; done = true; clearTimeout(timer); fail(); });
}
function _svDecode(s) {
    return String(s || "")
        .replace(/&amp;/g, "&").replace(/&#0?39;/g, "'")
        .replace(/&quot;/g, '"').replace(/&gt;/g, ">").replace(/&lt;/g, "<");
}
function _svItem(name, sub, url, duration, art, id, i) {
    url = (url || "").replace(/^http:/i, "https:"); // mixed-content safe
    if (!/^https:/i.test(url)) return null;
    return {
        kind: "track", src: "saavn",
        id: "sv" + (id || i),
        name: _svDecode(name || "Unknown"),
        sub: _svDecode(sub || ""),
        url: url,
        duration: parseInt(duration, 10) || 0,
        art: art || "",
    };
}
// cyberboysumanjay style: flat array, each song has media_url / song / primary_artists / image
function _svNormFlat(list) {
    var out = [];
    for (var i = 0; i < list.length && out.length < 25; i++) {
        var s = list[i],
            it = _svItem(s.song || s.title, s.primary_artists || s.singers, s.media_url, s.duration, (s.image || "").replace("150x150", "500x500"), s.id, i);
        if (it) out.push(it);
    }
    return out;
}
// saavn.dev style: results[].downloadUrl[] (qualities low->high), artists.primary[].name, image[]
function _svNormDev(results) {
    var out = [];
    for (var i = 0; i < results.length && out.length < 25; i++) {
        var s = results[i],
            dl = s.downloadUrl || s.download_url || [],
            best = dl.length ? dl[dl.length - 1] : null,
            art = Array.isArray(s.image) && s.image.length ? s.image[s.image.length - 1].url || s.image[s.image.length - 1].link : "",
            artist = "";
        try { artist = (s.artists.primary || []).map(function (a) { return a.name; }).join(", "); } catch (e) { artist = s.primaryArtists || ""; }
        var it = _svItem(s.name || s.title, artist, best && (best.url || best.link), s.duration, art, s.id, i);
        if (it) out.push(it);
    }
    return out;
}

function searchJioSaavn(q, cb, err) {
    var i = 0;
    (function go() {
        if (i >= JIOSAAVN_HOSTS.length) { if (err) err(); return; }
        var h = JIOSAAVN_HOSTS[i++];
        _svFetch(
            h.base + h.path(q),
            8000,
            function (data) {
                var items =
                    h.kind === "flat"
                        ? _svNormFlat(Array.isArray(data) ? data : data.data || data.results || [])
                        : _svNormDev((data && data.data && data.data.results) || (data && data.results) || []);
                if (items && items.length) cb(items);
                else go(); // empty -> try the next instance
            },
            go, // unreachable -> try the next instance
        );
    })();
}
