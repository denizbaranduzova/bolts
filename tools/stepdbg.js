ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
var level = BT.normalizeLevel({ cols: 8, rows: 8, bolts: [{ id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } }] });
var lines = [];
var info = BT.slideInfo(level, level.bolts[0], "N");
lines.push("info " + JSON.stringify(info));
var play = level;
for (var i = 0; i < 8; i++) {
  var b = play.bolts[0];
  if (!b) { lines.push("gone at " + i); break; }
  var mode = BT.moveMode(b, "N");
  var stepped = BT.stepBolt(play, b, "N");
  lines.push(i + " cells " + b.cells.length + " cross " + b.cross + " mode " + mode + " tips " + BT.pullDirs(b).join("") + " step " + (stepped ? (stepped.extracted ? "OUT" : "ok " + stepped.bolt.cells.length) : "NULL") + " legal " + BT.legalMoves(play).map(function (m) { return m.dir + (m.extracted ? "X" : ""); }).join(","));
  if (!stepped) break;
  play = stepped.level;
}
var moves = BT.legalMoves(level);
lines.push("legal " + moves.map(function (m) { return m.dir + (m.extracted ? "X" : ""); }).join(","));
lines.join("\n");
