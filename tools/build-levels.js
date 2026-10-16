ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
function writeText(path, text) {
  var s = $.NSString.alloc.initWithUTF8String(text);
  var ok = s.writeToFileAtomicallyEncodingError(path, true, $.NSUTF8StringEncoding, null);
  return ok;
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
eval(readText(root + "src/generate.js"));
var BT = globalThis.BT;

function slim(info) {
  info = info || {};
  return {
    winnable: !!info.winnable,
    opening: info.opening || 0,
    bottleneck: info.bottleneck || 0,
    cascade: info.cascade || 0,
    forced: info.forced || 0,
    shapes: info.shapes || { I: 0, L: 0, C: 0, S: 0 },
    bolts: info.bolts || 0
  };
}

var levels = BT.handLevels().map(function (h) {
  var info = BT.analyze(h.deal);
  return { id: h.id, name: h.name, spec: h.spec, deal: h.deal, info: slim(info) };
});

var gens = [
  ["easy", 11, "Easy line"],
  ["easy", 29, "Easy bend"],
  ["medium", 41, "Med lock"],
  ["medium", 73, "Med pocket"],
  ["hard", 91, "Hard knot"],
  ["hard", 127, "Hard weave"]
];
var notes = [];
gens.forEach(function (g) {
  var spec = BT.applyBand(BT.defaultSpec(), g[0]);
  spec.seed = 8000 + g[1] * 13;
  var pack = BT.generate(spec, 64);
  var info = pack.info && pack.info.winnable ? pack.info : BT.analyze(pack.level);
  if (!info.winnable || !pack.level.bolts.length) {
    notes.push("SKIP " + g[2]);
    return;
  }
  levels.push({
    id: "g-" + g[0] + "-" + pack.seed,
    name: g[2],
    spec: pack.spec,
    deal: pack.level,
    info: slim(info)
  });
  var grid = [];
  for (var r = 0; r < pack.level.rows; r++) {
    var line = "";
    for (var c = 0; c < pack.level.cols; c++) {
      var b = BT.boltAt(pack.level, r, c);
      line += b ? "ILCS".charAt("ILCS".indexOf(b.shape)) : ".";
      line += b ? (b.color % 10) : ".";
    }
    grid.push(line);
  }
  notes.push(g[2] + " open " + info.opening + " " + JSON.stringify(info.shapes) + " seed " + pack.seed);
});

var payload = { rev: Date.now(), levels: levels };
var blob = JSON.stringify(payload);
writeText(root + "levels.json", blob);

var indexPath = root + "index.html";
var html = readText(indexPath);
var needle = "window.EMBEDDED_LEVELS = ";
var at = html.indexOf(needle);
if (at < 0) throw new Error("embed needle missing");
var jsonStart = at + needle.length;
var end = html.indexOf(";", jsonStart);
html = html.slice(0, jsonStart) + blob + html.slice(end);
writeText(indexPath, html);

levels.map(function (lv) {
  return lv.name + " " + (lv.info.winnable ? "WIN" : "FAIL") + " open " + lv.info.opening + " bolts " + lv.info.bolts;
}).join("\n") + "\n" + notes.join("\n");
