// ==================== FAVORITES (localStorage, with in-memory fallback) ====================
// Saves favourited stations and tracks so they survive between sessions. If
// localStorage is unavailable/blocked on the host, we degrade to in-memory only
// (favourites still work for the current session).
var FAV_KEY = "cloudfm_favs_v1";
var _favs = (function () {
    try {
        return JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
    } catch (e) {
        return [];
    }
})();
function favSave() {
    try {
        localStorage.setItem(FAV_KEY, JSON.stringify(_favs));
    } catch (e) {}
}
function favId(it) {
    return it.kind + ":" + (it.id || it.url);
}
function favList() {
    return _favs.slice();
}
function isFav(it) {
    var k = favId(it);
    for (var i = 0; i < _favs.length; i++) if (favId(_favs[i]) === k) return true;
    return false;
}
// Toggle and return the new favourited state.
function toggleFav(it) {
    var k = favId(it);
    for (var i = 0; i < _favs.length; i++) {
        if (favId(_favs[i]) === k) {
            _favs.splice(i, 1);
            favSave();
            return false;
        }
    }
    _favs.unshift({
        kind: it.kind,
        id: it.id || null,
        name: it.name,
        sub: it.sub || "",
        url: it.url,
        duration: it.duration || 0,
    });
    favSave();
    return true;
}
