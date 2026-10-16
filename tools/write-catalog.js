ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
var root = "/Users/denizbaranduzova/Desktop/Bolts/";
eval(readText(root + "src/engine.js"));
eval(readText(root + "src/generate.js"));
var BT = globalThis.BT;
var levels = BT.handLevels().map(function (h) {
  return { id: h.id, name: h.name, spec: h.spec, deal: h.deal };
});
var body = JSON.stringify({ rev: Date.now(), levels: levels });
var ns = $.NSString.alloc.initWithUTF8String(body);
var ok = ns.writeToFileAtomicallyEncodingError(root + "levels.json", true, $.NSUTF8StringEncoding, null);
"wrote " + body.length + " " + ok;
