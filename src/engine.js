(function (factory) {
  const g = typeof globalThis !== "undefined" ? globalThis : this;
  const BT = (g.BT = g.BT || {});
  factory(BT);
  if (typeof module !== "undefined" && module.exports) module.exports = BT;
})(function (BT) {
  "use strict";

  // A bolt is a rigid polyline (straight, L, C, S). It never rotates.
  // Nuts are fixed grid cells. The shaft slides through them along their axis
  // and a bend cannot enter a nut. A C has two nuts, one mid-arm, so the open
  // tips can feed through and the piece can leave. The step that clears every
  // nut destroys the bolt. A bolt that is still on the board stays inside it.

  BT.DIRS = {
    N: { dr: -1, dc: 0 },
    E: { dr: 0, dc: 1 },
    S: { dr: 1, dc: 0 },
    W: { dr: 0, dc: -1 }
  };
  BT.DIR_LIST = ["N", "E", "S", "W"];
  BT.SCREEN = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } };

  BT.PALETTE = [
    { name: "blue", fill: "#2F8FE8", shadow: "#1E6BB8", light: "#8EC4F5", ink: "#164E86" },
    { name: "red", fill: "#E23B48", shadow: "#B42330", light: "#F4A0A6", ink: "#8A1822" },
    { name: "yellow", fill: "#F0B429", shadow: "#C48E14", light: "#F8D98A", ink: "#8A6410" },
    { name: "green", fill: "#3CB85A", shadow: "#2A8A42", light: "#9AD9A8", ink: "#1A5C2C" },
    { name: "purple", fill: "#A44EE0", shadow: "#7C32B0", light: "#D4A8F0", ink: "#5A2088" },
    { name: "orange", fill: "#F07A22", shadow: "#C45C10", light: "#F8B888", ink: "#8A3E08" },
    { name: "cyan", fill: "#14B4C8", shadow: "#0C8898", light: "#8ADCE6", ink: "#086878" },
    { name: "pink", fill: "#E85A90", shadow: "#C03870", light: "#F4A8C4", ink: "#8A2854" },
    { name: "lime", fill: "#8BC434", shadow: "#6A9618", light: "#C4E48A", ink: "#4A6C10" },
    { name: "teal", fill: "#12B48A", shadow: "#0C8A68", light: "#8ADCC4", ink: "#086848" },
    { name: "indigo", fill: "#5C74E8", shadow: "#3E52C0", light: "#B0BCF4", ink: "#243488" },
    { name: "amber", fill: "#F0A018", shadow: "#C48008", light: "#F8D088", ink: "#8A5C08" }
  ];

  BT.clone = function (x) { return JSON.parse(JSON.stringify(x)); };
  BT.halfGrid = true;
  BT.showArrows = false;
  BT.showAvailables = false;
  // Jewel tiles and the raised Plain 2 collar are the default look.
  BT.blockSkin = false;
  BT.jewelSkin = true;
  BT.lockStyle = "plain2";
  BT.key = function (r, c) { return r + "," + c; };

  BT.mulberry32 = function (seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  BT.pick = function (rng, list) { return list[Math.floor(rng() * list.length)]; };

  BT.shuffle = function (rng, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  };

  BT.colorOf = function (index) { return BT.PALETTE[((index % BT.PALETTE.length) + BT.PALETTE.length) % BT.PALETTE.length]; };

  BT.stepDir = function (from, to) {
    const dr = to.r - from.r;
    const dc = to.c - from.c;
    if (dr === -1 && dc === 0) return "N";
    if (dr === 1 && dc === 0) return "S";
    if (dc === 1 && dr === 0) return "E";
    if (dc === -1 && dr === 0) return "W";
    return null;
  };

  BT.orderChain = function (cells) {
    const uniq = [];
    const seen = {};
    (cells || []).forEach(function (p) {
      const k = p.r + "," + p.c;
      if (seen[k]) return;
      seen[k] = true;
      uniq.push({ r: p.r, c: p.c });
    });
    if (uniq.length < 2) return uniq;
    function nbs(p) {
      const o = [];
      BT.DIR_LIST.forEach(function (dir) {
        const d = BT.DIRS[dir];
        const q = { r: p.r + d.dr, c: p.c + d.dc };
        if (seen[q.r + "," + q.c]) o.push(q);
      });
      return o;
    }
    const tips = uniq.filter(function (p) { return nbs(p).length === 1; });
    if (!tips.length) return uniq;
    const path = [tips[0]];
    const used = {};
    used[tips[0].r + "," + tips[0].c] = true;
    while (path.length < uniq.length) {
      const cur = path[path.length - 1];
      const nxt = nbs(cur).filter(function (q) { return !used[q.r + "," + q.c]; });
      if (!nxt.length) return uniq;
      used[nxt[0].r + "," + nxt[0].c] = true;
      path.push(nxt[0]);
    }
    return path;
  };

  BT.ends = function (bolt) {
    const cells = (bolt && bolt.cells) || [];
    if (cells.length < 2) return [];
    const d0 = BT.stepDir(cells[1], cells[0]);
    const d1 = BT.stepDir(cells[cells.length - 2], cells[cells.length - 1]);
    const out = [];
    if (d0) out.push({ at: "a", dir: d0, r: cells[0].r, c: cells[0].c });
    if (d1) out.push({ at: "b", dir: d1, r: cells[cells.length - 1].r, c: cells[cells.length - 1].c });
    return out;
  };

  BT.pullDirs = function (bolt) {
    const seen = {};
    const out = [];
    BT.ends(bolt).forEach(function (e) {
      if (!seen[e.dir]) {
        seen[e.dir] = true;
        out.push(e.dir);
      }
    });
    return out;
  };

  BT.shapeOf = function (cells) {
    const chain = cells || [];
    if (chain.length < 2) return "I";
    const signs = [];
    for (let i = 1; i < chain.length - 1; i++) {
      const d1 = BT.stepDir(chain[i - 1], chain[i]);
      const d2 = BT.stepDir(chain[i], chain[i + 1]);
      if (!d1 || !d2 || d1 === d2) continue;
      const a = BT.DIRS[d1];
      const b = BT.DIRS[d2];
      const cross = a.dc * b.dr - a.dr * b.dc;
      if (cross > 0) signs.push(1);
      else if (cross < 0) signs.push(-1);
    }
    if (!signs.length) return "I";
    if (signs.length === 1) return "L";
    const same = signs.every(function (s) { return s === signs[0]; });
    return same ? "C" : "S";
  };

  BT.normalizeLevel = function (raw) {
    const cols = Math.max(4, Math.min(24, +(raw && raw.cols) || 7));
    const rows = Math.max(4, Math.min(24, +(raw && raw.rows) || 7));
    const src = (raw && (raw.bolts || raw.blocks)) || [];
    const bolts = src.map(function (b, i) {
      const cells = BT.orderChain((b.cells || []).map(function (p) {
        return { r: +p.r, c: +p.c };
      }).filter(function (p) {
        return p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols;
      }));
      const shape = BT.shapeOf(cells);
      const given = BT.givenNuts(cells, b);
      let nuts = given;
      if ((shape === "C" || shape === "S") && nuts.length < 2) nuts = BT.placeNuts(cells);
      if (!nuts.length) nuts = BT.placeNuts(cells);
      return {
        id: b.id != null ? b.id : i,
        color: b.color != null ? +b.color : i,
        cells: cells,
        shape: shape,
        nut: nuts[0] || null,
        nuts: nuts,
        escaping: null,
        cross: b.cross || null,
        axis: b.axis || null
      };
    }).filter(function (b) { return b.cells.length >= 2; });
    return { cols: cols, rows: rows, bolts: bolts };
  };

  BT.OPP = { N: "S", S: "N", E: "W", W: "E" };

  BT.nutOnCells = function (cells, preferred) {
    if (preferred && cells.some(function (p) { return p.r === preferred.r && p.c === preferred.c; })) {
      return { r: preferred.r, c: preferred.c };
    }
    const bends = [];
    for (let i = 1; i < cells.length - 1; i++) {
      const d1 = BT.stepDir(cells[i - 1], cells[i]);
      const d2 = BT.stepDir(cells[i], cells[i + 1]);
      if (d1 && d2 && d1 !== d2) bends.push(i);
    }
    let idx = Math.floor((cells.length - 1) / 2);
    if (bends.length >= 2) idx = Math.round((bends[0] + bends[bends.length - 1]) / 2);
    else if (bends.length === 1) {
      const b = bends[0];
      const before = b;
      const after = cells.length - 1 - b;
      idx = before >= after ? Math.max(0, b - 1) : Math.min(cells.length - 1, b + 1);
    }
    return { r: cells[idx].r, c: cells[idx].c };
  };

  BT.occupyMap = function (bolts, skipId) {
    const map = new Map();
    (bolts || []).forEach(function (b) {
      if (skipId != null && b.id === skipId) return;
      b.cells.forEach(function (p) { map.set(BT.key(p.r, p.c), b.id); });
      BT.nutsOf(b).forEach(function (n) { map.set(BT.key(n.r, n.c), b.id); });
    });
    return map;
  };

  function worldOf(bolt) {
    const sh = (bolt && bolt.shift) || { dr: 0, dc: 0 };
    return (bolt.cells || []).map(function (p) {
      return { r: p.r + (sh.dr || 0), c: p.c + (sh.dc || 0) };
    });
  }

  function nutWorld(bolt) {
    const sh = bolt && bolt.shiftNuts ? (bolt.shift || { dr: 0, dc: 0 }) : { dr: 0, dc: 0 };
    return BT.nutsOf(bolt).map(function (n) {
      return { r: n.r + (sh.dr || 0), c: n.c + (sh.dc || 0) };
    });
  }

  function nearestBolt(level, r, c, bodies) {
    let best = null;
    let bestD = 0.56;
    (level.bolts || []).forEach(function (b) {
      bodies(b).forEach(function (p) {
        const d = Math.max(Math.abs(p.r - r), Math.abs(p.c - c));
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      });
    });
    return best;
  }

  BT.boltAt = function (level, r, c) {
    return nearestBolt(level, r, c, function (b) { return worldOf(b).concat(nutWorld(b)); });
  };

  // The colored shaft only. A nut left behind on its square is not a handle.
  BT.boltBodyAt = function (level, r, c) {
    return nearestBolt(level, r, c, worldOf);
  };

  BT.inBoard = function (level, p) {
    return p.r >= 0 && p.c >= 0 && p.r < level.rows && p.c < level.cols;
  };

  BT.cellIndex = function (bolt, p) {
    if (!bolt || !p) return -1;
    for (let i = 0; i < bolt.cells.length; i++) {
      if (bolt.cells[i].r === p.r && bolt.cells[i].c === p.c) return i;
    }
    return -1;
  };

  BT.isBendIndex = function (cells, i) {
    if (i <= 0 || i >= cells.length - 1) return false;
    const d1 = BT.stepDir(cells[i - 1], cells[i]);
    const d2 = BT.stepDir(cells[i], cells[i + 1]);
    return !!(d1 && d2 && d1 !== d2);
  };

  BT.nutsOf = function (bolt) {
    if (!bolt) return [];
    if (bolt.nuts && bolt.nuts.length) return bolt.nuts;
    if (bolt.nut) return [bolt.nut];
    return [];
  };

  BT.givenNuts = function (cells, raw) {
    const out = [];
    const seen = {};
    const list = ((raw && raw.nuts) || []).concat(raw && raw.nut ? [raw.nut] : []);
    list.forEach(function (n) {
      if (!n) return;
      const p = { r: +n.r, c: +n.c };
      const key = p.r + "," + p.c;
      if (seen[key]) return;
      if (!cells.some(function (c) { return c.r === p.r && c.c === p.c; })) return;
      if (BT.isBendIndex(cells, BT.cellIndex({ cells: cells }, p))) return;
      seen[key] = true;
      out.push(p);
    });
    return out;
  };

  function bendList(cells) {
    const bends = [];
    for (let i = 1; i < cells.length - 1; i++) {
      if (BT.isBendIndex(cells, i)) bends.push(i);
    }
    return bends;
  }

  function endArms(cells, bends) {
    const first = [];
    for (let i = 0; i < bends[0]; i++) first.push(i);
    const last = bends[bends.length - 1];
    const second = [];
    for (let i = cells.length - 1; i > last; i--) second.push(i);
    return [first, second];
  }

  function seatOnArm(indexes) {
    if (!indexes || !indexes.length) return -1;
    if (indexes.length === 1) return indexes[0];
    const inner = indexes.slice(1);
    return inner[Math.floor((inner.length - 1) / 2)];
  }

  function aloneExtracts(cells, nuts) {
    const bolt = {
      id: 0,
      color: 0,
      cells: cells,
      nuts: nuts,
      nut: nuts[0],
      shape: BT.shapeOf(cells),
      cross: null,
      axis: null
    };
    const level = { cols: 18, rows: 18, bolts: [bolt] };
    for (let i = 0; i < BT.DIR_LIST.length; i++) {
      if (BT.slideInfo(level, bolt, BT.DIR_LIST[i]).extracts) return true;
    }
    return false;
  }

  BT.placeNuts = function (cells) {
    const bends = bendList(cells);
    const shape = BT.shapeOf(cells);
    if (bends.length >= 2) {
      const arms = endArms(cells, bends);
      const seats = [];
      arms.forEach(function (arm) {
        const idx = seatOnArm(arm);
        if (idx >= 0 && !BT.isBendIndex(cells, idx)) seats.push(idx);
      });
      const asNut = function (idx) { return { r: cells[idx].r, c: cells[idx].c }; };
      if (shape === "C") {
        const nuts = [];
        seats.forEach(function (idx) {
          const p = asNut(idx);
          if (!nuts.some(function (n) { return n.r === p.r && n.c === p.c; })) nuts.push(p);
        });
        if (nuts.length >= 2) return nuts;
      }
      if (shape === "S") {
        for (let i = 0; i < seats.length; i++) {
          const nuts = [asNut(seats[i])];
          if (aloneExtracts(cells, nuts)) return nuts;
        }
        const pool = arms[0].concat(arms[1]);
        for (let i = 0; i < pool.length; i++) {
          if (BT.isBendIndex(cells, pool[i])) continue;
          const nuts = [asNut(pool[i])];
          if (aloneExtracts(cells, nuts)) return nuts;
        }
      }
    }
    const one = BT.nutOnCells(cells);
    return one ? [one] : [];
  };

  BT.axisDirs = function (bolt) {
    if (!bolt || !bolt.cells || bolt.cells.length < 2) return [];
    if (bolt.axis && BT.OPP[bolt.axis]) return [bolt.axis, BT.OPP[bolt.axis]];
    const nuts = BT.nutsOf(bolt);
    const idx = BT.cellIndex(bolt, nuts[0]);
    let d = null;
    if (idx > 0) d = BT.stepDir(bolt.cells[idx], bolt.cells[idx - 1]);
    else if (idx >= 0 && idx < bolt.cells.length - 1) d = BT.stepDir(bolt.cells[idx], bolt.cells[idx + 1]);
    if (!d) d = BT.stepDir(bolt.cells[0], bolt.cells[1]);
    if (!d) return [];
    return [d, BT.OPP[d]];
  };

  function tipOnBoard(level, bolt, dir) {
    if (!level) return true;
    return BT.ends(bolt).some(function (end) {
      return end.dir === dir && BT.inBoard(level, end);
    });
  }

  function perpendicularDirs(bolt) {
    const axis = BT.axisDirs(bolt);
    if (!axis.length) return [];
    const a = BT.DIRS[axis[0]];
    return BT.DIR_LIST.filter(function (dir) {
      const d = BT.DIRS[dir];
      return a.dr * d.dr + a.dc * d.dc === 0;
    });
  }

  BT.moveMode = function (bolt, dir, level) {
    if (!bolt || !BT.DIRS[dir]) return null;
    if (BT.axisDirs(bolt).indexOf(dir) >= 0) return "axis";
    const liveTip = BT.pullDirs(bolt).indexOf(dir) >= 0 && tipOnBoard(level, bolt, dir);
    if (liveTip || bolt.cross === dir) return "cross";
    if (bolt.cross && BT.OPP[bolt.cross] === dir) return "cross";
    // No tip points this way. The whole bolt may still snug up to a neighbor,
    // nut included, but it cannot leave the board from this side.
    if (perpendicularDirs(bolt).indexOf(dir) >= 0) return "snug";
    return null;
  };

  BT.slideDirs = function (bolt, level) {
    const seen = {};
    const out = [];
    const extra = [];
    if (bolt && bolt.cross) extra.push(bolt.cross, BT.OPP[bolt.cross]);
    const pulls = BT.pullDirs(bolt).filter(function (dir) { return tipOnBoard(level, bolt, dir); });
    BT.axisDirs(bolt).concat(pulls).concat(extra).concat(perpendicularDirs(bolt)).forEach(function (dir) {
      if (!seen[dir]) {
        seen[dir] = true;
        out.push(dir);
      }
    });
    return out;
  };

  // Drawn shaft is about 0.22 cells wide, the nut a little wider. Stop at the
  // visible touch, not a full half-cell early.
  const BODY_GAP = 0.28;
  const NUT_GAP = 0.36;

  function hitsOthers(level, id, cells) {
    const others = (level.bolts || []).filter(function (b) { return b.id !== id; });
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if (p.r < 0 || p.c < 0 || p.r >= level.rows || p.c >= level.cols) continue;
      for (let j = 0; j < others.length; j++) {
        const body = worldOf(others[j]);
        for (let k = 0; k < body.length; k++) {
          if (Math.abs(p.r - body[k].r) < BODY_GAP && Math.abs(p.c - body[k].c) < BODY_GAP) return true;
        }
        const nuts = nutWorld(others[j]);
        for (let k = 0; k < nuts.length; k++) {
          if (Math.abs(p.r - nuts[k].r) < NUT_GAP && Math.abs(p.c - nuts[k].c) < NUT_GAP) return true;
        }
      }
    }
    return false;
  }

  function hitsGap(level, id, cells, gap) {
    const others = (level.bolts || []).filter(function (b) { return b.id !== id; });
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if (p.r < -0.01 || p.c < -0.01 || p.r >= level.rows || p.c >= level.cols) continue;
      for (let j = 0; j < others.length; j++) {
        const body = worldOf(others[j]).concat(nutWorld(others[j]));
        for (let k = 0; k < body.length; k++) {
          if (Math.abs(p.r - body[k].r) < gap && Math.abs(p.c - body[k].c) < gap) return true;
        }
      }
    }
    return false;
  }

  function copyNuts(nuts) {
    return (nuts || []).map(function (n) { return { r: n.r, c: n.c }; });
  }

  function coversNut(cells, nut) {
    return BT.cellIndex({ cells: cells }, nut) >= 0;
  }

  // Cell squares are [r, r+1] x [c, c+1]. A bolt that is still in play
  // cannot hang past the board edge.
  function cellsInside(level, cells) {
    for (let i = 0; i < cells.length; i++) {
      const p = cells[i];
      if (p.r < -1e-3 || p.c < -1e-3) return false;
      if (p.r + 1 > level.rows + 1e-3 || p.c + 1 > level.cols + 1e-3) return false;
    }
    return true;
  }

  function finishStep(level, bolt, moved, nuts, dir) {
    const onBoard = moved.filter(function (p) { return BT.inBoard(level, p); });
    if (hitsOthers(level, bolt.id, onBoard)) return null;
    const kept = copyNuts(nuts);
    for (let i = 0; i < kept.length; i++) {
      if (BT.inBoard(level, kept[i]) && hitsOthers(level, bolt.id, [kept[i]])) return null;
    }
    const pose = {
      id: bolt.id,
      color: bolt.color,
      cells: BT.orderChain(moved),
      shape: bolt.shape,
      nut: kept[0] || null,
      nuts: kept
    };
    // The shaft cannot cross the board edge. It comes off only when the nut
    // has let go and every cell of that step is still inside the board.
    if (!cellsInside(level, moved)) return null;
    const held = kept.some(function (n) { return coversNut(moved, n); });
    if (!onBoard.length || !held) return { extracted: true, pose: pose };
    const axis = bolt.axis || (BT.axisDirs(bolt)[0] || null);
    pose.shape = BT.shapeOf(pose.cells);
    pose.escaping = null;
    pose.cross = bolt.cross || null;
    pose.axis = axis;
    return { bolt: pose };
  }

  function axisBlocked(bolt, nut, dir) {
    const d = BT.DIRS[dir];
    const feeder = { r: nut.r - d.dr, c: nut.c - d.dc };
    const idx = BT.cellIndex(bolt, feeder);
    if (idx >= 0 && BT.isBendIndex(bolt.cells, idx)) return true;
    if (idx < 0 && coversNut(bolt.cells, nut)) {
      const side = BT.DIRS[BT.OPP[dir]];
      let r = nut.r + side.dr;
      let c = nut.c + side.dc;
      const guard = bolt.cells.length + 2;
      for (let n = 0; n < guard; n++) {
        const j = BT.cellIndex(bolt, { r: r, c: c });
        if (j < 0) break;
        if (BT.isBendIndex(bolt.cells, j)) return true;
        r += side.dr;
        c += side.dc;
      }
    }
    return false;
  }

  function axisStep(level, bolt, dir) {
    const nuts = BT.nutsOf(bolt);
    if (!nuts.length) return null;
    for (let i = 0; i < nuts.length; i++) {
      if (axisBlocked(bolt, nuts[i], dir)) return null;
    }
    const d = BT.DIRS[dir];
    const moved = bolt.cells.map(function (p) { return { r: p.r + d.dr, c: p.c + d.dc }; });
    return finishStep(level, bolt, moved, nuts, dir);
  }

  function crossStep(level, bolt, dir) {
    const back = bolt.cross && BT.OPP[bolt.cross] === dir;
    const liveTip = BT.pullDirs(bolt).indexOf(dir) >= 0 && tipOnBoard(level, bolt, dir);
    if (!liveTip && bolt.cross !== dir && !back) return null;
    if (BT.axisDirs(bolt).indexOf(dir) >= 0) return null;
    const d = BT.DIRS[dir];
    const moved = bolt.cells.map(function (p) { return { r: p.r + d.dr, c: p.c + d.dc }; });
    const nuts = BT.nutsOf(bolt).map(function (n) { return { r: n.r + d.dr, c: n.c + d.dc }; });
    const next = finishStep(level, bolt, moved, nuts, dir);
    if (next && next.bolt) next.bolt.cross = back ? bolt.cross : dir;
    return next;
  }

  function replaceBolt(level, bolt, next) {
    if (next.extracted) {
      return {
        level: { cols: level.cols, rows: level.rows, bolts: level.bolts.filter(function (b) { return b.id !== bolt.id; }) },
        extracted: true,
        bolt: next.pose || bolt
      };
    }
    return {
      level: {
        cols: level.cols,
        rows: level.rows,
        bolts: level.bolts.map(function (b) { return b.id === bolt.id ? next.bolt : b; })
      },
      extracted: false,
      bolt: next.bolt
    };
  }

  function integerStep(level, bolt, dir) {
    const mode = BT.moveMode(bolt, dir, level);
    if (mode !== "axis" && mode !== "cross") return null;
    const next = mode === "axis" ? axisStep(level, bolt, dir) : crossStep(level, bolt, dir);
    if (!next) return null;
    // A sideways tip may carry the bolt off the board. It may not walk the
    // nut onto a new square and leave the bolt in play.
    if (mode === "cross" && !next.extracted) return null;
    if (next.bolt) {
      next.bolt.shift = null;
      next.bolt.shiftNuts = false;
    }
    return replaceBolt(level, bolt, next);
  }

  // A half step parks the shaft between grid lines. Distance 0.5 from another
  // body does not overlap, so a small nudge can open a lane a full cell cannot.
  function halfStep(level, bolt, dir) {
    const mode = BT.moveMode(bolt, dir, level);
    if (!mode) return null;
    const parkedOff = bolt.shift && ((bolt.shift.dr || 0) || (bolt.shift.dc || 0));
    if (mode === "axis" && parkedOff && freed(bolt, worldOf(bolt)) === "out") {
      if (!cellsInside(level, worldOf(bolt))) return null;
      return replaceBolt(level, bolt, { extracted: true, pose: bolt });
    }
    // A tip carries the whole bolt, nut included. A full cell that would land
    // on a neighbor instead snugs up until the shafts meet.
    if (mode === "cross") {
      const cur = bolt.shift || { dr: 0, dc: 0 };
      const parkedOff = (cur.dr || 0) || (cur.dc || 0);
      if (!parkedOff) {
        const stepped = integerStep(level, bolt, dir);
        if (stepped) return stepped;
      }
      return null;
    }
    if (mode === "snug") return squeeze(level, bolt, "cross", dir);
    const d = BT.DIRS[dir];
    const cur = bolt.shift || { dr: 0, dc: 0 };
    let sdr = (cur.dr || 0) + d.dr * 0.5;
    let sdc = (cur.dc || 0) + d.dc * 0.5;
    let growR = 0;
    let growC = 0;
    if (sdr >= 1) { growR = 1; sdr -= 1; }
    else if (sdr <= -1) { growR = -1; sdr += 1; }
    if (sdc >= 1) { growC = 1; sdc -= 1; }
    else if (sdc <= -1) { growC = -1; sdc += 1; }
    if (Math.abs(sdr) < 1e-6) sdr = 0;
    if (Math.abs(sdc) < 1e-6) sdc = 0;
    if (growR || growC) {
      const idir = growR < 0 ? "N" : growR > 0 ? "S" : growC > 0 ? "E" : "W";
      const stepped = integerStep(level, bolt, idir);
      if (stepped && (stepped.extracted || (!sdr && !sdc))) return stepped;
      if (stepped) {
        const parked = halfPark(stepped.level, stepped.bolt, mode, sdr, sdc, dir);
        return parked || stepped;
      }
      return squeeze(level, bolt, mode, dir);
    }
    const parked = halfPark(level, bolt, mode, sdr, sdc, dir);
    if (parked && parked.extracted) return parked;
    if (parked && !integerStep(level, bolt, dir)) {
      return squeeze(level, bolt, mode, dir) || parked;
    }
    return parked || squeeze(level, bolt, mode, dir);
  }

  // Slide up to the drawn contact. A half-cell stop was leaving a visible gap
  // in front of the next bolt or the nut.
  function squeeze(level, bolt, mode, dir) {
    const d = BT.DIRS[dir];
    const cur = bolt.shift || { dr: 0, dc: 0 };
    const along = (cur.dr || 0) * d.dr + (cur.dc || 0) * d.dc;
    let room = 0.999 - Math.max(0, along);
    if (along < 0) room = Math.min(room, -along);
    const cap = Math.min(0.98, Math.max(0, room));
    if (cap < 0.04) return null;
    let lo = 0;
    let hi = cap;
    let best = null;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      const sdr = (cur.dr || 0) + d.dr * mid;
      const sdc = (cur.dc || 0) + d.dc * mid;
      if (Math.abs(sdr) >= 0.999 || Math.abs(sdc) >= 0.999) {
        hi = mid;
        continue;
      }
      const parked = halfPark(level, bolt, mode, sdr, sdc, dir);
      if (parked) {
        best = parked;
        lo = mid;
      } else hi = mid;
    }
    if (!best || lo < 0.04) return null;
    best.contact = touchPoint(level, best.bolt) || facingWorld(best.bolt, dir);
    return best;
  }

  function facingWorld(bolt, dir) {
    const d = BT.DIRS[dir];
    const world = worldOf(bolt);
    let best = world[0];
    let score = -1e9;
    for (let i = 0; i < world.length; i++) {
      const s = world[i].r * d.dr + world[i].c * d.dc;
      if (s > score) {
        score = s;
        best = world[i];
      }
    }
    return best ? { r: best.r, c: best.c } : null;
  }

  function touchPoint(level, bolt) {
    const world = worldOf(bolt);
    let best = null;
    let bestD = 1e9;
    function take(pr, pc, br, bc) {
      const d = Math.abs(pr - br) + Math.abs(pc - bc);
      if (d >= bestD || d > 0.8) return;
      bestD = d;
      best = { r: (pr + br) / 2, c: (pc + bc) / 2 };
    }
    const nuts = BT.nutsOf(bolt);
    for (let i = 0; i < world.length; i++) {
      if (!BT.isBendIndex(bolt.cells, i)) continue;
      for (let n = 0; n < nuts.length; n++) take(world[i].r, world[i].c, nuts[n].r, nuts[n].c);
    }
    const others = (level.bolts || []).filter(function (b) { return b.id !== bolt.id; });
    for (let j = 0; j < others.length; j++) {
      const body = worldOf(others[j]);
      const onuts = nutWorld(others[j]);
      for (let i = 0; i < world.length; i++) {
        for (let k = 0; k < body.length; k++) take(world[i].r, world[i].c, body[k].r, body[k].c);
        for (let k = 0; k < onuts.length; k++) take(world[i].r, world[i].c, onuts[k].r, onuts[k].c);
      }
    }
    return best;
  }

  function shaftHolds(world, nut) {
    for (let i = 0; i < world.length - 1; i++) {
      const a = world[i];
      const b = world[i + 1];
      const dr = b.r - a.r;
      const dc = b.c - a.c;
      const len2 = dr * dr + dc * dc;
      if (len2 < 1e-8) continue;
      const t = ((nut.r - a.r) * dr + (nut.c - a.c) * dc) / len2;
      if (t < -0.02 || t > 1.02) continue;
      const pr = a.r + t * dr;
      const pc = a.c + t * dc;
      if (Math.abs(pr - nut.r) < 0.45 && Math.abs(pc - nut.c) < 0.45) return true;
    }
    return false;
  }

  // A nut on an end cell lets go once that end has left the nut's square.
  // The shaft behind it must not keep a tip captive until a bend is forced
  // through the nut — that deadlock is what made open ends look stuck.
  function nutHolds(bolt, nut, world) {
    if (!shaftHolds(world, nut)) return false;
    const cells = bolt.cells || [];
    const last = cells.length - 1;
    function leftSquare(i) {
      return Math.hypot(world[i].r - nut.r, world[i].c - nut.c) > 0.45;
    }
    if (last >= 0 && cells[0].r === nut.r && cells[0].c === nut.c && leftSquare(0)) return false;
    if (last > 0 && cells[last].r === nut.r && cells[last].c === nut.c && leftSquare(last)) return false;
    return true;
  }

  // Once no nut still clamps the shaft, the bolt is gone. A neighbor can stop
  // the slide only while a nut is still holding it.
  function freed(bolt, world) {
    const nuts = BT.nutsOf(bolt);
    if (!nuts.length || !nuts.some(function (n) { return nutHolds(bolt, n, world); })) return "out";
    return "hold";
  }

  function halfPark(level, bolt, mode, sdr, sdc, dir) {
    const next = {
      id: bolt.id,
      color: bolt.color,
      cells: bolt.cells.map(function (p) { return { r: p.r, c: p.c }; }),
      shape: bolt.shape,
      nut: BT.nutsOf(bolt)[0] || null,
      nuts: BT.nutsOf(bolt).map(function (n) { return { r: n.r, c: n.c }; }),
      cross: bolt.cross || null,
      axis: bolt.axis || null,
      shift: { dr: sdr, dc: sdc },
      shiftNuts: false
    };
    const world = worldOf(next);
    if (hitsOthers(level, bolt.id, world)) return null;
    if (mode === "axis") {
      if (!cellsInside(level, world)) return null;
      const fate = freed(next, world);
      if (fate === "out") return replaceBolt(level, bolt, { extracted: true, pose: next });
      if (fate === "hold") {
        const nuts = BT.nutsOf(bolt);
        for (let i = 0; i < world.length; i++) {
          if (!BT.isBendIndex(next.cells, i)) continue;
          for (let n = 0; n < nuts.length; n++) {
            if (Math.abs(world[i].r - nuts[n].r) < NUT_GAP && Math.abs(world[i].c - nuts[n].c) < NUT_GAP) return null;
          }
        }
      }
    } else {
      // The nut travels with the shaft so the piece stays one bolt.
      const movedNuts = BT.nutsOf(bolt).map(function (n) {
        return { r: n.r + sdr, c: n.c + sdc };
      });
      if (hitsGap(level, bolt.id, movedNuts, NUT_GAP)) return null;
      if (!cellsInside(level, world) || !cellsInside(level, movedNuts)) return null;
      const pressed = touchPoint(level, next);
      const prev = Math.hypot((bolt.shift && bolt.shift.dr) || 0, (bolt.shift && bolt.shift.dc) || 0);
      const now = Math.hypot(sdr, sdc);
      if (!pressed && now > prev - 0.02) return null;
      if (now < 0.02) {
        next.shift = null;
        next.shiftNuts = false;
      } else next.shiftNuts = true;
    }
    return replaceBolt(level, bolt, { bolt: next });
  }

  BT.stepBolt = function (level, bolt, dir) {
    if (!level || !bolt) return null;
    if (BT.halfGrid) return halfStep(level, bolt, dir);
    return integerStep(level, bolt, dir);
  };

  const slideMemo = new WeakMap();

  BT.slideInfo = function (level, bolt, dir) {
    const key = (bolt && bolt.id != null ? bolt.id : "?") + ":" + dir + (BT.halfGrid ? ":h" : "");
    let bag = slideMemo.get(level);
    if (bag && bag[key]) return bag[key];
    let steps = 0;
    let extracts = false;
    let curLevel = level;
    let cur = bolt;
    const cap = (level.rows + level.cols + bolt.cells.length + 2);
    for (let i = 0; i < cap; i++) {
      const stepped = BT.stepBolt(curLevel, cur, dir);
      if (!stepped) break;
      steps++;
      if (stepped.extracted) {
        extracts = true;
        break;
      }
      curLevel = stepped.level;
      cur = stepped.bolt;
      if (!cur) {
        extracts = true;
        break;
      }
    }
    const info = { steps: steps, extracts: extracts, mode: BT.moveMode(bolt, dir, level) };
    if (!bag) {
      bag = {};
      slideMemo.set(level, bag);
    }
    bag[key] = info;
    return info;
  };

  BT.canPull = function (level, bolt, dir) {
    if (!bolt || !BT.DIRS[dir]) return false;
    const info = BT.slideInfo(level, bolt, dir);
    return info.steps > 0 && info.extracts;
  };

  BT.legalMoves = function (level) {
    const moves = [];
    (level.bolts || []).forEach(function (b) {
      BT.slideDirs(b, level).forEach(function (dir) {
        const stepped = BT.stepBolt(level, b, dir);
        if (stepped) moves.push({ id: b.id, dir: dir, extracted: !!stepped.extracted });
      });
    });
    return moves;
  };

  BT.exitBolts = function (level) {
    let n = 0;
    (level.bolts || []).forEach(function (b) {
      const dirs = BT.slideDirs(b, level);
      for (let i = 0; i < dirs.length; i++) {
        if (BT.canPull(level, b, dirs[i])) {
          n++;
          return;
        }
      }
    });
    return n;
  };

  BT.freeBolts = function (level) {
    const ids = {};
    BT.legalMoves(level).forEach(function (m) { ids[m.id] = true; });
    return Object.keys(ids).length;
  };

  BT.blockerCell = function (level, bolt, dir) {
    const d = BT.DIRS[dir];
    if (!d) return null;
    const occ = BT.occupyMap(level.bolts, bolt.id);
    let best = null;
    let bestDist = 99;
    bolt.cells.forEach(function (p) {
      let r = p.r + d.dr;
      let c = p.c + d.dc;
      let dist = 1;
      while (r >= 0 && c >= 0 && r < level.rows && c < level.cols) {
        if (occ.has(BT.key(r, c))) {
          if (dist < bestDist) {
            bestDist = dist;
            best = { r: r, c: c, id: occ.get(BT.key(r, c)) };
          }
          break;
        }
        r += d.dr;
        c += d.dc;
        dist++;
      }
    });
    return best;
  };

  BT.removeBolt = function (level, id) {
    return {
      cols: level.cols,
      rows: level.rows,
      bolts: (level.bolts || []).filter(function (b) { return b.id !== id; })
    };
  };

  BT.levelSignature = function (level) {
    return (level.bolts || []).map(function (b) {
      const cells = (b.cells || []).map(function (p) { return p.r + "." + p.c; }).join(",");
      const nut = BT.nutsOf(b).map(function (n) { return n.r + "." + n.c; }).join("+") || "-";
      return b.id + ":" + cells + "@" + nut + (b.cross ? (">" + b.cross) : "");
    }).sort().join("|");
  };

  BT.metricsOf = function (level) {
    const bolts = level.bolts || [];
    const shapes = { I: 0, L: 0, C: 0, S: 0 };
    let tiles = 0;
    const ends = { N: 0, E: 0, S: 0, W: 0 };
    bolts.forEach(function (b) {
      tiles += b.cells.length;
      const shape = b.shape || BT.shapeOf(b.cells);
      shapes[shape] = (shapes[shape] || 0) + 1;
      BT.pullDirs(b).forEach(function (dir) { ends[dir] = (ends[dir] || 0) + 1; });
    });
    return {
      bolts: bolts.length,
      tiles: tiles,
      fill: tiles / (level.cols * level.rows),
      shapes: shapes,
      ends: ends,
      free: BT.exitBolts(level)
    };
  };

  BT.solve = function (level, limit) {
    const start = BT.normalizeLevel(level);
    const n = start.bolts.length;
    const opening = BT.exitBolts(start);
    if (!n) {
      return { winnable: true, path: [], opening: 0, curve: [0], bottleneck: 0, cascade: 0, forced: 0, visited: 1 };
    }
    const cap = limit || (n <= 4 ? 20000 : (n <= 6 ? 8000 : 3000));
    const queue = [start];
    const startKey = BT.levelSignature(start);
    const seen = new Set([startKey]);
    const prev = new Map();
    prev.set(startKey, null);
    let visits = 0;
    let winKey = null;
    while (queue.length && visits < cap) {
      const cur = queue.shift();
      visits++;
      const curKey = BT.levelSignature(cur);
      if (!cur.bolts.length) {
        winKey = curKey;
        break;
      }
      const moves = BT.legalMoves(cur);
      for (let i = 0; i < moves.length; i++) {
        const bolt = cur.bolts.find(function (b) { return b.id === moves[i].id; });
        const stepped = BT.stepBolt(cur, bolt, moves[i].dir);
        if (!stepped) continue;
        const k = BT.levelSignature(stepped.level);
        if (seen.has(k)) continue;
        seen.add(k);
        prev.set(k, { from: curKey, id: moves[i].id, dir: moves[i].dir });
        if (!stepped.level.bolts.length) {
          winKey = k;
          queue.length = 0;
          break;
        }
        queue.push(stepped.level);
      }
    }
    if (winKey == null) {
      return { winnable: false, path: [], opening: opening, curve: [opening], bottleneck: opening, cascade: 0, forced: 0, visited: visits };
    }
    const steps = [];
    let cursor = winKey;
    while (prev.get(cursor)) {
      steps.push(prev.get(cursor));
      cursor = prev.get(cursor).from;
    }
    steps.reverse();
    return BT.curveFromPath(start, steps, visits);
  };

  BT.curveFromPath = function (start, path, visited) {
    const curve = [BT.freeBolts(start)];
    let play = start;
    let bottleneck = curve[0];
    let cascade = 0;
    let forced = 0;
    const ids = [];
    for (let i = 0; i < path.length; i++) {
      const step = path[i];
      const id = step && step.id != null ? step.id : step;
      const dir = step && step.dir;
      const before = curve[curve.length - 1];
      if (before === 1) forced++;
      if (dir) {
        const bolt = play.bolts.find(function (b) { return b.id === id; });
        const stepped = bolt ? BT.stepBolt(play, bolt, dir) : null;
        if (!stepped) break;
        play = stepped.level;
      } else {
        play = BT.removeBolt(play, id);
      }
      ids.push(id);
      const after = BT.freeBolts(play);
      curve.push(after);
      if (play.bolts.length && after < bottleneck) bottleneck = after;
      const unlock = after - Math.max(0, before - 1);
      if (unlock > cascade) cascade = unlock;
    }
    return {
      winnable: play.bolts.length === 0,
      path: ids,
      moves: path,
      opening: BT.exitBolts(start),
      curve: curve,
      bottleneck: bottleneck,
      cascade: cascade,
      forced: forced,
      visited: visited || 0
    };
  };

  BT.playOrder = function (level, ids) {
    let play = BT.normalizeLevel(level);
    const opening = BT.exitBolts(play);
    const path = [];
    const curve = [BT.freeBolts(play)];
    const leaves = [];
    let setups = 0;
    let ones = 0;
    let leaveMaxSeen = 0;
    let bottleneck = curve[0];
    let cascade = 0;
    let forced = 0;
    const order = ids || play.bolts.map(function (b) { return b.id; });
    const plan = [];
    const seen = Object.create(null);
    let guard = (play.bolts.length + 1) * 16;
    while (play.bolts.length && guard-- > 0) {
      const key = play.bolts.map(function (b) {
        const cells = b.cells.map(function (p) {
          return Math.round(p.r * 100) + "," + Math.round(p.c * 100);
        }).join(";");
        const sh = b.shift || {};
        return b.id + ":" + cells + "@" + Math.round((sh.dr || 0) * 100) + "," + Math.round((sh.dc || 0) * 100);
      }).sort().join("|");
      if (seen[key]) break;
      seen[key] = 1;
      const leave = BT.exitBolts(play);
      leaves.push(leave);
      if (leave === 1) ones++;
      if (leave > leaveMaxSeen) leaveMaxSeen = leave;
      const ranked = play.bolts.slice().sort(function (a, b) {
        return order.indexOf(a.id) - order.indexOf(b.id);
      });
      const options = [];
      for (let i = 0; i < ranked.length; i++) {
        const dirs = BT.slideDirs(ranked[i], play);
        for (let d = 0; d < dirs.length; d++) {
          if (BT.canPull(play, ranked[i], dirs[d])) {
            options.push({ id: ranked[i].id, dir: dirs[d] });
            break;
          }
        }
      }
      let choice = options.length ? { id: options[0].id, dir: options[0].dir, pull: true } : null;
      if (!choice) {
        const moves = BT.legalMoves(play).filter(function (m) { return !m.extracted; });
        let nudge = null;
        for (let i = 0; i < moves.length && !nudge; i++) {
          const bolt = play.bolts.find(function (b) { return b.id === moves[i].id; });
          const stepped = bolt ? BT.stepBolt(play, bolt, moves[i].dir) : null;
          if (stepped && !stepped.extracted && BT.exitBolts(stepped.level) > leave) nudge = moves[i];
        }
        if (!nudge) nudge = moves[0];
        if (!nudge) break;
        choice = { id: nudge.id, dir: nudge.dir, pull: false };
      }
      const before = curve[curve.length - 1];
      if (before === 1) forced++;
      const steps = choice.pull ? BT.slideInfo(play, play.bolts.find(function (b) { return b.id === choice.id; }), choice.dir).steps : 1;
      let left = steps;
      let extracted = false;
      while (left-- > 0) {
        const cur = play.bolts.find(function (b) { return b.id === choice.id; });
        if (!cur) break;
        const stepped = BT.stepBolt(play, cur, choice.dir);
        if (!stepped) break;
        play = stepped.level;
        if (stepped.extracted) {
          extracted = true;
          break;
        }
      }
      plan.push({ id: choice.id, dir: choice.dir, out: extracted });
      path.push(choice.id);
      const afterLeave = play.bolts.length ? BT.exitBolts(play) : 0;
      if (leave === 0 && !extracted && afterLeave > 0) setups++;
      const after = BT.freeBolts(play);
      curve.push(after);
      if (play.bolts.length && after < bottleneck) bottleneck = after;
      const unlock = after - Math.max(0, before - 1);
      if (unlock > cascade) cascade = unlock;
    }
    return {
      ok: play.bolts.length === 0,
      winnable: play.bolts.length === 0,
      path: path,
      plan: plan,
      leftover: play.bolts.length,
      opening: opening,
      curve: curve,
      bottleneck: bottleneck,
      cascade: cascade,
      forced: forced,
      leaves: leaves,
      leaveMaxSeen: leaveMaxSeen,
      setups: setups,
      ones: ones
    };
  };

  BT.planFromMoves = function (level, moves) {
    let play = BT.normalizeLevel(level);
    const plan = [];
    for (let i = 0; i < (moves || []).length; i++) {
      const step = moves[i];
      const id = step && step.id != null ? step.id : step;
      const dir = step && step.dir;
      if (!dir) {
        play = BT.removeBolt(play, id);
        plan.push({ id: id, dir: "", out: true });
        continue;
      }
      const bolt = play.bolts.find(function (b) { return b.id === id; });
      const stepped = bolt ? BT.stepBolt(play, bolt, dir) : null;
      if (!stepped) break;
      play = stepped.level;
      const prev = plan[plan.length - 1];
      if (prev && prev.id === id && prev.dir === dir && !prev.out) prev.out = !!stepped.extracted;
      else plan.push({ id: id, dir: dir, out: !!stepped.extracted });
    }
    return { winnable: play.bolts.length === 0, plan: plan };
  };

  BT.exitOrder = function (plan) {
    const order = {};
    let n = 0;
    (plan || []).forEach(function (step) {
      if (!step.out || order[step.id]) return;
      n += 1;
      order[step.id] = n;
    });
    return order;
  };

  BT.winOf = function (level) {
    const board = BT.normalizeLevel(level);
    const played = BT.playOrder(board);
    if (played.winnable) {
      return {
        winnable: true,
        plan: played.plan || [],
        order: BT.exitOrder(played.plan),
        opening: played.opening,
        bottleneck: played.bottleneck,
        cascade: played.cascade,
        forced: played.forced
      };
    }
    const solved = BT.solve(board);
    if (solved.winnable) {
      const built = BT.planFromMoves(board, solved.moves || []);
      if (built.winnable) {
        return {
          winnable: true,
          plan: built.plan,
          order: BT.exitOrder(built.plan),
          opening: solved.opening,
          bottleneck: solved.bottleneck,
          cascade: solved.cascade,
          forced: solved.forced
        };
      }
    }
    return {
      winnable: false,
      plan: [],
      order: {},
      opening: BT.exitBolts(board),
      bottleneck: 0,
      cascade: 0,
      forced: 0
    };
  };

  BT.analyze = function (level) {
    const board = BT.normalizeLevel(level);
    const base = BT.metricsOf(board);
    let solved = BT.solve(board);
    if (!solved.winnable && board.bolts.length) {
      const played = BT.playOrder(board);
      if (played.winnable) solved = played;
    }
    return Object.assign({}, base, solved, { cols: board.cols, rows: board.rows });
  };

  BT.defaultShape = function () { return { I: 25, L: 25, C: 25, S: 25 }; };

  BT.defaultSpec = function () {
    return {
      cols: 12,
      rows: 12,
      bolts: 12,
      shape: BT.defaultShape(),
      openingMin: 1,
      openingMax: 2,
      bottleneckMax: 1,
      cascadeMin: 2,
      laneMin: 1,
      oneWay: false,
      leaveMax: 2,
      setupMin: 0,
      minLen: 4,
      band: "medium",
      seed: 1001
    };
  };

  BT.applyBand = function (spec, band) {
    const s = Object.assign({}, spec, { band: band, shape: Object.assign({}, (spec && spec.shape) || BT.defaultShape()) });
    if (band === "easy") {
      s.bolts = 4; s.cols = 6; s.rows = 6;
      s.shape = { I: 60, L: 30, C: 10, S: 0 };
      s.openingMin = 2; s.openingMax = 3; s.bottleneckMax = 2; s.cascadeMin = 1;
      s.laneMin = 0; s.oneWay = false; s.leaveMax = 3; s.setupMin = 0; s.minLen = 3;
    } else if (band === "medium") {
      s.bolts = 12; s.cols = 12; s.rows = 12;
      s.shape = { I: 25, L: 25, C: 25, S: 25 };
      s.openingMin = 1; s.openingMax = 2; s.bottleneckMax = 1; s.cascadeMin = 2;
      s.laneMin = 1; s.oneWay = false; s.leaveMax = 2; s.setupMin = 0; s.minLen = 4;
    } else if (band === "hard") {
      s.bolts = 8; s.cols = 8; s.rows = 8;
      s.shape = { I: 20, L: 30, C: 25, S: 25 };
      s.openingMin = 1; s.openingMax = 2; s.bottleneckMax = 1; s.cascadeMin = 2;
      s.laneMin = 2; s.oneWay = true; s.leaveMax = 2; s.setupMin = 1; s.minLen = 4;
    }
    return s;
  };

  BT.scoreFlow = function (info, spec) {
    if (!info || !info.winnable) return -1000;
    let score = 200;
    const want = spec.bolts || 6;
    score -= Math.abs((info.bolts || 0) - want) * 24;
    if (info.opening < spec.openingMin) score -= (spec.openingMin - info.opening) * 36;
    if (info.opening > spec.openingMax) score -= (info.opening - spec.openingMax) * 28;
    if (info.bottleneck > (spec.bottleneckMax == null ? 1 : spec.bottleneckMax)) {
      score -= (info.bottleneck - spec.bottleneckMax) * 18;
    }
    if (info.cascade < (spec.cascadeMin || 1)) score -= (spec.cascadeMin - info.cascade) * 16;
    if (info.forced >= 1) score += 10;
    if (spec.leaveMax != null && info.leaveMaxSeen > spec.leaveMax) score -= (info.leaveMaxSeen - spec.leaveMax) * 40;
    if ((info.setups || 0) < (spec.setupMin || 0)) score -= ((spec.setupMin || 0) - (info.setups || 0)) * 30;
    if (info.ones) score += Math.min(24, info.ones * 4);
    if (info.opening >= spec.openingMin && info.opening <= spec.openingMax) score += 24;
    const mix = spec.shape || BT.defaultShape();
    const total = info.bolts || 1;
    ["I", "L", "C", "S"].forEach(function (k) {
      const got = ((info.shapes && info.shapes[k]) || 0) / total;
      const goal = (mix[k] || 0) / 100;
      score -= Math.abs(got - goal) * 40;
    });
    if ((info.shapes && info.shapes.C) > 0) score += 6;
    if ((info.shapes && info.shapes.L) > 0) score += 6;
    return score;
  };
});
