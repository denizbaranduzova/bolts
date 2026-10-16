ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
function paint(level) {
  var rows = [];
  for (var r = 0; r < level.rows; r++) {
    var line = "";
    for (var c = 0; c < level.cols; c++) {
      var b = BT.boltAt(level, r, c);
      if (!b) line += ".";
      else {
        var nut = b.nut && b.nut.r === r && b.nut.c === c;
        line += nut ? (b.id === 0 ? "O" : "o") : (b.id === 0 ? "#" : "+");
      }
    }
    rows.push(line);
  }
  return rows.join("\n");
}
function dirs(level, id) {
  var b = level.bolts.find(function (x) { return x.id === id; });
  if (!b) return "gone";
  return BT.slideDirs(b).map(function (d) {
    var info = BT.slideInfo(level, b, d);
    return d + info.steps + (info.extracts ? "X" : "");
  }).join(",");
}
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
function show(title, cells, nudge, then) {
  var level = BT.normalizeLevel({
    cols: 8, rows: 8,
    bolts: [
      { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
      { id: 1, color: 2, cells: P(cells) }
    ]
  });
  var lines = [title, "START # " + dirs(level, 0) + " | + " + dirs(level, 1), paint(level)];
  var play = level;
  var steps = [nudge].concat(then);
  steps.forEach(function (d, i) {
    var id = i === 0 ? 0 : 1;
    var b = play.bolts.find(function (x) { return x.id === id; });
    play = BT.stepBolt(play, b, d).level;
    lines.push("AFTER " + id + d + "  # " + dirs(play, 0) + " | + " + dirs(play, 1));
    lines.push(paint(play));
  });
  return lines.join("\n");
}
[
  show("near", [[1,2],[1,3],[2,3],[2,4]], "E", ["E", "N"]),
  show("high", [[0,4],[0,5],[1,4],[2,4]], "E", ["E", "N"])
].join("\n\n");
