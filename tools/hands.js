ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
eval(readText(root + "src/generate.js"));
var BT = globalThis.BT;
BT.handLevels().map(function (h) {
  var info = BT.solve(h.deal, 20000);
  var bits = h.deal.bolts.map(function (b) {
    return b.id + "@" + b.nut.r + "," + b.nut.c + " " + BT.slideDirs(b).map(function (d) {
      var s = BT.slideInfo(h.deal, b, d);
      return d + s.steps + (s.extracts ? "X" : "");
    }).join(",");
  }).join(" | ");
  return h.name + " " + (info.winnable ? "WIN" : "FAIL") + " v" + info.visited + " " + bits;
}).join("\n");
