(function (factory) {
  const g = typeof globalThis !== "undefined" ? globalThis : this;
  const BT = (g.BT = g.BT || {});
  factory(BT);
  if (typeof module !== "undefined" && module.exports) module.exports = BT;
})(function (BT) {
  "use strict";

  const TEMPLATES = {
    I: [
      [[0, 0], [0, 1]],
      [[0, 0], [0, 1], [0, 2]],
      [[0, 0], [0, 1], [0, 2], [0, 3]],
      [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]],
      [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4], [0, 5]]
    ],
    L: [
      [[0, 0], [0, 1], [1, 1]],
      [[0, 0], [0, 1], [0, 2], [1, 2]],
      [[0, 0], [1, 0], [2, 0], [2, 1]],
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]]
    ],
    C: [
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [1, 2], [0, 2]],
      [[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [1, 2], [0, 2]],
      [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [1, 3], [0, 3]]
    ],
    S: [
      [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [2, 3], [2, 4]],
      [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [2, 3], [2, 4], [2, 5], [2, 6]],
      [[0, 1], [1, 1], [2, 1], [2, 0], [3, 0], [4, 0], [4, 1]]
    ]
  };

  function cellsOf(pairs) {
    return pairs.map(function (p) { return { r: p[0], c: p[1] }; });
  }

  function normalize(cells) {
    let minR = Infinity, minC = Infinity;
    cells.forEach(function (p) {
      if (p.r < minR) minR = p.r;
      if (p.c < minC) minC = p.c;
    });
    return cells.map(function (p) { return { r: p.r - minR, c: p.c - minC }; });
  }

  function rot(cells, times) {
    let out = cells.map(function (p) { return { r: p.r, c: p.c }; });
    const n = ((times % 4) + 4) % 4;
    for (let t = 0; t < n; t++) {
      out = out.map(function (p) { return { r: p.c, c: -p.r }; });
    }
    return normalize(out);
  }

  function mirror(cells) {
    return normalize(cells.map(function (p) { return { r: p.r, c: -p.c }; }));
  }

  function footprint(cells) {
    return cells.map(function (p) { return p.r + "," + p.c; }).sort().join(";");
  }

  function variants(family) {
    const out = [];
    const seen = {};
    (TEMPLATES[family] || []).forEach(function (raw) {
      const base = cellsOf(raw);
      [base, mirror(base)].forEach(function (src) {
        for (let t = 0; t < 4; t++) {
          const shape = BT.orderChain(rot(src, t));
          const key = footprint(shape);
          if (seen[key]) continue;
          seen[key] = true;
          out.push(shape);
        }
      });
    });
    return out;
  }

  const VARIANT_CACHE = { I: variants("I"), L: variants("L"), C: variants("C"), S: variants("S") };

  function bbox(cells) {
    let minR = 99, minC = 99, maxR = -99, maxC = -99;
    cells.forEach(function (p) {
      if (p.r < minR) minR = p.r;
      if (p.c < minC) minC = p.c;
      if (p.r > maxR) maxR = p.r;
      if (p.c > maxC) maxC = p.c;
    });
    return { minR: minR, minC: minC, maxR: maxR, maxC: maxC, h: maxR - minR + 1, w: maxC - minC + 1 };
  }

  function shift(cells, r, c) {
    return cells.map(function (p) { return { r: p.r + r, c: p.c + c }; });
  }

  function inBoard(cells, cols, rows) {
    return cells.every(function (p) { return p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols; });
  }

  function overlaps(cells, occ) {
    return cells.some(function (p) { return occ.has(BT.key(p.r, p.c)); });
  }

  function depthScore(cells, dir, cols, rows) {
    const d = BT.DIRS[dir];
    let sum = 0;
    cells.forEach(function (p) {
      if (d.dr < 0) sum += (rows - 1 - p.r);
      else if (d.dr > 0) sum += p.r;
      else if (d.dc < 0) sum += (cols - 1 - p.c);
      else sum += p.c;
    });
    return sum / cells.length;
  }

  function candidates(shape, dir, cols, rows, occ) {
    const d = BT.DIRS[dir];
    const box = bbox(shape);
    const out = [];
    const latMax = d.dr !== 0 ? (cols - box.w) : (rows - box.h);
    for (let lat = 0; lat <= latMax; lat++) {
      let r, c;
      if (dir === "N") { r = -box.h; c = lat; }
      else if (dir === "S") { r = rows; c = lat; }
      else if (dir === "W") { r = lat; c = -box.w; }
      else { r = lat; c = cols; }
      for (let step = 0; step < cols + rows + 4; step++) {
        const placed = shift(shape, r, c);
        const fullyIn = inBoard(placed, cols, rows);
        if (fullyIn) {
          if (overlaps(placed, occ)) break;
          out.push({ cells: placed, depth: depthScore(placed, dir, cols, rows) });
        } else if (placed.some(function (p) {
          return p.r >= 0 && p.c >= 0 && p.r < rows && p.c < cols && occ.has(BT.key(p.r, p.c));
        })) {
          break;
        }
        r -= d.dr;
        c -= d.dc;
        const next = shift(shape, r, c);
        if (next.every(function (p) {
          if (dir === "N") return p.r >= rows;
          if (dir === "S") return p.r < 0;
          if (dir === "W") return p.c >= cols;
          return p.c < 0;
        })) break;
      }
    }
    return out;
  }

  function rayHits(cells, dir, blockers, cols, rows) {
    const d = BT.DIRS[dir];
    const wall = {};
    blockers.forEach(function (p) { wall[BT.key(p.r, p.c)] = true; });
    for (let i = 0; i < cells.length; i++) {
      let r = cells[i].r + d.dr;
      let c = cells[i].c + d.dc;
      while (r >= 0 && c >= 0 && r < rows && c < cols) {
        if (wall[BT.key(r, c)]) return true;
        r += d.dr;
        c += d.dc;
      }
    }
    return false;
  }

  function rayClear(cells, dir, occ, cols, rows) {
    const d = BT.DIRS[dir];
    for (let i = 0; i < cells.length; i++) {
      let r = cells[i].r + d.dr;
      let c = cells[i].c + d.dc;
      while (r >= 0 && c >= 0 && r < rows && c < cols) {
        if (occ.has(BT.key(r, c))) return false;
        r += d.dr;
        c += d.dc;
      }
    }
    return true;
  }

  function onBoardRay(cells, dir, cols, rows) {
  const d = BT.DIRS[dir];
  for (let i = 0; i < cells.length; i++) {
    const r = cells[i].r + d.dr;
    const c = cells[i].c + d.dc;
    if (r >= 0 && c >= 0 && r < rows && c < cols) return true;
  }
  return false;
}

