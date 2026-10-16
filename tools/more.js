ObjC.import("Foundation");
function readText(path) {
  return ObjC.unwrap($.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null));
}
eval(readText("/Users/denizbaranduzova/Desktop/Bolts/src/engine.js"));
var BT = globalThis.BT;
function P(list) { return list.map(function (p) { return { r: p[0], c: p[1] }; }); }
var U = P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]);
function run(name, bolts) {
  return name + " n " + (bolts && bolts.length) + " c0 " + (bolts[0] && bolts[0].cells && bolts[0].cells.length);
}
function uBolt() {
  return { id: 0, color: 0, cells: P([[2,1],[3,1],[4,1],[5,1],[5,2],[5,3],[5,4],[5,5],[4,5],[3,5],[2,5]]), nut: { r: 5, c: 3 } };
}
[
  run("mirror", [uBolt(), { id: 1, color: 3, cells: P([[0,1],[0,2],[1,2],[2,2]]) }]),
  run("long", [uBolt(), { id: 1, color: 4, cells: P([[0,4],[0,5],[1,4],[2,4],[3,4]]) }]),
  run("pair", [uBolt(),
    { id: 1, color: 2, cells: P([[0,4],[0,5],[1,4],[2,4]]) },
    { id: 2, color: 3, cells: P([[0,1],[0,2],[1,2],[2,2]]) }
  ])
].join("\n");
