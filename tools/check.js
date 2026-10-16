ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
eval(readText(root + "src/generate.js"));
var BT = globalThis.BT;
var lines = [];
BT.handLevels().forEach(function (h) {
  var info = BT.analyze(h.deal);
  var bits = h.deal.bolts.map(function (b) {
    return (b.shape || "?") + " " + BT.ends(b).map(function (e) {
      return e.dir + (BT.canPull(h.deal, b, e.dir) ? "+" : "-");
    }).join("/");
  }).join(" | ");
  lines.push([h.name, info.winnable ? "WIN" : "FAIL", "open", info.opening, "forced", info.forced, "path", (info.path || []).join(">"), bits].join(" "));
});
["easy", "medium", "hard"].forEach(function (band) {
  var spec = BT.applyBand(BT.defaultSpec(), band);
  spec.seed = 4000 + spec.bolts * 17;
  var pack = BT.generate(spec, 80);
  var info = pack.info || {};
  lines.push([
    "GEN", band, info.winnable ? "WIN" : "FAIL",
    "bolts", info.bolts, "open", info.opening,
    "I", info.shapes && info.shapes.I, "L", info.shapes && info.shapes.L,
    "C", info.shapes && info.shapes.C, "S", info.shapes && info.shapes.S,
    "score", Math.round(pack.score || 0), "seed", pack.seed
  ].join(" "));
});
lines.join("\n");
