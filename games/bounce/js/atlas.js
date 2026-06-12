// ==================== TILE RENDERER (reverse-engineered from JAR class b) ====================
// The original builds a 67-image atlas (Q[]) by slicing 12x12 cells from
// objects_nm.png and rotating/flipping them, then draws each tile from a
// switch on the masked tile value. Generic terrain tiles (13..28) composite
// TWO layers: Q[DA[t-13]] (base) then Q[DB[t-13]] (overlay). All of this was
// extracted directly from the obfuscated bytecode — see tools/jdis.py notes.
//
// Depends on the global `sheet` (the loaded spritesheet Image), defined in game.js.
var DA = [35, 36, 17, 19, 43, 44, 25, 27, 31, 32, 13, 15, 39, 40, 21, 23];
var DB = [33, 34, 18, 20, 41, 42, 26, 28, 29, 30, 14, 16, 37, 38, 22, 24];
// ATLAS recipe: 's'=slice(col,row); 'c'=slice over bg color; 'x'=transform(srcIdx,code); 'b'=24x48 composite (unused by tiles)
// prettier-ignore
var ATLAS = [["s",1,0],["s",1,2],["c",0,3,"#B0E0F0"],["x",2,1],["x",2,3],["x",2,5],["c",0,3,"#1060B0"],["x",6,1],["x",6,3],["x",6,5],["s",0,4],["s",3,4],["b",2,3],["x",14,1],["s",0,5],["x",13,0],["x",14,0],["x",18,1],["s",1,5],["x",17,0],["x",18,0],["x",22,1],["s",2,5],["x",21,0],["x",22,0],["x",26,1],["s",3,5],["x",25,0],["x",26,0],["x",14,5],["x",29,1],["x",29,0],["x",30,0],["x",18,5],["x",33,1],["x",33,0],["x",34,0],["x",22,5],["x",37,1],["x",37,0],["x",38,0],["x",26,5],["x",41,1],["x",41,0],["x",42,0],["s",3,3],["s",1,3],["s",2,0],["s",0,1],["b",3,0],["s",3,1],["s",2,4],["s",3,2],["s",1,1],["s",2,2],["c",0,0,"#B0E0F0"],["x",55,3],["x",55,4],["x",55,5],["c",0,0,"#1060B0"],["x",59,3],["x",59,4],["x",59,5],["s",0,2],["x",63,3],["x",63,4],["x",63,5]];
// TILE recipe keyed by base tile value (0..54). Ops: "F"=fill; "C"=composite;
// "BG"/"OBJ"=engine specials (drawn elsewhere); ["Q",i]=draw atlas i; ["R",i,c]=draw rotated.
// {n:[...],v:[...]} picks by variant bit (64).
// prettier-ignore
var TILE = {"0":["F"],"1":[["Q",0]],"2":[["Q",1]],"3":{"n":[["Q",2]],"v":[["Q",6]]},"4":{"n":[["Q",5]],"v":[["Q",9]]},"5":{"n":[["Q",3]],"v":[["Q",7]]},"6":{"n":[["Q",4]],"v":[["Q",8]]},"7":[["Q",10]],"8":[["Q",11]],"9":["BG"],"10":["OBJ"],"13":["F","C"],"14":["F","C"],"15":["F","C"],"16":["F","C"],"17":["F","C"],"18":["F","C"],"19":["F","C"],"20":["F","C"],"21":["F","C"],"22":["F","C"],"23":["F","C"],"24":["F","C"],"25":["F","C"],"26":["F","C"],"27":["F","C"],"28":["F","C"],"29":[["Q",45]],"30":{"n":[["Q",57]],"v":[["Q",61]]},"31":{"n":[["Q",56]],"v":[["Q",60]]},"32":{"n":[["Q",55]],"v":[["Q",59]]},"33":{"n":[["Q",58]],"v":[["Q",62]]},"34":["F",["Q",65]],"35":["F",["Q",64]],"36":["F",["Q",63]],"37":["F",["Q",66]],"38":[["Q",53]],"39":["F",["Q",50]],"40":["F",["R",50,5]],"41":["F",["R",50,4]],"42":["F",["R",50,3]],"43":["F",["Q",51]],"44":["F",["R",51,5]],"45":["F",["R",51,4]],"46":["F",["R",51,3]],"47":[["Q",52]],"48":[["R",52,5]],"49":[["R",52,4]],"50":[["R",52,3]],"51":[["Q",54]],"52":[["R",54,5]],"53":[["R",54,4]],"54":[["R",54,3]]};

// Build the atlas of 12x12 canvases once the spritesheet has loaded.
var ATLASIMG = [],
    ROTCACHE = {};
function mkCanvas() {
    var cv = document.createElement("canvas");
    cv.width = 12;
    cv.height = 12;
    var c = cv.getContext("2d");
    c.imageSmoothingEnabled = false;
    return cv;
}
function sliceCell(col, row, bg) {
    var cv = mkCanvas(),
        c = cv.getContext("2d");
    if (bg) {
        c.fillStyle = bg;
        c.fillRect(0, 0, 12, 12);
    }
    c.drawImage(sheet, col * 12, row * 12, 12, 12, 0, 0, 12, 12);
    return cv;
}
// Nokia DirectGraphics manipulation codes: 0 flipH, 1 flipV, 2/4 rot180,
// 3 rot90 (CCW), 5 rot270 (CCW). Canvas y-down, so CCW = negative angle.
function xform(src, code) {
    var cv = mkCanvas(),
        c = cv.getContext("2d");
    c.translate(6, 6);
    if (code === 0) c.scale(-1, 1);
    else if (code === 1) c.scale(1, -1);
    else if (code === 2 || code === 4) c.rotate(Math.PI);
    else if (code === 3) c.rotate(-Math.PI / 2);
    else if (code === 5) c.rotate(Math.PI / 2);
    c.drawImage(src, -6, -6);
    return cv;
}
function buildAtlas() {
    ATLASIMG = new Array(ATLAS.length);
    ROTCACHE = {};
    function build(i) {
        if (ATLASIMG[i]) return ATLASIMG[i];
        var e = ATLAS[i],
            r;
        if (e[0] === "s") r = sliceCell(e[1], e[2]);
        else if (e[0] === "c") r = sliceCell(e[1], e[2], e[3]);
        else if (e[0] === "x") r = xform(build(e[1]), e[2]);
        else r = sliceCell(e[1], e[2]); // 'b' specials unused by tiles
        ATLASIMG[i] = r;
        return r;
    }
    for (var i = 0; i < ATLAS.length; i++) build(i);
}
function getRot(idx, code) {
    var k = idx + "_" + code;
    if (!ROTCACHE[k]) ROTCACHE[k] = xform(ATLASIMG[idx], code);
    return ROTCACHE[k];
}
