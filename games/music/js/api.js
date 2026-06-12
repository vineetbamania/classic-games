// ==================== RADIO-BROWSER API (free/open, no key) ====================
// https://www.radio-browser.info — a community catalogue of internet-radio
// stations. No auth, CORS-enabled. We try several mirrors in order so one server
// being down doesn't break the app, and we keep ONLY https stream URLs: the app
// is served over https (GitHub Pages / Cloud Phone), and browsers block http
// audio on an https page (mixed content).
var RB_HOSTS = [
    "https://de1.api.radio-browser.info",
    "https://de2.api.radio-browser.info",
    "https://nl1.api.radio-browser.info",
    "https://at1.api.radio-browser.info",
];

// Browse categories. `tag:null` = the global most-played list.
var GENRES = [
    { label: "Top Stations", tag: null },
    { label: "Pop", tag: "pop" },
    { label: "Rock", tag: "rock" },
    { label: "Jazz", tag: "jazz" },
    { label: "Classical", tag: "classical" },
    { label: "Electronic", tag: "electronic" },
    { label: "Dance", tag: "dance" },
    { label: "Chillout", tag: "chillout" },
    { label: "Lounge", tag: "lounge" },
    { label: "Hip Hop", tag: "hip hop" },
    { label: "News", tag: "news" },
    { label: "80s", tag: "80s" },
    { label: "Country", tag: "country" },
    { label: "Reggae", tag: "reggae" },
];

// Last-resort list if EVERY mirror is unreachable — SomaFM, commercial-free,
// listener-supported, served over https.
var FALLBACK = [
    { name: "SomaFM: Groove Salad", url: "https://ice1.somafm.com/groovesalad-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
    { name: "SomaFM: Drone Zone", url: "https://ice1.somafm.com/dronezone-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
    { name: "SomaFM: Lush", url: "https://ice1.somafm.com/lush-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
    { name: "SomaFM: Indie Pop Rocks", url: "https://ice1.somafm.com/indiepop-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
    { name: "SomaFM: Secret Agent", url: "https://ice1.somafm.com/secretagent-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
    { name: "SomaFM: Beat Blender", url: "https://ice1.somafm.com/beatblender-128-mp3", codec: "MP3", bitrate: 128, countrycode: "US" },
];

// Try each mirror until one returns JSON; call errcb if all fail.
function rbFetch(path, cb, errcb) {
    var i = 0;
    (function attempt() {
        if (i >= RB_HOSTS.length) {
            if (errcb) errcb();
            return;
        }
        var host = RB_HOSTS[i++];
        fetch(host + path)
            .then(function (r) {
                if (!r.ok) throw new Error("http " + r.status);
                return r.json();
            })
            .then(cb)
            .catch(attempt);
    })();
}

// Fetch up to 40 https stations for a genre, most-played first, de-duplicated.
function fetchStations(genre, cb, errcb) {
    var path = genre.tag
        ? "/json/stations/search?tag=" +
          encodeURIComponent(genre.tag) +
          "&order=clickcount&reverse=true&limit=80&hidebroken=true"
        : "/json/stations/topclick/80";
    rbFetch(
        path,
        function (list) {
            var seen = {},
                out = [];
            for (var k = 0; k < list.length && out.length < 40; k++) {
                var s = list[k],
                    u = s.url_resolved || s.url || "";
                if (!/^https:/i.test(u)) continue; // mixed-content safe
                var nm = (s.name || "").replace(/\s+/g, " ").trim();
                if (!nm || seen[u]) continue;
                seen[u] = 1;
                out.push({
                    name: nm,
                    url: u,
                    codec: s.codec || "",
                    bitrate: s.bitrate || 0,
                    countrycode: s.countrycode || s.country || "",
                });
            }
            cb(out);
        },
        errcb,
    );
}
