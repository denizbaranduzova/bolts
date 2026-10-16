ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
function canFreeLatch(extra) {
  var start = BT.normalizeLevel({
    cols: 8, rows: 6,
    bolts: [
      { id: 0, color: 0, cells: U, nut: { r: 5, c: 3 } },
      { id: 1, color: 2, cells: P(extra) }
    ]
  });
  var queue = [start];
  var seen = {};
  seen[BT.levelSignature(start)] = 1;
  var n = 0;
  while (queue.length && n < 800) {
    n++;
    var cur = queue.shift();
    var b = cur.bolts.find(function (x) { return x.id === 1; });
    if (!b) return "REMOVED " + n;
    if (BT.slideDirs(b).some(function (d) { return BT.slideInfo(cur, b, d).extracts; })) return "CANEXIT " + n;
    BT.slideDirs(b).forEach(function (d) {
      var stepped = BT.stepBolt(cur, b, d);
      if (!stepped) return;
      var k = BT.levelSignature(stepped.level);
      if (seen[k]) return;
      seen[k] = 1;
      queue.push(stepped.level);
    });
  }
  return "STUCK " + n;
}
[
  "a " + canFreeLatch([[0,2],[0,3],[1,2],[2,2]]),
  "b " + canFreeLatch([[0,3],[0,4],[1,3],[2,3]]),
  "hook " + canFreeLatch([[0,4],[0,5],[1,4],[2,4]]),
  "d " + canFreeLatch([[1,2],[1,3],[2,3],[2,4]]),
  "e " + canFreeLatch([[1,1],[1,2],[2,2],[2,3]]),
  "f " + canFreeLatch([[0,2],[0,3],[1,2],[2,2],[3,2]]),
  "g " + canFreeLatch([[0,3],[0,4],[1,3],[2,3],[3,3]]),
  "h " + canFreeLatch([[0,4],[0,5],[1,4],[2,4],[3,4]])
].join("\n");
