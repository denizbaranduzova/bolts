(function (factory) {
  const g = typeof globalThis !== "undefined" ? globalThis : this;
  const BT = (g.BT = g.BT || {});
  factory(BT);
  if (typeof module !== "undefined" && module.exports) module.exports = BT;
})(function (BT) {
  "use strict";

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function roundCorners(ctx, x, y, w, h, rtl, rtr, rbr, rbl) {
    const cap = Math.min(Math.abs(w), Math.abs(h)) / 2;
    rtl = Math.min(rtl, cap);
    rtr = Math.min(rtr, cap);
    rbr = Math.min(rbr, cap);
    rbl = Math.min(rbl, cap);
    ctx.beginPath();
    ctx.moveTo(x + rtl, y);
    ctx.arcTo(x + w, y, x + w, y + h, rtr);
    ctx.arcTo(x + w, y + h, x, y + h, rbr);
    ctx.arcTo(x, y + h, x, y, rbl);
    ctx.arcTo(x, y, x + w, y, rtl);
    ctx.closePath();
  }

  function strokeChain(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  }

  function chainLength(pts) {
    let n = 0;
    for (let i = 1; i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
  }

  function distToIndex(pts, index) {
    let n = 0;
    for (let i = 1; i <= index && i < pts.length; i++) n += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    return n;
  }

  function pointAlong(pts, dist) {
    let left = Math.max(0, dist);
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      const len = Math.hypot(dx, dy) || 1;
      if (left <= len) {
        const t = left / len;
        return { x: pts[i - 1].x + dx * t, y: pts[i - 1].y + dy * t, angle: Math.atan2(dy, dx) };
      }
      left -= len;
    }
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  function bendIndexes(pts) {
    const bends = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a1 = Math.atan2(pts[i].y - pts[i - 1].y, pts[i].x - pts[i - 1].x);
      const a2 = Math.atan2(pts[i + 1].y - pts[i].y, pts[i + 1].x - pts[i].x);
      const turn = Math.atan2(Math.sin(a2 - a1), Math.cos(a2 - a1));
      if (Math.abs(turn) > 0.4) bends.push(i);
    }
    return bends;
  }

  // The nut clamps the straight part of the shaft, never a tip.
  // On an L it sits on the arm just before the bend, like a collar in front of the curve.
  function gripOn(pts) {
    const total = chainLength(pts);
    const bends = bendIndexes(pts);
    if (bends.length >= 2) {
      const d0 = distToIndex(pts, bends[0]);
      const d1 = distToIndex(pts, bends[1]);
      return pointAlong(pts, (d0 + d1) / 2);
    }
    if (bends.length === 1) {
      const dBend = distToIndex(pts, bends[0]);
      const before = dBend;
      const after = total - dBend;
      if (before >= after) return pointAlong(pts, Math.max(8, before * 0.72));
      return pointAlong(pts, dBend + Math.max(8, after * 0.28));
    }
    return pointAlong(pts, total * 0.5);
  }

  function drawCollar(ctx, x, y, angle, shaft) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const len = shaft * 1.02;
    const dia = shaft * 1.42;
    const flange = shaft * 1.78;
    const cap = Math.max(2.4, shaft * 0.34);
    ctx.fillStyle = "#2a3036";
    ctx.strokeStyle = "#121417";
    ctx.lineWidth = Math.max(1, shaft * 0.06);
    roundRect(ctx, -len / 2 - cap * 0.15, -flange / 2, cap, flange, cap * 0.7);
    ctx.fill();
    ctx.stroke();
    roundRect(ctx, len / 2 - cap * 0.85, -flange / 2, cap, flange, cap * 0.7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#1a1e22";
    roundRect(ctx, -len / 2 + cap * 0.35, -dia / 2, len - cap * 0.7, dia, dia * 0.46);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-len * 0.12, -dia * 0.16);
    ctx.lineTo(len * 0.12, -dia * 0.16);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = Math.max(1, shaft * 0.07);
    ctx.stroke();
    ctx.restore();
  }

  function nutClip(cell, shaft) {
    if (BT.blockSkin || BT.jewelSkin) return !BT.halfGrid ? cell / 1.84 : Math.max(11, cell * 0.34);
    return shaft;
  }

  // Seated collar. Plain 2 lifts only the span that sits on the piece.
  function drawPlainSeated(ctx, x, y, angle, cell, raised) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const along = cell * 0.7;
    const across = cell * 0.92;
    const lip = cell * 0.1;
    const drop = cell * 0.12;
    const foot = cell * 0.22;
    ctx.fillStyle = "#1a1e22";
    roundRect(ctx, -(along / 2 + lip), -across / 2 - drop, along + lip * 2, foot, cell * 0.05);
    ctx.fill();
    roundRect(ctx, -(along / 2 + lip), across / 2 + drop - foot, along + lip * 2, foot, cell * 0.05);
    ctx.fill();
    roundRect(ctx, -along / 2, -across / 2, along, across, cell * 0.12);
    ctx.fill();
    if (raised) {
      const onPiece = cell * 0.78;
      const padAlong = along - cell * 0.16;
      ctx.fillStyle = "#2a3136";
      roundRect(ctx, -padAlong / 2, -onPiece / 2, padAlong, onPiece, cell * 0.04);
      ctx.fill();
      const ix = cell * 0.045;
      const top = cell * 0.035;
      const bot = cell * 0.09;
      ctx.fillStyle = "#5a656e";
      roundRect(ctx, -padAlong / 2 + ix, -onPiece / 2 + top, padAlong - ix * 2, onPiece - top - bot, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLock(ctx, x, y, angle, cell, shaft) {
    const style = BT.lockStyle || "nut";
    if (style === "plain") drawPlainSeated(ctx, x, y, angle, cell, false);
    else if (style === "plain2") drawPlainSeated(ctx, x, y, angle, cell, true);
    else drawCollar(ctx, x, y, angle, nutClip(cell, shaft));
  }

  // True when the pointer is on the lock, not the colored body around it.
  BT.pointOnNut = function (bolt, layout, x, y) {
    if (!bolt || !layout) return false;
    const cell = layout.cell;
    const shaft = Math.max(7, cell * 0.22);
    const shift = bolt.shiftNuts && bolt.shift ? bolt.shift : { dr: 0, dc: 0 };
    const nuts = BT.nutsOf(bolt);
    for (let i = 0; i < nuts.length; i++) {
      const nut = nuts[i];
      const nx = layout.ox + (nut.c + (shift.dc || 0)) * cell + cell / 2;
      const ny = layout.oy + (nut.r + (shift.dr || 0)) * cell + cell / 2;
      const dx = x - nx;
      const dy = y - ny;
      const style = BT.lockStyle || "nut";
      let halfAlong;
      let halfAcross;
      if (style === "plain" || style === "plain2") {
        halfAcross = cell * 0.58;
        halfAlong = cell * 0.45 + 1;
      } else {
        const clip = nutClip(cell, shaft);
        const len = clip * 1.02;
        const cap = Math.max(2.4, clip * 0.34);
        halfAlong = len / 2 + cap * 0.15 + 1;
        halfAcross = clip * 1.78 / 2 + 1;
      }
      const idx = BT.cellIndex(bolt, nut);
      let dir = null;
      if (idx >= 0 && idx < bolt.cells.length - 1) dir = BT.stepDir(bolt.cells[idx], bolt.cells[idx + 1]);
      else if (idx > 0) dir = BT.stepDir(bolt.cells[idx - 1], bolt.cells[idx]);
      else if (BT.axisDirs(bolt).length) dir = BT.axisDirs(bolt)[0];
      const s = dir ? BT.SCREEN[dir] : { x: 1, y: 0 };
      const angle = Math.atan2(s.y, s.x);
      const lx = dx * Math.cos(angle) + dy * Math.sin(angle);
      const ly = -dx * Math.sin(angle) + dy * Math.cos(angle);
      if (Math.abs(lx) <= halfAlong && Math.abs(ly) <= halfAcross) return true;
    }
    return false;
  };

  BT.layoutBoard = function (canvas, level) {
    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth || 360;
    const cssH = canvas.clientHeight || 520;
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    const cols = level.cols;
    const rows = level.rows;
    const pad = Math.min(cssW, cssH) * 0.07;
    const cell = Math.floor(Math.min((cssW - pad * 2) / cols, (cssH - pad * 2) / rows));
    const ox = Math.round((cssW - cell * cols) / 2);
    const oy = Math.round((cssH - cell * rows) / 2);
    return { dpr: dpr, cssW: cssW, cssH: cssH, cell: cell, ox: ox, oy: oy, cols: cols, rows: rows };
  };

  BT.cellFromPoint = function (layout, x, y) {
    const c = Math.floor((x - layout.ox) / layout.cell);
    const r = Math.floor((y - layout.oy) / layout.cell);
    if (r < 0 || c < 0 || r >= layout.rows || c >= layout.cols) return null;
    return { r: r, c: c };
  };

  BT.drawBoard = function (ctx, level, layout, view) {
    const dpr = layout.dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, layout.cssW, layout.cssH);

    ctx.fillStyle = "#f4efe8";
    ctx.fillRect(0, 0, layout.cssW, layout.cssH);

    const cell = layout.cell;
    const ox = layout.ox;
    const oy = layout.oy;
    roundRect(ctx, ox - 10, oy - 10, cell * layout.cols + 20, cell * layout.rows + 20, 18);
    ctx.fillStyle = "#e4d3c0";
    ctx.fill();
    ctx.strokeStyle = "rgba(50,36,22,0.18)";
    ctx.lineWidth = 2;
    ctx.stroke();

    if (BT.blockSkin || BT.jewelSkin) {
      const inset = Math.max(1.5, cell * 0.055);
      const wellR = cell * 0.16;
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          roundRect(ctx, ox + c * cell + inset, oy + r * cell + inset, cell - inset * 2, cell - inset * 2, wellR);
          ctx.fillStyle = "rgba(70,48,28,0.16)";
          ctx.fill();
        }
      }
    } else if (!BT.halfGrid) {
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          ctx.beginPath();
          ctx.arc(ox + c * cell + cell / 2, oy + r * cell + cell / 2, Math.max(1.4, cell * 0.045), 0, Math.PI * 2);
          ctx.fillStyle = "rgba(50,36,22,0.28)";
          ctx.fill();
        }
      }
    }

    const flying = (view && view.flying) || {};
    const shake = (view && view.shake) || {};
    const selected = view && view.selected;
    const hover = view && view.hover;
    const shaft = Math.max(7, cell * 0.22);

    function shaftNudge(bolt) {
      const s = bolt && bolt.shift ? bolt.shift : { dr: 0, dc: 0 };
      return { x: (s.dc || 0) * cell, y: (s.dr || 0) * cell };
    }

    function cellHas(cells, r, c) {
      for (let i = 0; i < cells.length; i++) {
        if (cells[i].r === r && cells[i].c === c) return true;
      }
      return false;
    }

    // One rounded tile per grid cell. Tiles of the same piece meet, so a
    // length-2 bolt covers two squares and still reads as one block.
    function paintBlockCells(cells, pal, dx, dy, lift, outlined) {
      if (!cells || !cells.length) return;
      const margin = cell * 0.08;
      const rad = cell * 0.2;
      const seam = 0.8;
      function rectOf(p, pad) {
        pad = pad || 0;
        const N = cellHas(cells, p.r - 1, p.c);
        const S = cellHas(cells, p.r + 1, p.c);
        const E = cellHas(cells, p.r, p.c + 1);
        const W = cellHas(cells, p.r, p.c - 1);
        let x = ox + p.c * cell + dx;
        let y = oy + p.r * cell + dy - lift;
        let w = cell;
        let h = cell;
        if (W) { x -= seam; w += seam; } else { x += margin - pad; w -= margin - pad; }
        if (E) w += seam; else w -= margin - pad;
        if (N) { y -= seam; h += seam; } else { y += margin - pad; h -= margin - pad; }
        if (S) h += seam; else h -= margin - pad;
        return {
          x: x, y: y, w: w, h: h,
          rtl: (!N && !W) ? rad + pad : 0,
          rtr: (!N && !E) ? rad + pad : 0,
          rbr: (!S && !E) ? rad + pad : 0,
          rbl: (!S && !W) ? rad + pad : 0
        };
      }
      ctx.save();
      if (outlined) {
        ctx.fillStyle = "#fff";
        cells.forEach(function (p) {
          const b = rectOf(p, Math.max(3, cell * 0.07));
          roundCorners(ctx, b.x, b.y, b.w, b.h, b.rtl, b.rtr, b.rbr, b.rbl);
          ctx.fill();
        });
      }
      ctx.fillStyle = "rgba(40,28,18,0.16)";
      cells.forEach(function (p) {
        const b = rectOf(p);
        roundCorners(ctx, b.x, b.y + cell * 0.04, b.w, b.h, b.rtl, b.rtr, b.rbr, b.rbl);
        ctx.fill();
      });
      ctx.fillStyle = pal.fill;
      cells.forEach(function (p) {
        const b = rectOf(p);
        roundCorners(ctx, b.x, b.y, b.w, b.h, b.rtl, b.rtr, b.rbr, b.rbl);
        ctx.fill();
      });
      ctx.restore();
    }

    // One raised piece. The inner face is sharp and the bevel runs out to the outer edge.
    function paintJewelCells(cells, pal, dx, dy, lift, outlined) {
      if (!cells || !cells.length) return;
      const seam = 1.6;
      function rects(inset, rad) {
        return cells.map(function (p) {
          const N = cellHas(cells, p.r - 1, p.c);
          const S = cellHas(cells, p.r + 1, p.c);
          const E = cellHas(cells, p.r, p.c + 1);
          const W = cellHas(cells, p.r, p.c - 1);
          let x = ox + p.c * cell + dx;
          let y = oy + p.r * cell + dy - lift;
          let w = cell;
          let h = cell;
          if (W) { x -= seam; w += seam; } else { x += inset.left; w -= inset.left; }
          if (E) w += seam; else w -= inset.right;
          if (N) { y -= seam; h += seam; } else { y += inset.top; h -= inset.top; }
          if (S) h += seam; else h -= inset.bottom;
          return {
            x: x, y: y, w: w, h: h,
            rtl: (!N && !W) ? rad : 0,
            rtr: (!N && !E) ? rad : 0,
            rbr: (!S && !E) ? rad : 0,
            rbl: (!S && !W) ? rad : 0
          };
        });
      }
      function fillRects(list) {
        list.forEach(function (b) {
          roundCorners(ctx, b.x, b.y, b.w, b.h, b.rtl, b.rtr, b.rbr, b.rbl);
          ctx.fill();
        });
      }
      const edge = cell * 0.055;
      const bodyRad = Math.max(3, cell * 0.11);
      const body = rects({ top: edge, right: edge, bottom: edge, left: edge }, bodyRad);
      // The face corner sits past the outer curve, so the bevel is a straight facet out to the rim.
      const face = rects({
        top: edge + cell * 0.13,
        right: edge + cell * 0.13,
        bottom: edge + cell * 0.2,
        left: edge + cell * 0.13
      }, 0);
      ctx.save();
      if (outlined) {
        ctx.fillStyle = "#fff";
        const grow = Math.max(3, cell * 0.06);
        fillRects(rects({
          top: edge - grow,
          right: edge - grow,
          bottom: edge - grow,
          left: edge - grow
        }, bodyRad));
      }
      ctx.fillStyle = "rgba(30,20,12,0.2)";
      body.forEach(function (b) {
        roundCorners(ctx, b.x, b.y + cell * 0.05, b.w, b.h, b.rtl, b.rtr, b.rbr, b.rbl);
        ctx.fill();
      });
      ctx.fillStyle = pal.shadow;
      fillRects(body);
      ctx.fillStyle = pal.fill;
      fillRects(face);
      ctx.restore();
    }

    function boltCanLeave(bolt) {
      if (!BT.showArrows || !bolt) return false;
      const dirs = BT.slideDirs(bolt, level);
      for (let i = 0; i < dirs.length; i++) {
        const info = BT.slideInfo(level, bolt, dirs[i]);
        if (info && info.extracts) return true;
      }
      return false;
    }

    function paintBolt(bolt, lift, slide, shakeAmt) {
      const pal = BT.colorOf(bolt.color);
      const nudge = shaftNudge(bolt);
      const follow = slide ? { x: slide.x, y: slide.y } : { x: 0, y: 0 };
      const wobble = shakeAmt ? Math.sin(shakeAmt * 40) * cell * 0.08 : 0;
      const outlined = boltCanLeave(bolt);
      if (BT.jewelSkin) {
        paintJewelCells(bolt.cells, pal, nudge.x + follow.x + wobble, nudge.y + follow.y, lift, outlined);
      } else if (BT.blockSkin) {
        paintBlockCells(bolt.cells, pal, nudge.x + follow.x + wobble, nudge.y + follow.y, lift, outlined);
      } else {
        const pts = bolt.cells.map(function (p) {
          return {
            x: ox + p.c * cell + cell / 2 + nudge.x + follow.x + wobble,
            y: oy + p.r * cell + cell / 2 - lift + nudge.y + follow.y
          };
        });
        if (pts.length < 2) return;
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (outlined) {
          strokeChain(ctx, pts);
          ctx.lineWidth = shaft + Math.max(5, cell * 0.12);
          ctx.strokeStyle = "#fff";
          ctx.stroke();
        }
        strokeChain(ctx, pts);
        ctx.lineWidth = shaft + Math.max(1.5, cell * 0.02);
        ctx.strokeStyle = pal.ink;
        ctx.globalAlpha = 0.1;
        ctx.stroke();
        ctx.globalAlpha = 1;
        strokeChain(ctx, pts);
        ctx.lineWidth = shaft;
        ctx.strokeStyle = pal.fill;
        ctx.stroke();
        ctx.restore();
      }
      const nutFollow = slide && slide.nuts ? follow : { x: 0, y: 0 };
      const nutNudge = bolt.shiftNuts ? nudge : { x: 0, y: 0 };
      collarsOn(bolt, lift).forEach(function (collar) {
        drawLock(ctx, collar.x + nutNudge.x + nutFollow.x, collar.y + nutNudge.y + nutFollow.y, collar.angle, cell, shaft);
      });
    }

    function collarsOn(bolt, lift) {
      return BT.nutsOf(bolt).filter(function (nut) {
        return BT.inBoard(level, nut);
      }).map(function (nut) {
        const idx = BT.cellIndex(bolt, nut);
        let dir = null;
        if (idx >= 0 && idx < bolt.cells.length - 1) dir = BT.stepDir(bolt.cells[idx], bolt.cells[idx + 1]);
        else if (idx > 0) dir = BT.stepDir(bolt.cells[idx - 1], bolt.cells[idx]);
        else if (BT.axisDirs(bolt).length) dir = BT.axisDirs(bolt)[0];
        const s = dir ? BT.SCREEN[dir] : { x: 1, y: 0 };
        return {
          x: ox + nut.c * cell + cell / 2,
          y: oy + nut.r * cell + cell / 2 - lift,
          angle: Math.atan2(s.y, s.x)
        };
      });
    }

    function canLeave(bolt) {
      const dirs = BT.slideDirs(bolt, level);
      for (let i = 0; i < dirs.length; i++) {
        if (BT.canPull(level, bolt, dirs[i])) return true;
      }
      return false;
    }

    // A pale rim around each cell of a bolt that can actually leave.
    function paintAvailHalo(bolt, lift, slide, shakeAmt) {
      if (!BT.showAvailables || !canLeave(bolt)) return;
      const nudge = shaftNudge(bolt);
      const follow = slide ? { x: slide.x, y: slide.y } : { x: 0, y: 0 };
      const wobble = shakeAmt ? Math.sin(shakeAmt * 40) * cell * 0.08 : 0;
      const dx = nudge.x + follow.x + wobble;
      const dy = nudge.y + follow.y;
      const grow = Math.max(3, cell * 0.08);
      const rad = cell * 0.28;
      ctx.save();
      ctx.fillStyle = "rgba(255, 246, 214, 0.96)";
      (bolt.cells || []).forEach(function (p) {
        roundCorners(
          ctx,
          ox + p.c * cell + dx - grow,
          oy + p.r * cell + dy - lift - grow,
          cell + grow * 2,
          cell + grow * 2,
          rad, rad, rad, rad
        );
        ctx.fill();
      });
      ctx.restore();
    }

    (level.bolts || []).forEach(function (bolt) {
      if (flying[bolt.id]) return;
      const sh = shake[bolt.id] || 0;
      const lift = (hover === bolt.id || selected === bolt.id) ? cell * 0.04 : 0;
      const slide = view && view.preview && view.preview.id === bolt.id ? view.preview : null;
      paintAvailHalo(bolt, lift, slide, sh);
      paintBolt(bolt, lift, slide, sh);
    });

    const pen = view && view.pen;
    if (pen && pen.cells && pen.cells.length) {
      const pal = BT.colorOf(pen.color || 0);
      if (BT.jewelSkin) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        paintJewelCells(pen.cells, pal, 0, 0, 0);
        ctx.restore();
      } else if (BT.blockSkin) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        paintBlockCells(pen.cells, pal, 0, 0, 0);
        ctx.restore();
      } else {
        const pts = pen.cells.map(function (p) {
          return { x: ox + p.c * cell + cell / 2, y: oy + p.r * cell + cell / 2 };
        });
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (pts.length === 1) {
          ctx.beginPath();
          ctx.arc(pts[0].x, pts[0].y, shaft * 0.55, 0, Math.PI * 2);
          ctx.fillStyle = pal.fill;
          ctx.fill();
        } else {
          strokeChain(ctx, pts);
          ctx.lineWidth = shaft;
          ctx.strokeStyle = pal.fill;
          ctx.globalAlpha = 0.85;
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    Object.keys(flying).forEach(function (id) {
      const f = flying[id];
      if (!f || f.kind !== "break") return;
      const d = BT.DIRS[f.dir] || { dr: 0, dc: 0 };
      const ease = 1 - Math.pow(1 - Math.min(1, f.p), 2);
      (f.bits || []).forEach(function (bit) {
        const cells = bit.cells || [];
        if (!cells.length) return;
        let sx = 0;
        let sy = 0;
        cells.forEach(function (p) {
          sx += ox + p.c * cell + cell / 2;
          sy += oy + p.r * cell + cell / 2;
        });
        sx /= cells.length;
        sy /= cells.length;
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - ease);
        ctx.translate(sx + (d.dc * 1.05 + bit.ox) * ease * cell * 1.15, sy + (d.dr * 1.05 + bit.oy) * ease * cell * 1.15);
        ctx.rotate(bit.rot * ease);
        ctx.translate(-sx, -sy);
        const pal = BT.colorOf(f.color);
        if (BT.jewelSkin) {
          paintJewelCells(cells, pal, 0, 0, 0);
        } else if (BT.blockSkin) {
          paintBlockCells(cells, pal, 0, 0, 0);
        } else {
          const pts = cells.map(function (p) {
            return { x: ox + p.c * cell + cell / 2, y: oy + p.r * cell + cell / 2 };
          });
          if (pts.length === 1) {
            const s = BT.SCREEN[f.dir] || { x: 1, y: 0 };
            pts.push({ x: pts[0].x + s.x * cell * 0.55, y: pts[0].y + s.y * cell * 0.55 });
          }
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          strokeChain(ctx, pts);
          ctx.lineWidth = shaft;
          ctx.strokeStyle = pal.fill;
          ctx.stroke();
        }
        ctx.restore();
      });
    });

    const sparks = (view && view.sparks) || [];
    sparks.forEach(function (sp) {
      const x = ox + sp.c * cell + cell / 2;
      const y = oy + sp.r * cell + cell / 2;
      const k = sp.p || 0;
      const alpha = (1 - k);
      const len = cell * (0.16 + k * 0.28);
      ctx.save();
      ctx.translate(x, y);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff6d0";
      ctx.beginPath();
      ctx.arc(0, 0, cell * 0.07, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffb020";
      ctx.lineWidth = Math.max(1.5, cell * 0.055);
      ctx.lineCap = "round";
      for (let i = 0; i < 6; i++) {
        const a = -0.7 + i * 0.55 + k * 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * len * 0.28, Math.sin(a) * len * 0.28);
        ctx.lineTo(Math.cos(a) * len, Math.sin(a) * len);
        ctx.stroke();
      }
      ctx.restore();
    });
  };
});
