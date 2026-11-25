// Phuc Long fan concept: one pinned stage, the scroll is a timeline.
// Hero (four cups on an arc) → brew a milk tea layer by layer (EffectCraft pour sprites, physics pearls) → pick a flavour.
(() => {
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x)), lerp = (a, b, k) => a + (b - a) * k;
  const seg = (p, a, b) => cl((p - a) / (b - a));
  const eo = x => 1 - Math.pow(1 - x, 3), eio = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  const bounce = x => { const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + .75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + .9375; return n * (x -= 2.625 / d) * x + .984375; };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches, COARSE = matchMedia('(pointer: coarse)').matches;
  const C = window.CUP, stage = $('#stage'), cv = $('#brewCv'), ctx = cv.getContext('2d');
  const cups = Object.fromEntries($$('.cup').map(e => [e.dataset.k, e]));
  const ings = Object.fromEntries($$('.ing').map(e => [e.dataset.i, e]));
  const FL = [
    { k: 'milktea', word: 'MILK TEA', bg: '#C08F60', ink: '#2E1A0E', kick: '01 · THE SIGNATURE', name: 'Milk tea with pearls', ings: ['pearl', 'leaves', 'pearl'] },
    { k: 'peach', word: 'PEACH TEA', bg: '#EF9C49', ink: '#4A2208', kick: '02 · BRIGHT', name: 'Peach tea with fresh slices', ings: ['peach', 'leaf', 'peach'] },
    { k: 'matcha', word: 'MATCHA', bg: '#8FB25A', ink: '#1C3612', kick: '03 · GREEN', name: 'Matcha latte', ings: ['matcha', 'leaf', 'leaves'] },
    { k: 'coffee', word: 'MILK COFFEE', bg: '#5E3D29', ink: '#F4ECDD', kick: '04 · BOLD', name: 'Vietnamese iced milk coffee', ings: ['beans', 'beans', 'leaf'] },
  ];
  // pour sprite sheets (EffectCraft renders, 30 frames, 6x5 of 120x450)
  const pour = {}; ['tea', 'milk'].forEach(k => { const im = new Image(); im.src = `fx/pour-${k}.webp`; pour[k] = im; });
  const pearlImg = $('.ing[data-i="pearl"] img');

  // ---------- layout ----------
  let W = 0, H = 0, DPR = 1, L = {};
  function layout() {
    W = document.documentElement.clientWidth; H = innerHeight;   // the pinned stage keeps its old px size until ScrollTrigger refreshes
    curF = -1; DPR = Math.min(COARSE ? 1.5 : 2, devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
    const r = C.h / C.w;
    // hero arc: four cups
    L.hh = Math.min(H * .36, W * .5 * r, 420); L.hw = L.hh / r;
    const gap = Math.min(L.hw * .78, W / 4.6);
    L.arc = [-1.5, -.5, .5, 1.5].map(i => ({ x: W / 2 + i * gap, y: H * .74 - L.hh / 2 + Math.abs(i) * Math.abs(i) * L.hh * .05, s: 1 - Math.abs(i) * .07 }));
    L.order = ['milktea', 'peach', 'matcha', 'coffee'];
    // brew cup
    L.bh = Math.min(H * .6, 620); L.bw = L.bh / r; L.bx = W / 2; L.by = Math.max(H * .24, 170) + L.bh / 2;   // centre
    // flavour cup
    L.fh = Math.min(H * .52, 540); L.fw = L.fh / r; L.fy = H * .55;
    const ringR = Math.min(W * .82, H * .5); const ring = $('#ring'); ring.style.width = ring.style.height = ringR + 'px'; ring.style.left = (W / 2 - ringR / 2) + 'px'; ring.style.top = (H * .74 - ringR / 2) + 'px';
    $('#step').style.top = Math.min(H - 96, Math.max(H * .24, 170) + Math.min(H * .6, 620) + 8) + 'px'; $('#flavName').style.top = (H - 150) + 'px'; $('#dots').style.top = (H - 86) + 'px';
    $('#plinth').style.width = L.bw * 1.5 + 'px'; $('#plinth').style.height = L.bw * .35 + 'px';
    $('#plinth').style.left = (L.bx - L.bw * .75) + 'px'; $('#plinth').style.top = (L.by + L.bh / 2 - L.bw * .2) + 'px';
    // columns for the flavour wipe
    const bf = $('#bgFlav'); if (!bf.children.length) for (let i = 0; i < 5; i++) { const c = document.createElement('div'); c.className = 'col'; bf.appendChild(c); }
    [...bf.children].forEach((c, i) => { c.style.left = (i * W / 5 - 1) + 'px'; c.style.width = (W / 5 + 2) + 'px'; });
  }
  const place = (el, cx, cy, w, h, extra = '') => { el.style.width = w + 'px'; el.style.transform = `translate3d(${cx - w / 2}px,${cy - h / 2}px,0) ${extra}`; };

  // liquid polygon helpers (cup image space → screen)
  const LEFT = [C.liquid[0], C.liquid[7], C.liquid[6], C.liquid[5]], RIGHT = [C.liquid[1], C.liquid[2], C.liquid[3], C.liquid[4]];
  const TOPY = C.liquid[0][1], BOTY = C.liquid[5][1];
  const edgeX = (chain, y) => { for (let i = 0; i < chain.length - 1; i++) { const [x0, y0] = chain[i], [x1, y1] = chain[i + 1]; if (y <= y1 || i === chain.length - 2) return lerp(x0, x1, cl((y - y0) / (y1 - y0))); } };
  function cupSpace() { const s = L.bw / C.w, ox = L.bx - L.bw / 2, oy = L.by - L.bh / 2; return { s, ox, oy, X: x => ox + x * s, Y: y => oy + y * s }; }

  // ---------- pearls (simple circle physics inside the cup) ----------
  const pearls = []; let lastT = 0;
  function stepPearls(dt, want, surfY) {
    const S = cupSpace(), r = L.bw * .046;
    while (pearls.length < want) pearls.push({ x: lerp(C.liquid[0][0] + 60, C.liquid[1][0] - 60, Math.random()), y: TOPY - 140 - Math.random() * 120, vx: (Math.random() - .5) * 30, vy: 0, rot: Math.random() * 6 });
    while (pearls.length > want) pearls.pop();
    const g = 2200 / S.s, rr = r / S.s;   // work in cup-image units
    for (let it = 0; it < 2; it++) for (const p of pearls) {
      const inLiquid = p.y > surfY;
      p.vy += g * dt * (inLiquid ? .35 : 1); if (inLiquid) { p.vx *= .92; p.vy *= .93; }
      p.x += p.vx * dt / 2; p.y += p.vy * dt / 2;
      const floor = BOTY - rr; if (p.y > floor) { p.y = floor; p.vy *= -.25; p.vx *= .8; }
      const lx = edgeX(LEFT, p.y) + rr + 4, rx = edgeX(RIGHT, p.y) - rr - 4;
      if (p.x < lx) { p.x = lx; p.vx = Math.abs(p.vx) * .4; } if (p.x > rx) { p.x = rx; p.vx = -Math.abs(p.vx) * .4; }
    }
    for (let i = 0; i < pearls.length; i++) for (let j = i + 1; j < pearls.length; j++) {
      const a = pearls[i], b = pearls[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = rr * 2 * .96;
      if (d > 0 && d < m) { const o = (m - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; const rv = (b.vy - a.vy) * ny + (b.vx - a.vx) * nx; if (rv < 0) { a.vx += nx * rv * .5; a.vy += ny * rv * .5; b.vx -= nx * rv * .5; b.vy -= ny * rv * .5; } }
    }
  }

  // ---------- the brew canvas ----------
  const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const mix = (a, b, k) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], k))).join(',')})`; };
  let P = 0, tNow = 0;
  function drawBrew(p, dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, W, H);
    const vis = p > .12 && p < .66; cv.style.opacity = vis ? (p < .62 ? 1 : 1 - seg(p, .62, .645)) : 0; if (!vis) return;
    const S = cupSpace();
    const level = p < .21 ? 0 : p < .30 ? .5 * eio(seg(p, .21, .30)) : p < .42 ? lerp(.5, .82, eio(seg(p, .30, .42))) : .82;
    const surf = BOTY - level * (BOTY - TOPY);
    // liquid
    if (level > .001) {
      ctx.save(); ctx.beginPath(); C.liquid.forEach(([x, y], i) => i ? ctx.lineTo(S.X(x), S.Y(y)) : ctx.moveTo(S.X(x), S.Y(y))); ctx.closePath(); ctx.clip();
      const m = seg(p, .31, .42), top = mix('#C27C35', '#D2A777', m), bot = mix('#8E5420', '#B98A5B', m);
      const gr = ctx.createLinearGradient(0, S.Y(surf), 0, S.Y(BOTY)); gr.addColorStop(0, top); gr.addColorStop(1, bot);
      ctx.fillStyle = gr; const wob = Math.sin(tNow * 3) * 3 * (p < .44 ? 1 : .3);
      ctx.beginPath(); ctx.moveTo(S.X(0), S.Y(surf)); for (let x = 0; x <= C.w; x += 20) ctx.lineTo(S.X(x), S.Y(surf + Math.sin(x * .03 + tNow * 4) * wob)); ctx.lineTo(S.X(C.w), S.Y(BOTY + 10)); ctx.lineTo(S.X(0), S.Y(BOTY + 10)); ctx.closePath(); ctx.fill();
      // milk blooms: soft clouds that sink from the pour point and spread, then dissolve into the tea
      const sw = seg(p, .31, .47);
      if (sw > 0 && sw < 1) { const px = C.w * .58;
        for (let i = 0; i < 16; i++) { const life = cl(sw * 1.7 - i * .05); if (life <= 0) continue;
          const y = lerp(surf + 20, BOTY - 60, cl(life * (.6 + (i % 3) * .2))), x = px + Math.sin(i * 2.3 + tNow * .7) * (40 + life * 120) * (i % 2 ? 1 : -1), rad = (22 + life * 85) * S.s;
          const g2 = ctx.createRadialGradient(S.X(x), S.Y(y), 0, S.X(x), S.Y(y), rad); const al = .22 * Math.sin(Math.PI * life);
          g2.addColorStop(0, `rgba(252,244,230,${al.toFixed(3)})`); g2.addColorStop(1, 'rgba(252,244,230,0)'); ctx.fillStyle = g2; ctx.fillRect(S.X(x) - rad, S.Y(y) - rad, rad * 2, rad * 2); } }
      // roundness: darker towards the walls, a soft vertical highlight
      const sh = ctx.createLinearGradient(S.X(C.liquid[0][0]), 0, S.X(C.liquid[1][0]), 0);
      sh.addColorStop(0, 'rgba(40,20,5,.28)'); sh.addColorStop(.22, 'rgba(40,20,5,0)'); sh.addColorStop(.62, 'rgba(255,240,220,.10)'); sh.addColorStop(.78, 'rgba(40,20,5,0)'); sh.addColorStop(1, 'rgba(40,20,5,.3)');
      ctx.fillStyle = sh; ctx.fillRect(S.X(0), S.Y(surf) - 4, S.X(C.w) - S.X(0), S.Y(BOTY + 10) - S.Y(surf) + 4);
      // surface sheen
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(S.X(0), S.Y(surf) - 2, S.X(C.w) - S.X(0), 6 * S.s);
      // pearls
      const want = p < .43 ? 0 : Math.round(30 * eo(seg(p, .43, .53)));
      stepPearls(Math.min(dt, .033), want, surf);
      const r = L.bw * .046;
      if (pearlImg.complete) for (const q of pearls) { ctx.save(); ctx.translate(S.X(q.x), S.Y(q.y)); ctx.rotate(q.rot); ctx.drawImage(pearlImg, -r * 1.05, -r * 1.05, r * 2.1, r * 2.1); ctx.restore(); }
      ctx.restore();
    }
    // pour streams (EffectCraft sprite sheets, played in time; shown by scroll)
    const streams = [['tea', seg(p, .205, .215) * (1 - seg(p, .295, .305))], ['milk', seg(p, .305, .315) * (1 - seg(p, .41, .42))]];
    for (const [k, a] of streams) { if (a <= 0 || !pour[k].complete) continue;
      const f = Math.floor(tNow * 30) % 30, sx = (f % 6) * 120, sy = Math.floor(f / 6) * 450, dw = L.bw * .62, top = 0, bottom = S.Y(surf) + 6;
      ctx.globalAlpha = a; ctx.drawImage(pour[k], sx, sy, 120, 450, S.X(C.w * .58) - dw / 2, top, dw, bottom - top); ctx.globalAlpha = 1;
      // splash ring where it hits
      ctx.strokeStyle = k === 'milk' ? 'rgba(255,250,240,.7)' : 'rgba(255,220,170,.6)'; ctx.lineWidth = 2;
      for (let i = 0; i < 2; i++) { const ph = (tNow * 2 + i * .5) % 1; ctx.globalAlpha = a * (1 - ph); ctx.beginPath(); ctx.ellipse(S.X(C.w * .58), S.Y(surf), (10 + ph * 70) * S.s, (3 + ph * 14) * S.s, 0, 0, 6.283); ctx.stroke(); } ctx.globalAlpha = 1; }
  }

  // ---------- the master render ----------
  const STEPS = [[.165, .30, '01 · TEA', 'Steeped tea leaves'], [.30, .42, '02 · MILK', 'Fresh milk, swirled in'], [.42, .54, '03 · PEARLS', 'Chewy tapioca pearls'], [.54, .62, '04 · LID ON', 'Sealed and ready'], [.62, .66, '', 'Milk tea, built layer by layer.']];
  const FT = [.66, .74, .82, .90];   // flavour i becomes current at FT[i]
  let curF = -1, ptrX = 0, ptrY = 0;
  addEventListener('pointermove', e => { ptrX = e.clientX / innerWidth - .5; ptrY = e.clientY / innerHeight - .5; });
  function render(p) {
    P = p;
    const T1 = eio(seg(p, .03, .10));                 // hero → brew
    // backgrounds
    const cr = Math.hypot(W, H) * 1.05 * eio(seg(p, .035, .10)); $('#bgCream').style.opacity = 1 - seg(p, .69, .70); $('#bgCream').style.clipPath = `circle(${cr.toFixed(1)}px at ${lerp(L.arc[0].x, L.bx, T1)}px ${lerp(L.arc[0].y, L.by, T1)}px)`;
    $('#ring').style.opacity = .9 * (1 - T1); $('#ring').style.transform = `rotate(${tNow * 6 + p * 220}deg)`;
    $('#c1').style.opacity = 1 - seg(p, .03, .07); $('#c1').style.transform = `translateY(${-40 * seg(p, .03, .08)}px)`;
    const pouring = Math.max(seg(p, .2, .215) * (1 - seg(p, .295, .31)), seg(p, .3, .315) * (1 - seg(p, .41, .425)));   // the stream crosses the headline: let it step back
    $('#c2').style.opacity = seg(p, .08, .12) * (1 - seg(p, .6, .65)) * (1 - .78 * pouring); $('#c2').style.transform = `translateY(${(1 - eo(seg(p, .08, .13))) * 30}px)`;
    $('#cue').style.opacity = 1 - seg(p, 0, .03);
    const navInk = p > .08 && p < .66 ? '#123B29' : (curF >= 0 && p < .97 ? FL[curF].ink : '#F4ECDD'); $('#nav').style.color = navInk; $('#legal').style.color = navInk;
    // hero cups
    L.order.forEach((k, i) => {
      const a = L.arc[i], el = cups[k], bob = RM ? 0 : Math.sin(tNow * 1.3 + i) * 5;
      if (k === 'milktea') return;
      const out = T1, dir = a.x < W / 2 ? -1 : 1;
      el.style.opacity = (1 - out) * (p < .64 ? 1 : 0);
      place(el, a.x + dir * W * .6 * eo(out) + ptrX * 14 * (1 + i * .3), a.y + bob + ptrY * 8, L.hw * a.s, L.hh * a.s, `rotate(${dir * 14 * out}deg)`);
    });
    // the hero cup → the brew cup → the flavour cup
    const mt = cups.milktea, a0 = L.arc[0];
    const hx = lerp(a0.x + ptrX * 14, L.bx, T1), hy = lerp(a0.y + (RM ? 0 : Math.sin(tNow * 1.3) * 5), L.by, T1), hw = lerp(L.hw * a0.s, L.bw, T1);
    const toEmpty = seg(p, .10, .13), toFull = seg(p, .60, .645);
    // brew phase shows lid+body; before .10 and after .645 the photo cup
    const inBrew = p >= .10 && p < .645;
    mt.style.opacity = p < .10 ? 1 : p < .13 ? 1 - toEmpty : p < .60 ? 0 : (p < .66 ? toFull : 0);
    const body = $('#body'), lid = $('#lid'), S = cupSpace();
    body.style.opacity = lid.style.opacity = 0;
    if (p >= .10 && p < .645) {
      body.style.opacity = p < .13 ? toEmpty : 1 - toFull;
      place(body, L.bx, S.oy + C.cut * S.s + (C.h - C.cut) * S.s / 2, L.bw, (C.h - C.cut) * S.s);
      const off = p < .13 ? 0 : p < .17 ? eio(seg(p, .13, .17)) : p < .54 ? 1 : 1 - bounce(seg(p, .54, .6));
      lid.style.opacity = (p < .13 ? toEmpty : 1 - toFull) * (1 - (p >= .13 && p < .6 ? .6 * off : 0));
      place(lid, L.bx + off * L.bw * .3, S.oy + C.cut * S.s / 2 - off * H * .55, L.bw, C.cut * S.s, `rotate(${off * 18}deg)`);
    }
    if (p < .645) place(mt, hx, hy, hw, hw * C.h / C.w);
    $('#plinth').style.opacity = T1 * (1 - seg(p, .62, .66)) * .9;
    // ingredients drop in, one per step
    Object.values(ings).forEach(e => { e.style.opacity = 0; });
    const drop = (k, a, b, w) => { const e = ings[k], u = seg(p, a, b); if (u <= 0 || u >= 1) return; const appear = eo(seg(u, 0, .35)), fall = seg(u, .45, 1);
      const y = lerp(L.by - L.bh / 2 - w * .9, L.by - L.bh * .12, fall * fall), sc = lerp(1, .45, fall);
      e.style.opacity = appear * (1 - seg(u, .85, 1)); place(e, L.bx, y, w * sc, w * sc * .8, `rotate(${fall * 50}deg)`); };
    if (inBrew) { drop('leaves', .165, .215, L.bw * .9); drop('pearl', .42, .45, L.bw * .45); }
    // step caption
    const st = STEPS.find(s => p >= s[0] && p < s[1]), sc = $('#step');
    if (st) { sc.style.opacity = Math.min(seg(p, st[0], st[0] + .012), 1 - seg(p, st[1] - .012, st[1])); sc.querySelector('b').textContent = st[2]; sc.querySelector('span').textContent = st[3]; sc.style.color = '#123B29'; }
    else sc.style.opacity = 0;
    // flavours: column wipes, giant word, cup swap
    const fi = p < FT[0] ? -1 : FT.filter(t => p >= t).length - 1;
    const word = $('#word'), fname = $('#flavName'), dots = $('#dots'), bf = $('#bgFlav');
    if (p >= FT[0] - .02 && p < .97) {
      bf.style.opacity = 1;
      const i = Math.max(0, fi), f = FL[i];
      const tw = fi < 0 ? seg(p, FT[0] - .02, FT[0]) : seg(p, FT[i], FT[i] + .03);   // wipe progress into flavour i
      const prev = fi <= 0 ? null : FL[i - 1];
      bf.style.background = prev ? prev.bg : 'transparent';
      [...bf.children].forEach((c, j) => { c.style.background = f.bg; const k = eo(cl(tw * 1.5 - j * .1)); c.style.transform = `translateY(${(1 - k) * (j % 2 ? 100 : -100)}%)`; });
      if (fi !== curF) { curF = fi; word.innerHTML = f.word.split('').map(ch => `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
        const fs = Math.min(W * 1.65 / Math.max(5, f.word.length), H * .3); word.style.fontSize = fs + 'px'; const sw2 = word.scrollWidth; const fs2 = sw2 > W * .94 ? fs * W * .94 / sw2 : fs; word.style.fontSize = fs2 + 'px'; word.style.top = (L.fy - L.fh * .28 - fs2 * .5) + 'px';
        fname.querySelector('b').textContent = f.kick; fname.querySelector('span').textContent = f.name; $$('#dots button').forEach((b, j) => b.classList.toggle('on', j === i)); }
      const wk = eo(seg(p, Math.max(FT[0], FT[i]) , Math.max(FT[0], FT[i]) + .035));
      word.style.opacity = wk * (1 - seg(p, .955, .97)); word.style.color = f.ink === '#F4ECDD' ? 'rgba(244,236,221,.22)' : 'rgba(255,255,255,.34)';
      [...word.children].forEach((s, j) => { s.style.transform = `translateY(${(1 - eo(cl(wk * 1.6 - j * .05))) * 60}%)`; });
      fname.style.opacity = wk * (1 - seg(p, .955, .97)); fname.style.color = f.ink; dots.style.opacity = seg(p, FT[0], FT[0] + .02) * (1 - seg(p, .955, .97));
      // cup: the photo cup of the current flavour rises in, the previous one slides up and out
      L.order.forEach(k => { if (k !== 'milktea' || p >= .66) cups[k].style.opacity = 0; });
      const cupIn = fi < 0 ? 1 : seg(p, FT[i], FT[i] + .035), bob = RM ? 0 : Math.sin(tNow * 1.4) * 6;
      const cur = cups[f.k];
      if (p >= .66 || fi > 0) { cur.style.opacity = 1;
        const fromY = fi === 0 ? L.by : H + L.fh * .6, y = lerp(fromY, L.fy, eo(cupIn)) + bob, w = fi === 0 ? lerp(L.bw, L.fw, eo(cupIn)) : L.fw;
        place(cur, W / 2 + ptrX * 18, y, w, w * C.h / C.w, `rotate(${(1 - eo(cupIn)) * (fi % 2 ? 8 : -8)}deg)`);
        if (prev && cupIn < 1) { const pc = cups[prev.k]; pc.style.opacity = 1 - cupIn; place(pc, W / 2, L.fy - eo(cupIn) * H * .8, L.fw, L.fh, `rotate(${eo(cupIn) * -10}deg)`); } }
      // floating ingredients around the cup
      f.ings.forEach((k, j) => { const e = ings[k]; if (!e) return; const ang = j * 2.1 + 0.6, rad = L.fw * (1.05 + j * .1), w = L.fw * (.42 - j * .05);
        const x = W / 2 + Math.cos(ang + tNow * .25) * rad, y = L.fy - L.fh * .1 + Math.sin(ang + tNow * .3) * L.fh * .32 - (p - FT[i]) * H * 1.2;
        e.style.opacity = wk * (1 - seg(p, .955, .97)); place(e, x, y, w, w * .8, `rotate(${Math.sin(tNow + j) * 12}deg)`); });
    } else { bf.style.opacity = 0; word.style.opacity = 0; fname.style.opacity = 0; dots.style.opacity = 0; if (p < FT[0] - .02) curF = -1; }
    if (p >= .97) L.order.forEach(k => cups[k].style.opacity = 0);
    $('#bgGreen').style.opacity = p < .64 ? 1 : seg(p, .955, .99);
  }

  // ---------- scroll ----------
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: .085, wheelMultiplier: .9 }); window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0);
  const prog = { p: 0 };
  const st = ScrollTrigger.create({ trigger: '#stage', start: 'top top', end: () => '+=' + innerHeight * 9, pin: true, scrub: .6, animation: gsap.to(prog, { p: 1, ease: 'none', duration: 1 }) });
  window.__st = st;
  $$('#dots button').forEach(b => b.addEventListener('click', () => { const i = +b.dataset.f, target = FT[i] + .045; lenis.scrollTo(st.start + (st.end - st.start) * target, { duration: 1.3 }); }));
  $('#again').addEventListener('click', () => lenis.scrollTo(0, { duration: 2.2, easing: t => 1 - Math.pow(1 - t, 4) }));
  // one frame loop for everything time-based (bobbing, pour sprites, physics)
  function frame(ms) { const t = ms / 1000, dt = lastT ? Math.min(.05, t - lastT) : .016; lastT = t; tNow = t; render(prog.p); drawBrew(prog.p, dt); requestAnimationFrame(frame); }
  addEventListener('resize', () => { layout(); ScrollTrigger.refresh(); });
  Promise.all([document.fonts.load("500 40px 'Playfair Display'"), ...$$('img').map(i => i.decode().catch(() => {}))]).then(() => { layout(); requestAnimationFrame(frame); });
  layout();
})();
