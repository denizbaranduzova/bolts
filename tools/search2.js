ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
function rot(cells) { return cells.map(function (p) { return [p[1], -p[0]]; }); }
function norm(cells) {
  var minR = 99, minC = 99;
  cells.forEach(function (p) { if (p[0] < minR) minR = p[0]; if (p[1] < minC) minC = p[1]; });
  return cells.map(function (p) { return [p[0] - minR, p[1] - minC]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
}
var shapes = [];
function addShape(raw) {
  var cur = raw;
  for (var k = 0; k < 4; k++) {
    var n = norm(cur);
    var id = n.map(function (p) { return p[0] + "." + p[1]; }).join(",");
    if (!shapes.some(function (s) { return s.id === id; })) shapes.push(n);
    cur = rot(cur);
  }
}
addShape([[0,0],[0,1]]);
addShape([[0,0],[0,1],[0,2]]);
addShape([[0,0],[0,1],[1,1]]);
addShape([[0,0],[0,1],[0,2],[1,2]]);
addShape([[0,0],[1,0],[1,1],[1,2]]);
addShape([[0,0],[0,1],[1,1],[1,2]]);
addShape([[0,0],[0,1],[0,2],[0,3],[1,3]]);
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
var COLS = 8, ROWS = 8;
function key(p) { return p.r + "," + p.c; }
function overlaps(a, b) {
  var s = {};
  a.forEach(function (p) { s[key(p)] = 1; });
  return b.some(function (p) { return s[key(p)]; });
}
function boltBy(level, id) { return level.bolts.find(function (b) { return b.id === id; }); }
function extracts(level, id) {
  var b = boltBy(level, id);
  if (!b) return true;
  return BT.slideDirs(b).some(function (d) { return BT.slideInfo(level, b, d).extracts; });
}
function applyDir(level, id, dir) {
  var b = boltBy(level, id);
  if (!b) return null;
  var stepped = BT.stepBolt(level, b, dir);
  return stepped ? stepped.level : null;
}
function untilExit(level) {
  if (extracts(level, 1)) return [];
  var queue = [{ level: level, path: [] }];
  var seen = {};
  seen[BT.levelSignature(level)] = 1;
  var guard = 0;
  while (queue.length && guard < 500) {
    guard++;
    var cur = queue.shift();
    if (cur.path.length >= 4) continue;
    var b = boltBy(cur.level, 1);
    if (!b) continue;
    var dirs = BT.slideDirs(b);
    for (var i = 0; i < dirs.length; i++) {
      var nxt = applyDir(cur.level, 1, dirs[i]);
      if (!nxt) continue;
      var k = BT.levelSignature(nxt);
      if (seen[k]) continue;
      seen[k] = 1;
      var path = cur.path.concat(dirs[i]);
      if (!boltBy(nxt, 1) || extracts(nxt, 1)) return path;
      queue.push({ level: nxt, path: path });
    }
  }
  return null;
}
var hits = [];
shapes.forEach(function (shape) {
  for (var r = 0; r < ROWS; r++) {
    for (var c = 0; c < COLS; c++) {
      var extra = shape.map(function (p) { return { r: p[0] + r, c: p[1] + c }; });
      if (extra.some(function (p) { return p.r < 0 || p.c < 0 || p.r >= ROWS || p.c >= COLS; })) continue;
      if (overlaps(U, extra)) continue;
      var start = BT.normalizeLevel({
        cols: COLS, rows: ROWS,
        bolts: [
          { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
          { id: 1, color: 1, cells: extra }
        ]
      });
      if (extracts(start, 0) || extracts(start, 1)) continue;
      var u = boltBy(start, 0);
      BT.slideDirs(u).forEach(function (dir) {
        var info = BT.slideInfo(start, u, dir);
        if (info.extracts || info.steps < 1) return;
        var nudged = applyDir(start, 0, dir);
        if (!nudged || extracts(nudged, 0)) return;
        var path = untilExit(nudged);
        if (!path) return;
        var end = nudged;
        path.forEach(function (d) { end = applyDir(end, 1, d); });
        if (!extracts(end, 1) && boltBy(end, 1)) return;
        if (extracts(end, 0)) return;
        if (boltBy(end, 1)) {
          var b = boltBy(end, 1);
          var exitDir = null;
          BT.slideDirs(b).forEach(function (d) {
            if (!exitDir && BT.slideInfo(end, b, d).extracts) exitDir = d;
          });
          end = end;
          var guard = BT.slideInfo(end, b, exitDir).steps;
          while (guard-- > 0 && boltBy(end, 1)) end = applyDir(end, 1, exitDir);
        }
        if (boltBy(end, 1) || !extracts(end, 0)) return;
        hits.push({
          setup: path.length,
          cells: extra.map(function (p) { return p.r + "," + p.c; }).join(" "),
          nudge: dir,
          path: path.join("")
        });
      });
    }
  }
});
hits.sort(function (a, b) { return a.setup - b.setup; });
"hits " + hits.length + "\n" + hits.slice(0, 16).map(function (h) {
  return h.nudge + " then " + h.path + " (" + h.setup + ") :: " + h.cells;
}).join("\n");
