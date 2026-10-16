(function () {
  "use strict";
  const BT = window.BT;
  const SAVE_KEY = "bolts-levels-v1";
  const SAVE_META_KEY = "bolts-meta-v1";
  const DATA_HIDE_KEY = "bolts-data-hide";

  const $ = function (id) { return document.getElementById(id); };
  const canvas = $("game");
  const ctx = canvas.getContext("2d");

  let SHIPPED_LEVELS = [];
  let spec = BT.defaultSpec();
  let draft = null;
  let live = null;
  let history = [];
  let selected = null;
  let hammerArmed = false;
  let hover = null;
  let flying = {};
  let shake = {};
  let busy = false;
  let overlayMode = "";
  let levelStarted = 0;
  let levelEnded = 0;
  let currentId = "";
  let huntNote = "";
  let drag = null;
  let preview = null;
  let sparks = [];
  let editTool = "play";
  let pen = null;
  let paintColor = 0;

  function isPlayOnly() {
    return document.documentElement.classList.contains("play-only");
  }
  function isFilePage() {
    return location.protocol === "file:";
  }

  function freshPlay(level) {
    live = BT.normalizeLevel(level);
    history = [];
    selected = null;
    hover = null;
    flying = {};
    shake = {};
    busy = false;
    drag = null;
    preview = null;
    hudShowsCount = false;
    levelStarted = performance.now();
    levelEnded = 0;
    hideOverlay();
    syncHud(true);
    refreshData();
  }

  function snapshot() {
    return { live: BT.clone(live) };
  }
  function pushHist() {
    history.push(snapshot());
    if (history.length > 80) history.shift();
  }

  let leaveCount = 0;
  let hudShowsCount = false;

  function levelTitle() {
    if (draft && draft.name) return draft.name;
    return "Level";
  }

  function countLabel() {
    const n = live ? live.bolts.length : 0;
    return n ? (n + " left · " + leaveCount + " can leave") : "Clear";
  }

  function syncHud(recount) {
    if (!live || !live.bolts.length) leaveCount = 0;
    else if (recount) leaveCount = BT.exitBolts(live);
    const pill = $("remainPill");
    const count = countLabel();
    pill.textContent = hudShowsCount ? count : levelTitle();
    pill.title = hudShowsCount ? levelTitle() : count;
    pill.setAttribute("aria-pressed", hudShowsCount ? "true" : "false");
    $("undoBtn").disabled = !history.length || busy;
  }

  function hideOverlay() {
    $("overlay").hidden = true;
    overlayMode = "";
  }
  function levelSeconds() {
    const end = levelEnded || performance.now();
    const started = levelStarted || end;
    return Math.max(0, Math.round((end - started) / 1000));
  }

  function showOverlay(title, text, primary, secondary, mode) {
    $("ovTitle").textContent = title;
    $("ovText").textContent = text;
    $("ovPrimary").textContent = primary;
    $("ovSecondary").textContent = secondary;
    const dur = $("ovDuration");
    if (mode === "win") {
      $("ovDurationTime").textContent = levelSeconds() + "s";
      dur.hidden = false;
    } else dur.hidden = true;
    overlayMode = mode;
    $("overlay").hidden = false;
  }

  function nextLabel() {
    const list = loadSaved();
    const i = list.findIndex(function (x) { return x.id === currentId; });
    return i >= 0 && i < list.length - 1 ? "Next level" : "Play again";
  }

  function finishIfClear() {
    if (busy) return;
    if (live && !live.bolts.length) {
      if (!levelEnded) levelEnded = performance.now();
      showOverlay("Clear", "Every bolt slid out.", nextLabel(), "Play again", "win");
    }
  }

  function stepOnce(bolt, dir) {
    if (!bolt || !live || !dir) return;
    const stepped = BT.stepBolt(live, bolt, dir);
    if (!stepped) {
      shake[bolt.id] = 1;
      return;
    }
    pushHist();
    live = stepped.level;
    if (stepped.extracted) {
      selected = null;
      shatter(stepped.bolt, dir);
      syncHud(true);
      return;
    }
    syncHud(true);
    refreshData();
    finishIfClear();
  }

  function slideBy(origin, id, dir, count) {
    let level = BT.clone(origin);
    let pose = null;
    let contact = null;
    for (let i = 0; i < count; i++) {
      const bolt = level.bolts.find(function (b) { return b.id === id; });
      if (!bolt) break;
      const stepped = BT.stepBolt(level, bolt, dir);
      if (!stepped) break;
      level = stepped.level;
      if (stepped.contact) contact = stepped.contact;
      if (stepped.extracted) {
        pose = stepped.bolt;
        break;
      }
    }
    return { level: level, pose: pose, contact: contact };
  }

  function shatter(bolt, dir) {
    if (!bolt) return;
    const cells = bolt.cells || [];
    const bits = [];
    const chunk = Math.max(2, Math.ceil(cells.length / 3));
    for (let i = 0; i < cells.length; i += chunk) {
      const part = cells.slice(i, i + chunk);
      if (part.length < 2 && bits.length) {
        bits[bits.length - 1].cells = bits[bits.length - 1].cells.concat(part);
        continue;
      }
      const sign = bits.length % 2 === 0 ? 1 : -1;
      bits.push({
        cells: part,
        rot: sign * (0.45 + (bits.length % 3) * 0.18),
        ox: sign * (0.35 + bits.length * 0.08),
        oy: -sign * 0.28
      });
    }
    flying[bolt.id] = { kind: "break", dir: dir, p: 0, bits: bits, color: bolt.color };
    busy = true;
    let last = performance.now();
    function step(now) {
      const rec = flying[bolt.id];
      if (!rec) {
        busy = Object.keys(flying).length > 0;
        return;
      }
      const dt = Math.min(32, Math.max(0, now - last));
      last = now;
      rec.p = Math.min(1, rec.p + dt / 480);
      if (rec.p < 1) requestAnimationFrame(step);
      else {
        delete flying[bolt.id];
        busy = Object.keys(flying).length > 0;
        syncHud(true);
        if (!busy) {
          refreshData();
          finishIfClear();
        }
      }
    }
    requestAnimationFrame(step);
  }

  function undo() {
    if (!history.length) return;
    const prev = history.pop();
    flying = {};
    shake = {};
    busy = false;
    drag = null;
    preview = null;
    levelEnded = 0;
    live = prev.live;
    selected = null;
    if (draft) draft.deal = BT.clone(live);
    hideOverlay();
    syncHud(true);
    refreshData();
  }

  function restart() {
    if (!draft) return;
    const src = draft._start || draft.deal;
    freshPlay(src);
  }

  function pointOnCanvas(ev) {
    const rect = canvas.getBoundingClientRect();
    const src = ev.touches ? ev.touches[0] : ev;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function pickFromEvent(ev) {
    if (!live) return null;
    const layout = BT.layoutBoard(canvas, live);
    const pt = pointOnCanvas(ev);
    const cell = BT.cellFromPoint(layout, pt.x, pt.y);
    if (!cell) return null;
    const bolt = BT.boltBodyAt(live, cell.r, cell.c);
    if (!bolt || BT.pointOnNut(bolt, layout, pt.x, pt.y)) return null;
    const heldNut = BT.nutsOf(bolt).some(function (n) {
      return n.r === cell.r && n.c === cell.c;
    });
    if (heldNut) return null;
    return bolt;
  }

  function resting(level) {
    const copy = BT.clone(level);
    (copy.bolts || []).forEach(function (b) {
      delete b.shift;
      delete b.shiftNuts;
    });
    return copy;
  }

  function stampBoard() {
    if (!live) return;
    const board = resting(live);
    if (!draft) {
      draft = {
        id: "m" + Date.now(),
        name: "Manual",
        spec: Object.assign({}, readSpec(), { manual: true, edited: true, cols: board.cols, rows: board.rows, bolts: board.bolts.length }),
        deal: board,
        _start: BT.clone(board)
      };
    } else {
      draft.deal = board;
      draft._start = BT.clone(board);
      draft.spec = Object.assign({}, draft.spec || readSpec(), {
        manual: true,
        edited: true,
        cols: board.cols,
        rows: board.rows,
        bolts: board.bolts.length
      });
    }
    syncHud(true);
    refreshData();
  }

  function adoptBolt(bolt, cell) {
    let cells = bolt.cells.map(function (p) { return { r: p.r, c: p.c }; });
    const da = Math.abs(cells[0].r - cell.r) + Math.abs(cells[0].c - cell.c);
    const db = Math.abs(cells[cells.length - 1].r - cell.r) + Math.abs(cells[cells.length - 1].c - cell.c);
    if (da < db) cells.reverse();
    pen = {
      id: bolt.id,
      color: bolt.color,
      cells: cells,
      nuts: BT.nutsOf(bolt).map(function (n) { return { r: n.r, c: n.c }; })
    };
    paintColor = bolt.color;
    selected = bolt.id;
    paintEditUi();
  }

  function commitPen() {
    if (!pen || pen.cells.length < 2 || !live) return;
    const id = pen.id != null ? pen.id : (live.bolts.reduce(function (m, b) { return Math.max(m, b.id + 1); }, 0));
    pen.id = id;
    const bolt = {
      id: id,
      color: pen.color,
      cells: pen.cells.map(function (p) { return { r: p.r, c: p.c }; }),
      nuts: pen.nuts || []
    };
    const rest = live.bolts.filter(function (b) { return b.id !== id; });
    live = BT.normalizeLevel({ cols: live.cols, rows: live.rows, bolts: rest.concat([bolt]) });
    const got = live.bolts.find(function (b) { return b.id === id; });
    if (got) pen.nuts = BT.nutsOf(got).map(function (n) { return { r: n.r, c: n.c }; });
  }

  function editAt(ev) {
    if (!live) return;
    const layout = BT.layoutBoard(canvas, live);
    const pt = pointOnCanvas(ev);
    const cell = BT.cellFromPoint(layout, pt.x, pt.y);
    if (!cell) return;
    if (editTool === "bolterase") {
      const bolt = BT.boltAt(live, cell.r, cell.c);
      if (!bolt && !(pen && pen.cells.some(function (p) { return p.r === cell.r && p.c === cell.c; }))) return;
      pushHist();
      if (bolt) live = BT.removeBolt(live, bolt.id);
      if (pen && (pen.id === (bolt && bolt.id) || pen.cells.some(function (p) { return p.r === cell.r && p.c === cell.c; }))) pen = null;
      stampBoard();
      return;
    }
    if (editTool === "nut" || editTool === "nuterase") {
      const bolt = BT.boltAt(live, cell.r, cell.c);
      if (!bolt) return;
      const idx = BT.cellIndex(bolt, cell);
      if (idx < 0 || BT.isBendIndex(bolt.cells, idx)) return;
      const nuts = BT.nutsOf(bolt).map(function (n) { return { r: n.r, c: n.c }; });
      const at = nuts.findIndex(function (n) { return n.r === cell.r && n.c === cell.c; });
      if (editTool === "nut") {
        if (at >= 0) return;
        nuts.push({ r: cell.r, c: cell.c });
      } else if (at >= 0) {
        nuts.splice(at, 1);
      } else return;
      pushHist();
      const next = Object.assign({}, bolt, { nuts: nuts, nut: nuts[0] || null });
      live = {
        cols: live.cols,
        rows: live.rows,
        bolts: live.bolts.map(function (b) { return b.id === bolt.id ? next : b; })
      };
      stampBoard();
      return;
    }
    if (editTool !== "bolt") return;
    const occupied = BT.boltAt(live, cell.r, cell.c);
    if (!pen || !pen.cells.length) {
      if (occupied) {
        adoptBolt(occupied, cell);
        return;
      }
      pen = { id: null, color: paintColor, cells: [{ r: cell.r, c: cell.c }], nuts: [] };
      return;
    }
    const last = pen.cells[pen.cells.length - 1];
    if (last.r === cell.r && last.c === cell.c) return;
    const touch = Math.abs(last.r - cell.r) + Math.abs(last.c - cell.c) === 1;
    if (!touch || (occupied && pen.id == null) || (occupied && pen.id != null && occupied.id !== pen.id)) {
      pushHist();
      commitPen();
      pen = occupied ? null : { id: null, color: paintColor, cells: [{ r: cell.r, c: cell.c }], nuts: [] };
      stampBoard();
      return;
    }
    if (pen.cells.some(function (p) { return p.r === cell.r && p.c === cell.c; })) return;
    pushHist();
    pen.cells.push({ r: cell.r, c: cell.c });
    commitPen();
    stampBoard();
  }

  function paintEditUi() {
    document.querySelectorAll("#editSeg [data-tool]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-tool") === editTool);
    });
    const box = $("colorPick");
    if (box && !box.childElementCount) {
      BT.PALETTE.forEach(function (pal, i) {
        const b = document.createElement("button");
        b.type = "button";
        b.style.background = pal.fill;
        b.title = pal.name;
        b.addEventListener("click", function () {
          paintColor = i;
          paintEditUi();
        });
        box.appendChild(b);
      });
    }
    if (box) {
      Array.prototype.forEach.call(box.children, function (b, i) {
        b.classList.toggle("active", i === paintColor);
      });
    }
  }

  function bestDir(bolt, dx, dy) {
    const len = Math.hypot(dx, dy) || 1;
    const vx = dx / len;
    const vy = dy / len;
    const dirs = BT.slideDirs(bolt, drag && drag.origin);
    let best = null;
    let bestDot = dirs.length === 1 ? 0.34 : 0.5;
    dirs.forEach(function (dir) {
      const s = BT.SCREEN[dir];
      const dot = s.x * vx + s.y * vy;
      if (dot > bestDot) {
        bestDot = dot;
        best = dir;
      }
    });
    return best;
  }

  function trackDrag(ev) {
    if (!drag) return;
    const pt = pointOnCanvas(ev);
    const dx = pt.x - drag.x;
    const dy = pt.y - drag.y;
    const originBolt = drag.origin.bolts.find(function (b) { return b.id === drag.id; });
    if (!originBolt) return;
    if (!drag.dir) {
      if (Math.hypot(dx, dy) < 8) {
        preview = null;
        return;
      }
      drag.dir = bestDir(originBolt, dx, dy);
      if (!drag.dir) return;
      const moveMode = BT.moveMode(originBolt, drag.dir, drag.origin);
      drag.cross = moveMode === "cross" || moveMode === "snug";
      drag.max = BT.slideInfo(drag.origin, originBolt, drag.dir).steps;
    }
    const layout = BT.layoutBoard(canvas, drag.origin);
    const s = BT.SCREEN[drag.dir];
    const along = dx * s.x + dy * s.y;
    const grain = BT.halfGrid && !drag.cross ? layout.cell * 0.5 : layout.cell;
    let steps = Math.round(along / grain);
    if (steps < 0) steps = 0;
    drag.over = steps > drag.max;
    if (steps > drag.max) steps = drag.max;
    if (steps === drag.steps && live) {
      const frac = along / grain - steps;
      if (!drag.over && Math.abs(frac) > 0.04) {
        preview = { id: drag.id, x: s.x * frac * layout.cell * 0.22, y: s.y * frac * layout.cell * 0.22, nuts: !!drag.cross };
      } else preview = null;
      if (drag.over) {
        shake[drag.id] = 0.35;
        const held = live && live.bolts.find(function (b) { return b.id === drag.id; });
        bumpSpark(drag.touch || facingPoint(held, drag.dir));
      }
      return;
    }
    drag.steps = steps;
    const slid = slideBy(drag.origin, drag.id, drag.dir, steps);
    if (slid.contact) drag.touch = slid.contact;
    live = slid.level;
    if (slid.pose) {
      const info = drag;
      drag = null;
      preview = null;
      history.push({ live: info.origin });
      if (history.length > 80) history.shift();
      selected = null;
      shatter(slid.pose, info.dir);
      syncHud(true);
      return;
    }
    const frac = along / grain - steps;
    if (!drag.over && Math.abs(frac) > 0.04) {
      preview = { id: drag.id, x: s.x * frac * layout.cell * 0.22, y: s.y * frac * layout.cell * 0.22, nuts: !!drag.cross };
    } else preview = null;
    if (drag.over || slid.contact) {
      const held = live && live.bolts.find(function (b) { return b.id === drag.id; });
      bumpSpark(drag.touch || facingPoint(held, drag.dir));
    }
    if (drag.over) shake[drag.id] = 0.35;
  }

  function facingPoint(bolt, dir) {
    if (!bolt || !BT.DIRS[dir]) return null;
    const d = BT.DIRS[dir];
    const sh = bolt.shift || { dr: 0, dc: 0 };
    let best = null;
    let score = -1e9;
    bolt.cells.forEach(function (p) {
      const r = p.r + (sh.dr || 0);
      const c = p.c + (sh.dc || 0);
      const s = r * d.dr + c * d.dc;
      if (s > score) {
        score = s;
        best = { r: r, c: c };
      }
    });
    return best;
  }

  function bumpSpark(at) {
    if (!drag || drag.sparked || !at) return;
    drag.sparked = true;
    sparks.push({ r: at.r, c: at.c, p: 0 });
    if (sparks.length > 8) sparks.shift();
  }

  function endDrag(ev) {
    if (!drag) return;
    trackDrag(ev);
    if (!drag) return;
    const info = drag;
    drag = null;
    preview = null;
    if (info.steps > 0) {
      history.push({ live: info.origin });
      if (history.length > 80) history.shift();
      if (info.over) shake[info.id] = 1;
      selected = live.bolts.some(function (b) { return b.id === info.id; }) ? info.id : null;
      syncHud(true);
      refreshData();
      finishIfClear();
      return;
    }
    if (info.over) shake[info.id] = 1;
    const pt = pointOnCanvas(ev);
    if (Math.hypot(pt.x - info.x, pt.y - info.y) > 14) return;
    const layout = BT.layoutBoard(canvas, live);
    const cell = BT.cellFromPoint(layout, pt.x, pt.y);
    const bolt = live.bolts.find(function (b) { return b.id === info.id; });
    if (!bolt || !cell) return;
    const end = BT.ends(bolt).find(function (e) { return e.r === cell.r && e.c === cell.c; });
    if (end) stepOnce(bolt, end.dir);
  }

  canvas.addEventListener("pointerdown", function (ev) {
    if (overlayMode) return;
    if (editTool !== "play") {
      editAt(ev);
      return;
    }
    const bolt = pickFromEvent(ev);
    const pt = pointOnCanvas(ev);
    if (hammerArmed) {
      if (bolt) breakBolt(bolt);
      return;
    }
    if (!bolt || flying[bolt.id]) {
      selected = null;
      drag = null;
      return;
    }
    selected = bolt.id;
    drag = { id: bolt.id, x: pt.x, y: pt.y, origin: BT.clone(live), dir: null, steps: 0, max: 0, over: false };
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) {}
  });

  canvas.addEventListener("pointermove", function (ev) {
    if (!drag) {
      const bolt = pickFromEvent(ev);
      hover = bolt ? bolt.id : null;
      return;
    }
    hover = drag.id;
    trackDrag(ev);
  });

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener("pointerleave", function () { hover = null; });
  $("undoBtn").addEventListener("click", undo);
  $("remainPill").addEventListener("click", function () {
    hudShowsCount = !hudShowsCount;
    syncHud(true);
  });
  $("restart").addEventListener("click", restart);
  $("ovPrimary").addEventListener("click", function () {
    if (overlayMode === "win") {
      const list = loadSaved();
      const i = list.findIndex(function (x) { return x.id === currentId; });
      if (i >= 0 && i < list.length - 1) playItem(list[i + 1]);
      else restart();
    } else restart();
  });
  $("ovSecondary").addEventListener("click", function () {
    if (overlayMode === "win") restart();
    else hideOverlay();
  });

  function loop() {
    Object.keys(shake).forEach(function (id) {
      shake[id] -= 0.08;
      if (shake[id] <= 0) delete shake[id];
    });
    if (sparks.length) {
      const next = [];
      for (let i = 0; i < sparks.length; i++) {
        sparks[i].p += 0.045;
        if (sparks[i].p < 1) next.push(sparks[i]);
      }
      sparks = next;
    }
    if (live) {
      const layout = BT.layoutBoard(canvas, live);
      const focus = hover != null ? hover : selected;
      BT.drawBoard(ctx, live, layout, {
        flying: flying,
        shake: shake,
        selected: selected,
        hover: focus,
        preview: preview,
        sparks: sparks,
        pen: pen,
        t: performance.now() / 1000
      });
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function readSpec() {
    spec.cols = +$("pCols").value || 7;
    spec.rows = +$("pRows").value || 7;
    spec.bolts = +$("pBolts").value || 6;
    spec.openingMin = +$("pOpenMin").value || 1;
    spec.openingMax = +$("pOpenMax").value || 3;
    spec.laneMin = Math.max(0, +$("pBlocks").value || 0);
    spec.leaveMax = Math.max(0, +$("pLeaveMax").value || 0);
    spec.setupMin = Math.max(0, +$("pSetups").value || 0);
    spec.minLen = Math.max(2, +$("pMinLen").value || 2);
    spec.seed = +$("pSeed").value || 1001;
    spec.shape = {
      I: +$("pI").value || 0,
      L: +$("pL").value || 0,
      C: +$("pC").value || 0,
      S: +$("pS").value || 0
    };
    if (spec.openingMax < spec.openingMin) spec.openingMax = spec.openingMin;
    return spec;
  }

  function writeSpec(s) {
    spec = Object.assign(BT.defaultSpec(), s || {});
    spec.shape = Object.assign(BT.defaultShape(), (s && s.shape) || spec.shape || {});
    $("pCols").value = spec.cols;
    $("pRows").value = spec.rows;
    $("pBolts").value = spec.bolts;
    $("pOpenMin").value = spec.openingMin;
    $("pOpenMax").value = spec.openingMax;
    $("pBlocks").value = spec.laneMin != null ? spec.laneMin : 1;
    $("pLeaveMax").value = spec.leaveMax != null ? spec.leaveMax : 2;
    $("pSetups").value = spec.setupMin != null ? spec.setupMin : 0;
    $("pMinLen").value = spec.minLen != null ? spec.minLen : 4;
    $("pSeed").value = spec.seed;
    if (typeof spec.between === "boolean") paintSolution(spec.between);
    $("pI").value = spec.shape.I;
    $("pL").value = spec.shape.L;
    $("pC").value = spec.shape.C;
    $("pS").value = spec.shape.S;
    document.querySelectorAll("#bandSeg [data-band]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-band") === (spec.band || "medium"));
    });
  }

  function solutionBetween() {
    const btn = document.querySelector("#solSeg [data-between].active");
    return !btn || btn.getAttribute("data-between") !== "off";
  }

  function paintSolution(on) {
    document.querySelectorAll("#solSeg [data-between]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-between") === (on ? "on" : "off"));
    });
  }

  function solutionName(on) {
    return on ? "Gridless on" : "Gridless off";
  }

  function madeUnder(item) {
    const s = (item && item.spec) || {};
    if (s.between === false) return "Gridless off";
    if (s.between === true) return "Gridless on";
    if (s.band === "manual" && !s.seed) return "Hand";
    return "Gridless on";
  }

  function withSolution(on, fn) {
    const prev = !!BT.halfGrid;
    BT.halfGrid = !!on;
    try { return fn(); }
    finally { BT.halfGrid = prev; }
  }

  function setWinNote(info, on) {
    const el = $("winCheckNote");
    if (!info) { el.textContent = ""; el.className = "field-hint win-check"; return; }
    const rule = solutionName(on == null ? solutionBetween() : on);
    el.className = "field-hint win-check " + (info.winnable ? "is-winnable" : "is-unwinnable");
    if (!info.winnable) {
      el.textContent = "Unwinnable under " + rule + ". Some bolt stays boxed in for every order.";
      return;
    }
    el.textContent = "Winnable under " + rule + ". Opening " + info.opening + " · bottleneck " + info.bottleneck + " · cascade +" + info.cascade + " · forced " + info.forced;
  }

  function applyGenerated(pack, name) {
    const level = pack.level;
    draft = {
      id: "d" + Date.now(),
      name: name || "Draft",
      spec: Object.assign({}, pack.spec, { edited: false }),
      deal: BT.clone(level),
      _start: BT.clone(level),
      info: pack.info
    };
    currentId = "";
    writeSpec(pack.spec);
    $("pSeed").value = pack.seed;
    huntNote = "Seed " + pack.seed + " · score " + Math.round(pack.score || 0) + " · " + solutionName(pack.spec.between !== false);
    freshPlay(level);
    setWinNote(pack.info, pack.spec.between !== false);
  }

  $("genBtn").addEventListener("click", function () {
    const s = readSpec();
    s.between = solutionBetween();
    s.seed = ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
    $("pSeed").value = s.seed;
    $("genBtn").disabled = true;
    $("genBtn").textContent = "Hunting…";
    setTimeout(function () {
      const pack = BT.generate(s, 56);
      $("genBtn").disabled = false;
      $("genBtn").textContent = "Generate";
      applyGenerated(pack, "Draft");
      renderSaved();
    }, 30);
  });

  $("winCheckBtn").addEventListener("click", function () {
    if (!live) return;
    const on = solutionBetween();
    const info = withSolution(on, function () { return BT.analyze(live); });
    if (draft) draft.info = info;
    setWinNote(info, on);
    refreshData();
  });

  function paintHammer() {
    const btn = $("hammerBtn");
    btn.classList.toggle("active", hammerArmed);
    btn.setAttribute("aria-pressed", hammerArmed ? "true" : "false");
    canvas.classList.toggle("hammer-armed", hammerArmed);
  }

  function breakBolt(bolt) {
    if (!bolt || !live || flying[bolt.id]) return;
    const pose = BT.clone(bolt);
    pushHist();
    live = BT.removeBolt(live, bolt.id);
    selected = null;
    hover = null;
    hammerArmed = false;
    paintHammer();
    shatter(pose, "N");
    syncHud(true);
    refreshData();
    finishIfClear();
  }

  $("hammerBtn").addEventListener("click", function () {
    hammerArmed = !hammerArmed;
    drag = null;
    paintHammer();
  });

  document.querySelectorAll("#bandSeg [data-band]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const band = btn.getAttribute("data-band");
      if (band === "any") {
        spec.band = "any";
        writeSpec(spec);
        return;
      }
      writeSpec(BT.applyBand(readSpec(), band));
    });
  });

  document.querySelectorAll("#solSeg [data-between]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("#solSeg [data-between]").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
    });
  });

  document.querySelectorAll("#editSeg [data-tool]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      editTool = btn.getAttribute("data-tool") || "play";
      if (editTool !== "bolt") {
        if (pen && pen.cells.length >= 2) {
          pushHist();
          commitPen();
          stampBoard();
        }
        pen = null;
      }
      paintEditUi();
    });
  });

  $("editBtn").addEventListener("click", function () {
    const src = (draft && draft._start) ? draft._start : live;
    if (!src) return;
    pen = null;
    freshPlay(src);
    editTool = "bolt";
    paintEditUi();
    huntNote = (draft && draft.name ? draft.name : "Level") + " · editing";
    refreshData();
  });

  $("blankBtn").addEventListener("click", function () {
    const s = readSpec();
    editTool = "bolt";
    pen = null;
    paintEditUi();
    freshPlay({ cols: s.cols, rows: s.rows, bolts: [] });
    draft = {
      id: "m" + Date.now(),
      name: "Manual",
      spec: Object.assign({}, s, { manual: true }),
      deal: BT.clone(live),
      _start: BT.clone(live)
    };
    currentId = "";
    huntNote = "manual";
    renderSaved();
    renderPlayLevels();
  });

  $("halfBtn").addEventListener("click", function () {
    BT.halfGrid = !BT.halfGrid;
    $("halfBtn").classList.toggle("active", !!BT.halfGrid);
    if (live) {
      live = {
        cols: live.cols,
        rows: live.rows,
        bolts: live.bolts.map(function (b) {
          if (BT.halfGrid) return b;
          const n = BT.clone(b);
          n.shift = null;
          n.shiftNuts = false;
          return n;
        })
      };
    }
    syncHud(true);
    refreshData();
  });

  $("arrowBtn").addEventListener("click", function () {
    BT.showArrows = !BT.showArrows;
    $("arrowBtn").classList.toggle("active", !!BT.showArrows);
  });

  function setSkin(name) {
    BT.blockSkin = name === "block";
    BT.jewelSkin = name === "jewel";
    document.querySelectorAll("#skinSeg [data-skin]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-skin") === name);
    });
  }

  document.querySelectorAll("#skinSeg [data-skin]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setSkin(btn.getAttribute("data-skin") || "block");
    });
  });

  function setLock(name) {
    BT.lockStyle = name || "nut";
    document.querySelectorAll("#lockSeg [data-lock]").forEach(function (btn) {
      btn.classList.toggle("active", btn.getAttribute("data-lock") === BT.lockStyle);
    });
  }

  document.querySelectorAll("#lockSeg [data-lock]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      setLock(btn.getAttribute("data-lock"));
    });
  });

  paintEditUi();

  function row(k, v) {
    return '<div class="diff-row"><b>' + k + "</b><strong>" + v + "</strong></div>";
  }
  function metric(k, v) {
    return "<div><span>" + k + "</span> " + v + "</div>";
  }

  function refreshData() {
    if (isPlayOnly()) return;
    const board = live;
    if (!board) return;
    const info = BT.metricsOf(board);
    const shapes = info.shapes || { I: 0, L: 0, C: 0, S: 0 };
    $("dataMeta").textContent = (draft && draft.name ? draft.name : "Draft") + (huntNote ? " · " + huntNote : "");
    $("diffBox").innerHTML =
      row("Board", info.bolts + " bolts · " + board.cols + "×" + board.rows + " · fill " + Math.round(info.fill * 100) + "%") +
      row("Shapes", "I " + shapes.I + " · L " + shapes.L + " · C " + shapes.C + " · S " + shapes.S);
    $("dataMetrics").innerHTML =
      metric("I", shapes.I) + metric("L", shapes.L) + metric("C", shapes.C) + metric("S", shapes.S);
    const colors = $("dataColors");
    colors.innerHTML = "";
    (board.bolts || []).forEach(function (b) {
      const pal = BT.colorOf(b.color);
      const ends = BT.slideDirs(b, board).map(function (dir) {
        const info = BT.slideInfo(board, b, dir);
        if (info.extracts) return dir + " out";
        if (info.steps > 0) return dir + " +" + info.steps;
        return dir + " stop";
      }).join(" · ");
      const sw = document.createElement("div");
      sw.className = "swatch";
      sw.innerHTML = '<i class="dot" style="background:' + pal.fill + '"></i>' + (b.shape || "?") + " · " + ends;
      colors.appendChild(sw);
    });
  }

  function applyDataHidden(hidden) {
    document.querySelector(".studio").classList.toggle("data-hidden", hidden);
    $("dataHideBtn").textContent = hidden ? "Show" : "Hide";
  }
  $("dataHideBtn").addEventListener("click", function () {
    const hidden = !document.querySelector(".studio").classList.contains("data-hidden");
    applyDataHidden(hidden);
    try { localStorage.setItem(DATA_HIDE_KEY, hidden ? "1" : "0"); } catch (e) {}
  });
  try { if (localStorage.getItem(DATA_HIDE_KEY) === "1") applyDataHidden(true); } catch (e) {}

  function itemHasDeal(item) {
    return !!(item && item.id && item.deal && (item.deal.bolts || item.deal.blocks));
  }
  function cloneLevels(list) { return JSON.parse(JSON.stringify(list || [])); }
  function shippedList() { return SHIPPED_LEVELS || []; }
  function loadLocal() {
    try {
      const list = JSON.parse(localStorage.getItem(SAVE_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }
  function loadMeta() {
    try { return JSON.parse(localStorage.getItem(SAVE_META_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function persistMeta(meta) {
    try { localStorage.setItem(SAVE_META_KEY, JSON.stringify(meta)); } catch (e) {}
  }
  function catalogHash(list) {
    return (list || []).map(function (x) { return (x && x.id) + "\t" + (x && x.name); }).join("\n");
  }
  function applyCatalogIndexes(list) {
    (list || []).forEach(function (x, i) { if (x) x.index = i + 1; });
  }
  function mergeCatalog(prefer, extra) {
    const meta = loadMeta();
    const deleted = new Set(meta.deleted || []);
    const byId = new Map();
    (prefer || []).forEach(function (x) {
      if (x && x.id && !deleted.has(x.id)) byId.set(x.id, x);
    });
    (extra || []).forEach(function (x) {
      if (!x || !x.id || deleted.has(x.id)) return;
      byId.set(x.id, cloneLevels([x])[0]);
    });
    const order = Array.isArray(meta.order) && meta.order.length ? meta.order : (prefer || []).map(function (x) { return x.id; });
    const seen = new Set();
    const out = [];
    order.forEach(function (id) {
      if (byId.has(id) && !seen.has(id)) { out.push(byId.get(id)); seen.add(id); }
    });
    byId.forEach(function (item, id) {
      if (!seen.has(id)) { out.push(item); seen.add(id); }
    });
    return out;
  }
  function loadSaved() {
    const shipped = shippedList();
    if (isPlayOnly()) return cloneLevels(shipped).filter(itemHasDeal);
    const local = loadLocal().filter(itemHasDeal);
    return mergeCatalog(local, shipped).filter(itemHasDeal);
  }
  function shipCatalog(list) {
    if (isPlayOnly() || isFilePage()) return;
    const copy = cloneLevels(list);
    SHIPPED_LEVELS = copy;
    const body = JSON.stringify({ rev: Date.now(), levels: copy });
    fetch("levels.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body,
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) return;
      const meta = loadMeta();
      meta.dirty = 0;
      meta.pulled = catalogHash(copy);
      persistMeta(meta);
    }).catch(function () {});
  }
  function writeSaved(list) {
    if (isPlayOnly()) return;
    applyCatalogIndexes(list);
    const copy = cloneLevels(list);
    const currentIds = new Set(copy.map(function (x) { return x.id; }));
    const prev = loadMeta();
    const deleted = [];
    const seenDel = new Set();
    function remember(id) {
      if (!id || currentIds.has(id) || seenDel.has(id)) return;
      seenDel.add(id);
      deleted.push(id);
    }
    (prev.deleted || []).forEach(remember);
    shippedList().forEach(function (x) { remember(x && x.id); });
    SHIPPED_LEVELS = copy;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(copy)); } catch (e) {}
    persistMeta({
      order: copy.map(function (x) { return x.id; }),
      deleted: deleted,
      rev: Date.now(),
      dirty: 1,
      pulled: prev.pulled || "",
      source: "editor"
    });
    shipCatalog(copy);
  }

  function rememberStart(item) {
    const copy = BT.clone(item);
    copy._start = BT.clone(item.deal);
    return copy;
  }

  function setHalf(on) {
    BT.halfGrid = !!on;
    const btn = $("halfBtn");
    if (btn) btn.classList.toggle("active", BT.halfGrid);
  }

  function playItem(item) {
    currentId = item.id;
    draft = rememberStart(item);
    huntNote = item.spec && item.spec.seed ? "seed " + item.spec.seed : "";
    if (item.spec && typeof item.spec.between === "boolean") {
      paintSolution(item.spec.between);
      setHalf(item.spec.between);
    }
    freshPlay(item.deal);
    renderSaved();
    renderPlayLevels();
    closeMenus();
  }

  function renderSaved() {
    if (isPlayOnly()) return;
    const box = $("savedLevels");
    box.innerHTML = "";
    loadSaved().forEach(function (item, idx) {
      const rowEl = document.createElement("div");
      rowEl.className = "saved-level" + (item.id === currentId ? " is-active" : "");
      rowEl.innerHTML =
        '<button type="button" class="drag-handle" aria-label="Reorder">≡</button>' +
        '<span class="level-index">' + (idx + 1) + "</span>" +
        '<div class="meta"><input class="level-name-in" maxlength="80" /><span></span></div>' +
        '<button type="button" class="play-level">Play</button>' +
        '<button type="button" class="btn-secondary del">Del</button>';
      const nameIn = rowEl.querySelector(".level-name-in");
      nameIn.value = item.name || "Level";
      const n = item.deal && item.deal.bolts ? item.deal.bolts.length : 0;
      rowEl.querySelector(".meta span").textContent = n + " bolts · " + (item.deal.cols || "?") + "×" + (item.deal.rows || "?") + " · " + madeUnder(item);
      nameIn.addEventListener("change", function () {
        const all = loadSaved();
        const found = all.find(function (x) { return x.id === item.id; });
        if (found) {
          found.name = nameIn.value.trim() || "Level";
          if (draft && draft.id === found.id) {
            draft.name = found.name;
            syncHud(false);
          }
        }
        writeSaved(all);
        renderSaved();
        renderPlayLevels();
      });
      rowEl.querySelector(".play-level").addEventListener("click", function () { playItem(item); });
      rowEl.querySelector(".del").addEventListener("click", function () {
        writeSaved(loadSaved().filter(function (x) { return x.id !== item.id; }));
        renderSaved();
        renderPlayLevels();
      });
      bindDrag(rowEl, item.id);
      box.appendChild(rowEl);
    });
  }

  function bindDrag(rowEl, id) {
    const handle = rowEl.querySelector(".drag-handle");
    handle.addEventListener("pointerdown", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const startY = ev.clientY;
      const from = loadSaved().findIndex(function (x) { return x.id === id; });
      rowEl.classList.add("is-dragging");
      function move(e) { rowEl.style.transform = "translateY(" + (e.clientY - startY) + "px)"; }
      function up(e) {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        rowEl.classList.remove("is-dragging");
        rowEl.style.transform = "";
        const all = loadSaved();
        const h = rowEl.getBoundingClientRect().height + 8;
        let to = from + Math.round((e.clientY - startY) / h);
        to = Math.max(0, Math.min(all.length - 1, to));
        if (to === from) return;
        const next = all.slice();
        const it = next.splice(from, 1)[0];
        next.splice(to, 0, it);
        writeSaved(next);
        renderSaved();
        renderPlayLevels();
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    });
  }

  function renderPlayLevels() {
    const box = $("playLevels");
    box.innerHTML = "";
    loadSaved().forEach(function (item, idx) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = (idx + 1) + ". " + (item.name || "Level");
      if (item.id === currentId) b.classList.add("is-active");
      b.addEventListener("click", function () { playItem(item); });
      box.appendChild(b);
    });
  }

  function closeMenus() {
    $("playLevels").hidden = true;
    $("levelsBtn").setAttribute("aria-expanded", "false");
  }
  $("levelsBtn").addEventListener("click", function () {
    const open = $("playLevels").hidden;
    $("playLevels").hidden = !open;
    $("levelsBtn").setAttribute("aria-expanded", open ? "true" : "false");
  });

  function freshLevelName(list, base) {
    let root = base && base !== "Draft" ? String(base) : "Level";
    root = root.replace(/ \d+$/, "");
    const used = {};
    list.forEach(function (x) {
      if (x && x.name) used[x.name] = true;
    });
    if (!used[root]) return root;
    let n = 2;
    while (used[root + " " + n]) n += 1;
    return root + " " + n;
  }

  $("saveBtn").addEventListener("click", function () {
    if (!live) return;
    const list = loadSaved();
    const source = resting((draft && draft._start) ? draft._start : live);
    const produced = draft && draft.spec && typeof draft.spec.between === "boolean" ? draft.spec.between : solutionBetween();
    const info = withSolution(produced, function () { return BT.analyze(source); });
    const keptName = draft && draft.name ? draft.name : "";
    const item = {
      id: "c" + Date.now(),
      name: freshLevelName(list, keptName),
      spec: Object.assign({}, (draft && draft.spec) || readSpec(), {
        cols: source.cols,
        rows: source.rows,
        bolts: source.bolts.length,
        manual: true,
        edited: true,
        between: produced
      }),
      deal: BT.clone(source),
      info: {
        winnable: info.winnable,
        opening: info.opening,
        bottleneck: info.bottleneck,
        cascade: info.cascade,
        forced: info.forced,
        shapes: info.shapes
      }
    };
    const idx = list.findIndex(function (x) { return x.id === item.id; });
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    writeSaved(list);
    currentId = item.id;
    draft = rememberStart(item);
    freshPlay(item.deal);
    $("levelIoHint").textContent = "Saved " + item.name;
    renderSaved();
    renderPlayLevels();
  });

  $("exportLevelBtn").addEventListener("click", function () {
    const list = loadSaved();
    const item = draft || list.find(function (x) { return x.id === currentId; });
    if (!item) return;
    const out = { id: item.id, name: item.name, spec: item.spec, deal: item._start || item.deal };
    $("levelJsonIo").value = JSON.stringify(out, null, 2);
    $("levelIoHint").textContent = "Exported " + (item.name || "draft");
  });
  $("copyLevelBtn").addEventListener("click", function () {
    const t = $("levelJsonIo");
    t.focus();
    t.select();
    try {
      document.execCommand("copy");
      $("levelIoHint").textContent = "Copied.";
    } catch (e) {
      $("levelIoHint").textContent = "Copy failed.";
    }
  });
  $("importLevelBtn").addEventListener("click", function () {
    try {
      const raw = JSON.parse($("levelJsonIo").value);
      const item = raw.deal ? raw : { id: "c" + Date.now(), name: "Imported", spec: readSpec(), deal: raw };
      if (!item.id) item.id = "c" + Date.now();
      if (!item.deal && (raw.bolts || raw.blocks)) item.deal = { cols: raw.cols, rows: raw.rows, bolts: raw.bolts || raw.blocks };
      item.deal = BT.normalizeLevel(item.deal);
      const list = loadSaved();
      const idx = list.findIndex(function (x) { return x.id === item.id; });
      if (idx >= 0) list[idx] = item;
      else list.push(item);
      writeSaved(list);
      playItem(item);
      $("levelIoHint").textContent = "Imported " + item.name;
    } catch (e) {
      $("levelIoHint").textContent = "Invalid JSON";
    }
  });

  function applyShipped(list, rev) {
    const incoming = (list || []).filter(itemHasDeal);
    if (!incoming.length) return false;
    const copy = cloneLevels(incoming);
    SHIPPED_LEVELS = copy;
    if (isPlayOnly()) return true;
    const meta = loadMeta();
    const deleted = new Set(meta.deleted || []);
    const incomingIds = new Set(copy.map(function (x) { return x.id; }));
    String(meta.pulled || "").split("\n").forEach(function (line) {
      const id = line.split("\t")[0];
      if (id && !incomingIds.has(id)) deleted.add(id);
    });
    const local = loadLocal().filter(function (x) { return itemHasDeal(x) && x.id && !deleted.has(x.id); });
    const byId = new Map();
    local.forEach(function (x) { byId.set(x.id, x); });
    // A newer ship replaces the same id. Levels that exist only on this
    // machine stay, and a level the player deleted stays deleted.
    copy.forEach(function (x) {
      if (!x || !x.id || deleted.has(x.id)) return;
      byId.set(x.id, x);
    });
    const order = Array.isArray(meta.order) && meta.order.length ? meta.order.slice() : [];
    copy.forEach(function (x) { if (x && x.id && order.indexOf(x.id) < 0) order.push(x.id); });
    local.forEach(function (x) { if (x && x.id && order.indexOf(x.id) < 0) order.push(x.id); });
    const seen = new Set();
    const merged = [];
    order.forEach(function (id) {
      if (byId.has(id) && !seen.has(id)) { merged.push(byId.get(id)); seen.add(id); }
    });
    byId.forEach(function (item, id) {
      if (!seen.has(id)) { merged.push(item); seen.add(id); }
    });
    applyCatalogIndexes(merged);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(merged)); } catch (e) {}
    persistMeta({
      order: merged.map(function (x) { return x.id; }),
      deleted: Array.from(deleted).filter(function (id) {
        return !merged.some(function (x) { return x.id === id; });
      }),
      rev: rev || meta.rev || Date.now(),
      dirty: meta.dirty || 0,
      pulled: catalogHash(copy),
      source: meta.source || "shipped"
    });
    return true;
  }

  function boot() {
    const embedded = window.EMBEDDED_LEVELS;
    if (embedded && Array.isArray(embedded.levels) && embedded.levels.length) {
      SHIPPED_LEVELS = cloneLevels(embedded.levels);
    }
    writeSpec(spec);
    const start = function () {
      const list = loadSaved();
      renderSaved();
      renderPlayLevels();
      if (list[0]) playItem(list[0]);
      else {
        const hands = BT.handLevels();
        if (hands[0]) playItem(hands[0]);
      }
    };
    if (isFilePage()) { start(); return; }
    fetch("levels.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("no catalog");
      return r.json();
    }).then(function (data) {
      const levels = Array.isArray(data) ? data : (data && data.levels) || [];
      if (levels.length) applyShipped(levels, data && data.rev);
      start();
    }).catch(function () { start(); });
  }

  boot();
})();
