ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
eval(readText(root + "src/generate.js"));
var BT = globalThis.BT;

function sig(bolt) {
  return bolt.cells.map(function (p) { return p.r + "," + p.c; }).join(" ") + " nut " + bolt.nut.r + "," + bolt.nut.c;
}
function go(level, id, dir, n) {
  for (var i = 0; i < n; i++) {
    var b = level.bolts.find(function (x) { return x.id === id; });
    if (!b) return level;
    var stepped = BT.stepBolt(level, b, dir);
    if (!stepped) return level;
    level = stepped.level;
  }
  return level;
}
var west = BT.handLevels()[2].deal;
var g0 = west.bolts[1];
var start = sig(g0);
var infoN = BT.slideInfo(west, g0, "N");
var up = go(west, 1, "N", infoN.steps);
var back = go(up, 1, "S", infoN.steps);
var parked = go(west, 1, "N", 2);
var restored = go(parked, 1, "S", 2);
var red = west.bolts[0];
var redInfo = BT.slideDirs(red, west).map(function (d) {
  var s = BT.slideInfo(west, red, d);
  return d + s.steps + (s.extracts ? "X" : "");
}).join(",");
function still(level, id) {
  var b = level.bolts.find(function (x) { return x.id === id; });
  return b ? sig(b) : "GONE";
}
var lines = [];
lines.push("green N " + infoN.steps + (infoN.extracts ? "X" : ""));
lines.push("full then back " + still(back, 1));
lines.push("match full " + (still(back, 1) === start || !back.bolts.some(function (b) { return b.id === 1; })));
lines.push("park2 " + still(parked, 1));
var parkedBolt = parked.bolts.find(function (x) { return x.id === 1; });
lines.push("park dirs " + (parkedBolt ? BT.slideDirs(parkedBolt, parked).map(function (d) {
  var s = BT.slideInfo(parked, parkedBolt, d);
  return d + s.steps + (s.extracts ? "X" : "");
}).join(",") : "GONE"));
lines.push("back2 " + still(restored, 1));
lines.push("restored " + (still(restored, 1) === start));
lines.push("red " + redInfo);
BT.handLevels().forEach(function (h) {
  var solved = BT.solve(h.deal, 20000);
  lines.push(h.name + " " + (solved.winnable ? "WIN" : "FAIL") + " v" + solved.visited);
});
lines.join("\n");
