ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
function pack(name, extra) {
  var level = BT.normalizeLevel({
    cols: 8, rows: 6,
    bolts: [
      { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
      { id: 1, color: 2, cells: P(extra) }
    ]
  });
  var solved = BT.solve(level, 20000);
  var startFree = level.bolts.some(function (b) {
    return BT.slideDirs(b).some(function (d) { return BT.slideInfo(level, b, d).extracts; });
  });
  var nuts = level.bolts.map(function (b) {
    return b.id + "@" + b.nut.r + "," + b.nut.c + " " + b.shape;
  }).join(" ");
  return name + " " + (solved.winnable ? "WIN" : "FAIL") + " freeExit " + startFree + " v" + solved.visited + " " + nuts + " :: " +
    (solved.moves || []).slice(0, 8).map(function (m) { return m.id + m.dir; }).join(">");
}
[
  pack("nudge", [[1,2],[1,3],[2,3],[2,4]]),
  pack("hook", [[0,4],[0,5],[1,4],[2,4]]),
  pack("aside", [[0,2],[0,3],[1,2],[2,2]]),
  pack("weave", [[1,1],[1,2],[2,2],[2,3]])
].join("\n");
