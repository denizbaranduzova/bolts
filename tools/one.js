ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
var level = BT.normalizeLevel({
  cols: 8, rows: 6,
  bolts: [
    { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
    { id: 1, color: 2, cells: P([[1,2],[1,3],[2,3],[2,4]]) }
  ]
});
var solved = BT.solve(level, 20000);
solved.winnable + " v" + solved.visited + " " + (solved.moves || []).map(function (m) { return m.id + m.dir; }).join(">");
