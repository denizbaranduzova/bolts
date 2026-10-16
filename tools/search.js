ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;

function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
var COLS = 8, ROWS = 8;

function key(p) { return p.r + "," + p.c; }
function overlaps(a, b) {
  var s = {};
  a.forEach(function (p) { s[key(p)] = true; });
  return b.some(function (p) { return s[key(p)]; });
}
function onBoard(cells) {
  return cells.every(function (p) { return p.r >= 0 && p.c >= 0 && p.r < ROWS && p.c < COLS; });
}
function rot(cells) {
  return cells.map(function (p) { return [p[1], -p[0]]; });
}
function norm(cells) {
  var minR = 99, minC = 99;
  cells.forEach(function (p) { if (p[0] < minR) minR = p[0]; if (p[1] < minC) minC = p[1]; });
  return cells.map(function (p) { return [p[0] - minR, p[1] - minC]; }).sort(function (a, b) {
    return a[0] - b[0] || a[1] - b[1];
  });
}
var shapes = [];
function addShape(raw) {
  var cur = raw;
  for (var k = 0; k < 4; k++) {
    var n = norm(cur);
    var id = n.map(function (p) { return p[0] + "." + p[1]; }).join(",");
    if (!shapes.some(function (s) { return s.id === id; })) shapes.push({ id: id, cells: n });
    cur = rot(cur);
  }
}
addShape([[0,0],[0,1]]);
addShape([[0,0],[0,1],[0,2]]);
addShape([[0,0],[0,1],[0,2],[0,3]]);
addShape([[0,0],[0,1],[1,1]]);
addShape([[0,0],[0,1],[0,2],[1,2]]);
addShape([[0,0],[1,0],[1,1],[1,2]]);
addShape([[0,0],[0,1],[0,2],[0,3],[1,3]]);
addShape([[0,1],[1,0],[1,1],[1,2]]);
addShape([[0,0],[0,1],[1,1],[1,2]]);

function levelOf(extra) {
  return {
    cols: COLS, rows: ROWS,
    bolts: [
      { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
      { id: 1, color: 1, cells: extra }
    ]
  };
}
function boltBy(level, id) { return level.bolts.find(function (b) { return b.id === id; }); }
function extracts(level, id) {
  var b = boltBy(level, id);
  if (!b) return false;
  return BT.slideDirs(b).some(function (d) { return BT.slideInfo(level, b, d).extracts; });
}
function apply(level, id, dir, n) {
  var play = level;
  for (var i = 0; i < n; i++) {
    var b = boltBy(play, id);
    if (!b) return play;
    var stepped = BT.stepBolt(play, b, dir);
    if (!stepped) return null;
    play = stepped.level;
    if (stepped.extracted) return play;
  }
  return play;
}

var hits = [];
var tried = 0, blockedU = 0, both = 0;
shapes.forEach(function (shape) {
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var extra = shape.cells.map(function (p) { return { r: p[0] + r, c: p[1] + c }; });
      if (!onBoard(extra) || overlaps(U, extra)) continue;
      tried++;
      var start = BT.normalizeLevel(levelOf(extra));
      if (extracts(start, 0)) continue;
      blockedU++;
      if (extracts(start, 1)) continue;
      both++;
      var solved = BT.solve(start, 4000);
      if (!solved.winnable) continue;
      var play = start;
      var uMoved = false;
      var otherGoneAt = -1;
      var uGoneAt = -1;
      var uCouldExitBefore = false;
      for (var s = 0; s < solved.moves.length; s++) {
        var mv = solved.moves[s];
        if (mv.id === 0 && boltBy(play, 1)) uMoved = true;
        if (otherGoneAt < 0 && extracts(play, 0)) uCouldExitBefore = true;
        var b = boltBy(play, mv.id);
        var stepped = BT.stepBolt(play, b, mv.dir);
        play = stepped.level;
        if (otherGoneAt < 0 && !boltBy(play, 1)) otherGoneAt = s;
        if (uGoneAt < 0 && !boltBy(play, 0)) uGoneAt = s;
      }
      if (otherGoneAt < 0 || uGoneAt < otherGoneAt) continue;
      if (!uMoved) continue;
      if (uCouldExitBefore) continue;
      hits.push({
        cells: extra.map(function (p) { return p.r + "," + p.c; }).join(" "),
        moves: (solved.moves || []).map(function (m) { return m.id + m.dir; }).join(">"),
        otherGoneAt: otherGoneAt,
        uGoneAt: uGoneAt
      });
    }
  }
});
"tried " + tried + " blockedU " + blockedU + " both " + both + " wins " + hits.length + "\n" +
hits.slice(0, 12).map(function (h) {
  return "other@" + h.otherGoneAt + " u@" + h.uGoneAt + " " + h.moves + " :: " + h.cells;
}).join("\n");