function coverCount(cells, existing, cols, rows) {
    let n = 0;
    existing.forEach(function (b) {
      BT.pullDirs(b).forEach(function (dir) {
        const board = { cols: cols, rows: rows, bolts: existing };
        if (!BT.canPull(board, b, dir)) return;
        if (rayHits(b.cells, dir, cells, cols, rows)) n++;
      });
    });
    return n;
  }

  function pickFamily(rng, mix) {
    const keys = ["I", "L", "C", "S"];
    const weights = keys.map(function (k) { return Math.max(0, +(mix && mix[k]) || 0); });
    let sum = 0;
    weights.forEach(function (w) { sum += w; });
    if (!sum) return "I";
    let x = rng() * sum;
    for (let i = 0; i < keys.length; i++) {
      x -= weights[i];
      if (x <= 0) return keys[i];
    }
    return "I";
  }

  function emptyLevel(cols, rows) {
    return BT.normalizeLevel({ cols: cols, rows: rows, bolts: [] });
  }

  function generateOnce(spec, seed) {
    const rng = BT.mulberry32(seed);
    const cols = spec.cols;
    const rows = spec.rows;
    const occ = new Map();
    const bolts = [];
    const openingN = Math.max(1, Math.min(spec.openingMin || 1, Math.max(1, spec.bolts - 1)));
    const families = [];
    for (let i = 0; i < spec.bolts; i++) families.push(pickFamily(rng, spec.shape));

    for (let i = 0; i < spec.bolts; i++) {
      const wantOpen = i >= spec.bolts - openingN;
      const cap = spec.openingMax || 3;
      let openNow = 0;
      if (bolts.length) openNow = BT.exitBolts(BT.normalizeLevel({ cols: cols, rows: rows, bolts: bolts }));
      let placed = null;
      let usedDir = null;
      const minLen = Math.max(2, +spec.minLen || 2);
      const tryFamilies = [families[i], "L", "I", "S", "C"];
      for (let f = 0; f < tryFamilies.length && !placed; f++) {
        let pool = VARIANT_CACHE[tryFamilies[f]] || VARIANT_CACHE.I;
        if (minLen > 2) pool = pool.filter(function (shape) { return shape.length >= minLen; });
        if (!pool.length) continue;
        for (let attempt = 0; attempt < (f === 0 ? 18 : 8) && !placed; attempt++) {
          const shape = BT.pick(rng, pool);
          const dirs = BT.pullDirs({ cells: shape });
          if (!dirs.length) continue;
          const dirOrder = BT.shuffle(rng, dirs.slice());
          let bestPack = null;
          for (let di = 0; di < dirOrder.length; di++) {
            const dir = dirOrder[di];
            let opts = candidates(shape, dir, cols, rows, occ);
            if (!opts.length) continue;
            const backs = dirs.filter(function (d) { return d !== dir; });
            opts = opts.filter(function (o) {
              if (wantOpen) return true;
              return backs.every(function (d) { return onBoardRay(o.cells, d, cols, rows); });
            });
            if (!opts.length) continue;
            opts.forEach(function (o) {
              o.cover = coverCount(o.cells, bolts, cols, rows);
              o.back = !backs.length || backs.every(function (d) { return !rayClear(o.cells, d, occ, cols, rows); }) ? 1 : 0;
              o.dir = dir;
            });
            if (!wantOpen) {
              const sealed = opts.filter(function (o) { return o.back || o.cover > 0; });
              if (sealed.length) opts = sealed;
              const covering = opts.filter(function (o) { return o.cover > 0; });
              if (covering.length && bolts.length) opts = covering;
              const laneMin = Math.max(0, +spec.laneMin || 0);
              if (laneMin > 0 && bolts.length) {
                const stacked = opts.filter(function (o) { return o.cover >= laneMin; });
                if (stacked.length) opts = stacked;
              }
              if (spec.oneWay) {
                const directed = opts.filter(function (o) { return o.back; });
                if (directed.length) opts = directed;
              }
            }
            opts.sort(function (a, b) {
              if (b.cover !== a.cover) return b.cover - a.cover;
              if (b.back !== a.back) return b.back - a.back;
              return wantOpen ? (a.depth - b.depth) : (b.depth - a.depth);
            });
            if (openNow >= cap) {
              const kept = [];
              for (let k = 0; k < opts.length && k < 30 && kept.length < 4; k++) {
                const trial = BT.normalizeLevel({
                  cols: cols,
                  rows: rows,
                  bolts: bolts.concat([{ id: i, color: i, cells: opts[k].cells }])
                });
                const nb = trial.bolts.find(function (b) { return b.id === i; });
                const leaves = nb && BT.slideDirs(nb, trial).some(function (d) { return BT.canPull(trial, nb, d); });
                if (!leaves) kept.push(opts[k]);
              }
              if (!kept.length) continue;
              opts = kept;
            }
            const top = opts[0];
            if (!bestPack || top.cover > bestPack.cover || (top.cover === bestPack.cover && top.back > bestPack.back)) {
              bestPack = { opts: opts, dir: dir, cover: top.cover, back: top.back };
            }
          }
          if (!bestPack) continue;
          const poolN = Math.min(wantOpen ? 3 : 4, bestPack.opts.length);
          placed = bestPack.opts[Math.floor(rng() * poolN)];
          usedDir = placed.dir || bestPack.dir;
        }
      }
      if (!placed) continue;
      const bolt = { id: i, color: i, cells: placed.cells, dir: usedDir };
      bolt.cells.forEach(function (p) { occ.set(BT.key(p.r, p.c), bolt.id); });
      bolts.push(bolt);
    }

    const level = BT.normalizeLevel({ cols: cols, rows: rows, bolts: bolts });
    const ids = level.bolts.map(function (b) { return b.id; }).sort(function (a, b) { return b - a; });
    const prof = BT.playOrder(level, ids);
    if (!prof.ok || level.bolts.length < 3) return emptyLevel(cols, rows);
    level._flow = prof;
    return level;
  }

  // Bolts leave in placement order. Each new bolt stays shut until every
  // bolt ahead of it has left, and exactly one bolt can leave until then.
  function openIds(cols, rows, list) {
    const level = BT.normalizeLevel({ cols: cols, rows: rows, bolts: list });
    const ids = [];
    for (let i = 0; i < level.bolts.length; i++) {
      const bolt = level.bolts[i];
      const dirs = BT.slideDirs(bolt, level);
      for (let d = 0; d < dirs.length; d++) {
        if (BT.canPull(level, bolt, dirs[d])) {
          ids.push(bolt.id);
          break;
        }
      }
    }
    return ids;
  }

  function sameId(ids, id) {
    return ids.length === 1 && ids[0] === id;
  }

  function openIdList(cols, rows, list, cap) {
    const level = BT.normalizeLevel({ cols: cols, rows: rows, bolts: list });
    const ids = [];
    for (let i = 0; i < level.bolts.length; i++) {
      const bolt = level.bolts[i];
      const dirs = BT.slideDirs(bolt, level);
      for (let d = 0; d < dirs.length; d++) {
        if (BT.canPull(level, bolt, dirs[d])) {
          ids.push(bolt.id);
          break;
        }
      }
      if (ids.length > cap) return ids;
    }
    return ids;
  }

  // 0 means the chain does not hold. Otherwise the number of bolts that can
  // leave at the start of this list. The next bolt in order must be one of them.
  function packChain(spec, rng) {
    const cols = spec.cols;
    const rows = spec.rows;
    const minLen = Math.max(2, +spec.minLen || 2);
    const target = Math.max(3, +spec.bolts || 6);
    const shapes = [];
    ["I", "L", "C", "S"].forEach(function (fam) {
      (VARIANT_CACHE[fam] || []).forEach(function (shape) {
        if (shape.length >= minLen) shapes.push(shape);
      });
    });
    if (!shapes.length) return null;
    const leaveMax = spec.leaveMax == null ? 2 : spec.leaveMax;
    const bolts = [];
    const occ = new Map();
    let misses = 0;
    function rearNut(cells, dir) {
      const d = BT.DIRS[dir];
      const ranked = cells.map(function (p, i) {
        return { p: p, i: i, s: p.r * d.dr + p.c * d.dc };
      }).sort(function (a, b) { return a.s - b.s; });
      for (let i = 0; i < ranked.length; i++) {
        if (!BT.isBendIndex(cells, ranked[i].i)) return { r: ranked[i].p.r, c: ranked[i].p.c };
      }
      return { r: cells[0].r, c: cells[0].c };
    }
    function touches(cells) {
      if (!bolts.length) return true;
      for (let i = 0; i < cells.length; i++) {
        const p = cells[i];
        if (occ.has(BT.key(p.r + 1, p.c)) || occ.has(BT.key(p.r - 1, p.c)) || occ.has(BT.key(p.r, p.c + 1)) || occ.has(BT.key(p.r, p.c - 1))) return true;
      }
      return false;
    }
    while (bolts.length < target && misses < 1) {
      const shapeOrder = BT.shuffle(rng, shapes.slice());
      const dirs0 = ["N", "E", "S", "W"];
      let placed = null;
      let placedScore = -1;
      let checks = 0;
      for (let si = 0; si < shapeOrder.length && checks < 80; si++) {
        const dirs = BT.shuffle(rng, dirs0.slice());
        for (let di = 0; di < dirs.length && checks < 80; di++) {
          let opts = candidates(shapeOrder[si], dirs[di], cols, rows, occ);
          if (!opts.length) continue;
          opts = opts.filter(function (o) { return touches(o.cells); });
          if (!opts.length) continue;
          opts = BT.shuffle(rng, opts);
          const limit = Math.min(opts.length, bolts.length ? 6 : 6);
          for (let k = 0; k < limit && checks < 80; k++) {
            const nut = rearNut(opts[k].cells, dirs[di]);
            const trialBolt = { id: bolts.length, color: bolts.length % 12, cells: opts[k].cells, nut: nut, nuts: [nut] };
            const trial = bolts.concat([trialBolt]);
            const last = trial[trial.length - 1];
            if (openIdList(cols, rows, [last], 1).length !== 1) continue;
            const openNow = openIdList(cols, rows, trial, leaveMax);
            if (openNow.length < 1 || openNow.length > leaveMax) continue;
            checks++;
            const trialLevel = BT.normalizeLevel({ cols: cols, rows: rows, bolts: trial });
            const trialProf = BT.playOrder(trialLevel, trial.map(function (b) { return b.id; }));
            if (!trialProf.ok || trialProf.leaveMaxSeen > leaveMax) continue;
            let score = trialBolt.cells.length * 10 + trialProf.ones;
            if (spec.wave) {
              const waveLeaves = trialProf.leaves || [];
              let twos = 0;
              for (let w = 0; w < waveLeaves.length; w++) if (waveLeaves[w] === 2) twos++;
              score += (trialProf.setups || 0) * 28 + twos * 4;
              if (twos > 0 && (trialProf.setups || 0) > 0) score += 16;
            } else if (trialProf.leaveMaxSeen <= 1) score += 12;
            if (score > placedScore) {
              placed = trialBolt;
              placedScore = score;
            }
          }
        }
      }
      if (!placed) {
        misses++;
        continue;
      }
      misses = 0;
      placed.cells.forEach(function (p) { occ.set(BT.key(p.r, p.c), placed.id); });
      bolts.push(placed);
    }
    if (bolts.length < 4) return null;
    let longest = 0;
    let tiles = 0;
    bolts.forEach(function (b) {
      tiles += b.cells.length;
      if (b.cells.length > longest) longest = b.cells.length;
    });
    if (longest < Math.max(minLen, 6)) return null;
    if (tiles / (cols * rows) < 0.6) return null;
    let level = BT.normalizeLevel({ cols: cols, rows: rows, bolts: bolts });
    const need = Math.max(0, +spec.setupMin || 0);
    if (need > 0) {
      const moves = BT.legalMoves(level).filter(function (m) { return !m.extracted; });
      let buried = null;
      for (let i = 0; i < moves.length && !buried; i++) {
        const bolt = level.bolts.find(function (b) { return b.id === moves[i].id; });
        const stepped = bolt ? BT.stepBolt(level, bolt, moves[i].dir) : null;
        if (!stepped || stepped.extracted) continue;
        if (BT.exitBolts(stepped.level) !== 0) continue;
        const back = BT.OPP[moves[i].dir];
        const again = stepped.level.bolts.find(function (b) { return b.id === moves[i].id; });
        const undone = again ? BT.stepBolt(stepped.level, again, back) : null;
        if (!undone || undone.extracted || BT.exitBolts(undone.level) < 1) continue;
        const nudges = BT.legalMoves(stepped.level).filter(function (m) { return !m.extracted; });
        let first = null;
        for (let n = 0; n < nudges.length && !first; n++) {
          const who = stepped.level.bolts.find(function (b) { return b.id === nudges[n].id; });
          const hop = who ? BT.stepBolt(stepped.level, who, nudges[n].dir) : null;
          if (hop && !hop.extracted && BT.exitBolts(hop.level) > 0) first = nudges[n];
        }
        if (!first || first.id !== moves[i].id || first.dir !== back) continue;
        buried = stepped.level;
      }
      if (!buried) return null;
      level = BT.normalizeLevel(buried);
    }
    const order = level.bolts.map(function (b) { return b.id; }).sort(function (a, b) { return a - b; });
    const prof = BT.playOrder(level, order);
    if (!prof.ok) return null;
    if (prof.leaveMaxSeen > (spec.leaveMax == null ? 2 : spec.leaveMax)) return null;
    if ((prof.setups || 0) < need) return null;
    return { level: level, prof: prof };
  }

  BT.generate = function (spec, hunt) {
    // spec.between picks the exit rule for this deal. The play toggle stays put.
    const useHalf = !(spec && spec.between === false);
    const prevHalf = !!BT.halfGrid;
    BT.halfGrid = useHalf;
    try {
    const s = Object.assign({}, BT.defaultSpec(), spec || {});
    s.between = useHalf;
    s.shape = Object.assign(BT.defaultShape(), (spec && spec.shape) || s.shape || {});
    s.bolts = Math.max(3, Math.min(32, +s.bolts || 6));
    s.cols = Math.max(5, Math.min(24, +s.cols || 7));
    s.rows = Math.max(5, Math.min(24, +s.rows || 7));
    s.openingMin = Math.max(0, s.openingMin == null ? 1 : +s.openingMin);
    s.openingMax = Math.max(s.openingMin, +s.openingMax || s.openingMin);
    s.leaveMax = s.leaveMax == null ? 2 : Math.max(0, +s.leaveMax);
    s.setupMin = Math.max(0, +s.setupMin || 0);
    s.minLen = Math.max(2, Math.min(9, +s.minLen || 2));
    const tries = hunt == null ? 48 : hunt;
    const startSeed = (+s.seed || 1001) >>> 0;
    let best = null;
    let bestScore = -1e9;
    for (let t = 0; t < tries; t++) {
      const seed = (startSeed + t * 17) >>> 0;
      const packed = packChain(s, BT.mulberry32(seed));
      let level = packed ? packed.level : generateOnce(s, seed);
      if (!level.bolts.length) continue;
      const prof = packed ? packed.prof : level._flow;
      delete level._flow;
      if (!prof || !prof.ok) continue;
      const info = Object.assign({}, BT.metricsOf(level), prof, { winnable: true });
      info.opening = BT.exitBolts(level);
      if (info.opening < s.openingMin || info.opening > s.openingMax) continue;
      if (info.leaveMaxSeen > s.leaveMax) continue;
      if ((info.setups || 0) < s.setupMin) continue;
      const score = BT.scoreFlow(info, s);
      if (score > bestScore) {
        bestScore = score;
        best = { level: level, info: info, seed: seed, score: score };
      }
      const mixOk = info.bolts >= s.bolts - 1;
      const decisions = info.leaves && info.leaves.length ? info.leaves.length : info.bolts;
      const oneShare = decisions ? (info.ones || 0) / decisions : 0;
      if (mixOk && score >= 190 && oneShare >= 0.25) break;
    }
    if (!best) {
      const level = generateOnce(s, startSeed);
      const flow = level._flow || null;
      delete level._flow;
      const info = flow
        ? Object.assign({}, BT.metricsOf(level), flow)
        : Object.assign(BT.metricsOf(level), { winnable: false, opening: 0, bottleneck: 0, cascade: 0, forced: 0, leaveMaxSeen: 0, setups: 0, ones: 0, leaves: [] });
      best = { level: level, info: info, seed: startSeed, score: 0 };
    }
    return {
      level: best.level,
      info: best.info,
      seed: best.seed,
      score: best.score,
      spec: Object.assign({}, s, { seed: best.seed, between: useHalf })
    };
    } finally {
      BT.halfGrid = prevHalf;
    }
  };

  BT.handLevels = function () {
    return [];
  };
});
