// ==================== YouTube via PIPED (EXPERIMENTAL) ====================
// Piped is an open-source YouTube proxy: its public instances do the audio
// extraction server-side, so we can search and get a playable audio-stream URL
// without our own backend. CAVEATS (be honest): public instances are frequently
// rate-limited / blocked by YouTube / down, it's a YouTube-ToS grey area, and a
// returned stream may not always play through Cloud Phone. So this is best-effort
// — if every instance fails, searchYt just returns nothing and the other sources
// (Audius, iTunes) carry the search. Instances rotate over time; update this list
// if YT results stop appearing.
var PIPED_HOSTS = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://api.piped.private.coffee",
    "https://pipedapi.reallyaboring.store",
    "https://pipedapi.darkness.services",
];

function _ytFetch(url, ms, ok, fail) {
    var done = false;
    var timer = setTimeout(function () {
        if (!done) {
            done = true;
            fail();
        }
    }, ms || 7000);
    fetch(url)
        .then(function (r) {
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
        })
        .then(function (j) {
            if (done) return;
            done = true;
            clearTimeout(timer);
            ok(j);
        })
        .catch(function () {
            if (done) return;
            done = true;
            clearTimeout(timer);
            fail();
        });
}
// Try each Piped host in turn until one answers; fail() if all are unreachable.
function _ytTryHosts(path, ok, fail) {
    var i = 0;
    (function go() {
        if (i >= PIPED_HOSTS.length) {
            fail();
            return;
        }
        _ytFetch(PIPED_HOSTS[i++] + path, 7000, ok, go);
    })();
}

function searchYt(q, cb, err) {
    _ytTryHosts(
        "/search?filter=music_songs&q=" + encodeURIComponent(q),
        function (j) {
            var items = (j.items || []).slice(0, 15),
                out = [];
            for (var i = 0; i < items.length; i++) {
                var o = items[i],
                    vid = ((o.url || "").split("v=")[1] || "").split("&")[0];
                if (!vid) continue;
                out.push({
                    kind: "track",
                    src: "yt",
                    id: "yt" + vid,
                    vid: vid,
                    name: (o.title || "Unknown").trim(),
                    sub: o.uploaderName || "",
                    url: "", // resolved lazily on play (see resolveYt)
                    duration: o.duration || 0,
                    art: o.thumbnail || "",
                });
            }
            cb(out);
        },
        function () {
            if (err) err();
        },
    );
}

// Resolve a video id to a playable audio-stream URL (highest-bitrate audio).
function resolveYt(vid, cb) {
    _ytTryHosts(
        "/streams/" + vid,
        function (j) {
            var a = (j.audioStreams || []).slice();
            a.sort(function (x, y) {
                return (y.bitrate || 0) - (x.bitrate || 0);
            });
            cb(a.length ? a[0].url : null);
        },
        function () {
            cb(null);
        },
    );
}
