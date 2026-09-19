"use strict";
var EmbabelBackdrop = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/backdrop/backdrop.ts
  var backdrop_exports = {};
  __export(backdrop_exports, {
    startBackdrop: () => startBackdrop
  });
  var INDIGO = [98, 95, 255];
  var VIOLET = [167, 120, 255];
  var GREEN = [62, 207, 142];
  var ICE = [199, 210, 255];
  var PALETTE = [INDIGO, INDIGO, VIOLET, GREEN, ICE];
  var someColour = () => PALETTE[Math.random() * PALETTE.length | 0] ?? INDIGO;
  var LINK = 240;
  var FOG = [16, 20, 48];
  var hazed = (c, fog, amount) => [
    Math.round(c[0] + (fog[0] - c[0]) * amount),
    Math.round(c[1] + (fog[1] - c[1]) * amount),
    Math.round(c[2] + (fog[2] - c[2]) * amount)
  ];
  function startBackdrop(canvas, options) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return () => {
    };
    const snippets = options.snippets.filter((line2) => line2.trim().length > 0);
    const line = (n) => snippets.length === 0 ? "" : snippets[(n % snippets.length + snippets.length) % snippets.length] ?? "";
    const brightness = options.brightness ?? 1;
    const counts = options.snippetCount ?? { wide: 7, narrow: 4 };
    const depth = options.depth === true ? {} : options.depth || null;
    const bands = Math.max(1, depth?.bands ?? 3);
    const maxBlur = depth?.maxBlur ?? 3.6;
    const fog = depth?.fog ?? FOG;
    const canBlur = depth !== null && "filter" in ctx;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let nodes = [];
    let snips = [];
    let scratch = null;
    let scratchCtx = null;
    const size = () => {
      const dpr = Math.min(devicePixelRatio, 2);
      canvas.width = innerWidth * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(innerWidth * innerHeight / 14e3);
      snips = Array.from({ length: innerWidth > 1100 ? counts.wide : counts.narrow }, (_, i) => ({
        text: line(i + Math.floor(Math.random() * snippets.length)),
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -0.05 - Math.random() * 0.07,
        phase: Math.random() * Math.PI * 2
      }));
      nodes = Array.from({ length: Math.min(Math.max(target, 40), 150) }, () => {
        const z = depth ? Math.random() : 0;
        const pace = 1 - 0.75 * z * z;
        return {
          x: Math.random() * innerWidth,
          y: Math.random() * innerHeight,
          vx: (Math.random() - 0.5) * 0.22 * pace,
          vy: (Math.random() - 0.5) * 0.22 * pace,
          r: (1.1 + Math.random() * 2.2) * (1 - 0.45 * z),
          hub: Math.random() < 0.16,
          c: someColour(),
          z
        };
      });
      if (canBlur) {
        scratch = scratch ?? document.createElement("canvas");
        scratch.width = canvas.width;
        scratch.height = canvas.height;
        scratchCtx = scratch.getContext("2d");
        scratchCtx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };
    const bandOf = (z) => Math.min(bands - 1, Math.floor(z * bands));
    const blurOf = (band) => bands < 2 ? 0 : band / (bands - 1) * maxBlur;
    const edges = [];
    let edgeCount = 0;
    const collectEdges = () => {
      edgeCount = 0;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          if (!a || !b) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > LINK) continue;
          const band = bandOf(Math.max(a.z, b.z));
          const slot = edges[edgeCount];
          if (slot) {
            slot.a = a;
            slot.b = b;
            slot.strength = (1 - d / LINK) ** 2;
            slot.band = band;
          } else {
            edges[edgeCount] = { a, b, strength: (1 - d / LINK) ** 2, band };
          }
          edgeCount++;
        }
      }
    };
    const drawBand = (target, band) => {
      target.globalAlpha = brightness;
      for (let i = 0; i < edgeCount; i++) {
        const e = edges[i];
        if (!e || e.band !== band) continue;
        const { a, b } = e;
        const far = Math.max(a.z, b.z);
        const c = hazed(
          [
            Math.round((a.c[0] + b.c[0]) / 2),
            Math.round((a.c[1] + b.c[1]) / 2),
            Math.round((a.c[2] + b.c[2]) / 2)
          ],
          fog,
          far * 0.55
        );
        target.strokeStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.75 * e.strength * (1 - 0.38 * far)})`;
        target.lineWidth = 1;
        target.beginPath();
        target.moveTo(a.x, a.y);
        target.lineTo(b.x, b.y);
        target.stroke();
      }
      for (const n of nodes) {
        if (bandOf(n.z) !== band) continue;
        const c = hazed(n.c, fog, n.z * 0.55);
        target.beginPath();
        target.arc(n.x, n.y, n.hub ? n.r * 1.9 : n.r, 0, Math.PI * 2);
        target.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${(n.hub ? 1 : 0.8) * (1 - 0.32 * n.z)})`;
        target.fill();
        if (n.hub) {
          target.beginPath();
          target.arc(n.x, n.y, n.r * 5.5, 0, Math.PI * 2);
          target.fillStyle = `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${0.22 * (1 - 0.32 * n.z)})`;
          target.fill();
        }
      }
    };
    const frame = () => {
      const w = innerWidth;
      const h = innerHeight;
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = brightness;
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -20) n.x = w + 20;
        if (n.x > w + 20) n.x = -20;
        if (n.y < -20) n.y = h + 20;
        if (n.y > h + 20) n.y = -20;
      }
      collectEdges();
      for (let band = bands - 1; band >= 0; band--) {
        const blur = canBlur ? blurOf(band) : 0;
        if (blur > 0 && scratchCtx && scratch) {
          scratchCtx.clearRect(0, 0, w, h);
          drawBand(scratchCtx, band);
          ctx.filter = `blur(${blur.toFixed(2)}px)`;
          ctx.globalAlpha = 1;
          ctx.drawImage(scratch, 0, 0, w, h);
          ctx.filter = "none";
          ctx.globalAlpha = brightness;
        } else {
          drawBand(ctx, band);
        }
      }
      ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
      for (const sn of snips) {
        sn.x += sn.vx;
        sn.y += sn.vy;
        sn.phase += 35e-4;
        if (sn.y < -30) {
          sn.y = h + 30;
          sn.x = Math.random() * w;
          sn.text = line(Math.random() * snippets.length | 0);
        }
        if (sn.x < -320) sn.x = w + 20;
        if (sn.x > w + 320) sn.x = -20;
        const a = 0.16 + 0.14 * Math.sin(sn.phase);
        ctx.fillStyle = `rgba(167, 176, 255, ${Math.max(a, 0)})`;
        ctx.fillText(sn.text, sn.x, sn.y);
      }
      if (!reduced) raf = requestAnimationFrame(frame);
    };
    size();
    addEventListener("resize", size);
    if (reduced) frame();
    else raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", size);
    };
  }
  return __toCommonJS(backdrop_exports);
})();
