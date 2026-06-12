// ==================== AUDIUS API (free/open, no key) — full-length songs ====================
// https://audius.org — a decentralized streaming platform with a public API.
// No auth (just an app_name), CORS-enabled, https, and the stream endpoint
// returns the full track as audio/mpeg, so it plays in a plain <audio> element.
// api.audius.co is the gateway that routes to a healthy discovery node.
var AUDIUS = "https://api.audius.co";
var AUDIUS_APP = "CloudFM";

function audiusGet(path, cb, err) {
    var url = AUDIUS + path + (path.indexOf("?") < 0 ? "?" : "&") + "app_name=" + AUDIUS_APP;
    fetch(url)
        .then(function (r) {
            if (!r.ok) throw new Error("http " + r.status);
            return r.json();
        })
        .then(function (j) {
            cb(j.data || []);
        })
        .catch(function () {
            if (err) err();
        });
}

// Normalize an Audius track into our unified playable-item shape.
function audiusTrack(t) {
    var art = (t.artwork && (t.artwork["150x150"] || t.artwork["480x480"])) || "";
    return {
        kind: "track",
        src: "audius",
        id: t.id,
        name: (t.title || "Unknown").replace(/\s+/g, " ").trim(),
        sub: (t.user && t.user.name) || "Unknown artist",
        url: AUDIUS + "/v1/tracks/" + t.id + "/stream?app_name=" + AUDIUS_APP,
        duration: t.duration || 0,
        art: art,
    };
}

function trendingTracks(cb, err) {
    audiusGet("/v1/tracks/trending", function (list) {
        cb(list.slice(0, 40).map(audiusTrack));
    }, err);
}

function searchTracks(q, cb, err) {
    audiusGet(
        "/v1/tracks/search?query=" + encodeURIComponent(q),
        function (list) {
            cb(list.slice(0, 40).map(audiusTrack));
        },
        err,
    );
}
