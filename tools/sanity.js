ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
function show(name, raw) {
  var board = BT.normalizeLevel(raw);
  var solved = BT.solve(board, 8000);
  var bits = board.bolts.map(function (b) {
    return b.id + (b.shape || "?") + "[" + BT.slideDirs(b).map(function (d) {
      var info = BT.slideInfo(board, b, d);
      return d + info.steps + (info.extracts ? "X" : "");
    }).join(",") + "]";
  }).join(" ");
  return name + " " + bits + " => " + (solved.winnable ? "WIN" : "FAIL") + " v" + solved.visited + " " +
    (solved.moves || []).map(function (m) { return m.id + m.dir; }).join(">");
}
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
var lines = [];
lines.push(show("lone", { cols: 8, rows: 8, bolts: [{ id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } }] }));
lines.push(show("freeI", { cols: 8, rows: 8, bolts: [
  { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
  { id: 1, color: 1, cells: P([[0,7],[1,7]]) }
] }));
lines.push(show("cap", { cols: 8, rows: 8, bolts: [
  { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
  { id: 1, color: 1, cells: P([[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[1,5]]) }
] }));
lines.join("\n");
