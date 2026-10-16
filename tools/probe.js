ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
var BT = globalThis.BT;

function bolt(id, color, cells, nut) {
  return { id: id, color: color, cells: cells.map(function (p) { return { r: p[0], c: p[1] }; }), nut: nut };
}

var Ucells = [[1,1],[2,1],[3,1],[4,1],[4,2],[4,3],[4,4],[4,5],[3,5],[2,5],[1,5]];
var lone = BT.normalizeLevel({
  cols: 7, rows: 6,
  bolts: [bolt(0, 0, Ucells, { r: 4, c: 3 })]
});
var u = lone.bolts[0];
var lines = [];
lines.push("nut " + u.nut.r + "," + u.nut.c + " axis " + BT.axisDirs(u).join("") + " tips " + BT.pullDirs(u).join(""));
["N","E","S","W"].forEach(function (d) {
  var info = BT.slideInfo(lone, u, d);
  lines.push(d + " steps " + info.steps + " extract " + info.extracts + " mode " + info.mode);
});

function report(name, level) {
  var board = BT.normalizeLevel(level);
  var parts = board.bolts.map(function (b) {
    return b.id + BT.shapeOf(b.cells) + ":" + BT.slideDirs(b).map(function (d) {
      var info = BT.slideInfo(board, b, d);
      return d + info.steps + (info.extracts ? "X" : "n");
    }).join(",");
  }).join(" | ");
  var solved = BT.solve(board, 12000);
  lines.push(name + " :: " + parts);
  lines.push("  win " + solved.winnable + " open " + solved.opening + " visited " + solved.visited + " moves " + (solved.moves || []).map(function (m) { return m.id + m.dir; }).join(">"));
}

lines.join("\n");
