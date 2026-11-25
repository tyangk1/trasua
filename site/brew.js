/* Phuc Long fan concept, v2: a cup brewed from real photos.
   Every brew frame is a photo of the SAME cup (made by editing one image in one chat), so frames line up.
   Scroll drives everything through one master progress p (0..1). */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const stage = $('#stage');
  const sBrew = $('#sBrew'), sMacro = $('#sMacro'), sFlav = $('#sFlav'), sEnd = $('#sEnd');
  const brewBox = $('#bBrew'), heroBox = $('#bHero');
  const w1968 = $('#w1968'), cHero = $('#cHero'), cEnd = $('#cEnd');
  const steps = $$('#sBrew .step'), rail = $$('#sBrew .rail span');
  const mMilk = $('#mMilk'), mPearl = $('#mPearl'), mc1 = $('#mc1'), mc2 = $('#mc2');
  const cards = $$('.card'), fWord = $('#fWord'), fTag = $('#fTag'), fName = $('#fName'), dots = $$('#fHead .dots span');
  const fCopy = $('#fCopy'), fHead = $('#fHead');
  const fg = $$('#fg img');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const io = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out = (t) => 1 - Math.pow(1 - t, 3);
  const inn = (t) => t * t * t;
  const back = (t) => { const c = 1.5; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };

  /* ---------- brew frames ---------- */
  const SRC = { s0: 's0-empty', t1: 't1-pour', t2: 't2-pour', t3: 't3-pour', s1: 's1-tea', m1: 'm1-milk', m2: 'm2-milk', s2: 's2-milk', s3: 's3-pearls', s4: 's4-final' };
  const F = {};
  $$('#bBrew img').forEach((im) => {
    const n = SRC[im.dataset.f];
    im.sizes = '(max-aspect-ratio: 9/10) 100vw, 64vh';
    im.srcset = `img/${n}.webp 1024w, img/${n}@2x.webp 2048w`;
    im.src = `img/${n}.webp`;
    F[im.dataset.f] = im;
  });
  // liquid surface heights (fraction of the photo, 0 = top)
  const LV = { s0: .915, t1: .71, t2: .51, t3: .30 };
  // the brew, as transitions between photos
  const T = [
    { a: .098, b: .114, from: 's4', to: 's3', type: 'lidoff' },
    { a: .116, b: .150, from: 's3', to: 's0', type: 'drain' },
    { a: .155, b: .190, from: 's0', to: 't1', type: 'pour' },
    { a: .190, b: .225, from: 't1', to: 't2', type: 'rise' },
    { a: .225, b: .260, from: 't2', to: 't3', type: 'rise' },
    { a: .260, b: .285, from: 't3', to: 's1', type: 'fade' },
    { a: .300, b: .330, from: 's1', to: 'm1', type: 'sink', soft: .22 },
    { a: .330, b: .360, from: 'm1', to: 'm2', type: 'sink', soft: .35 },
    { a: .360, b: .385, from: 'm2', to: 's2', type: 'fade' },
    { a: .470, b: .471, from: 's2', to: 's3', type: 'fade' },   // swapped while we're inside the cup
    { a: .600, b: .640, from: 's3', to: 's4', type: 'lid' },
  ];

  function wave(y, amp, ph, k = 1.6) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const x = i / 24, yy = y + amp * Math.sin((x * k + ph) * Math.PI * 2) + amp * .5 * Math.sin((x * k * 2.3 - ph * 1.3) * Math.PI * 2);
      pts.push(`${(x * 100).toFixed(2)}% ${(yy * 100).toFixed(2)}%`);
    }
    return `polygon(0% 100%, ${pts.join(', ')}, 100% 100%)`;
  }
  const feather = (dir, t, soft) => {
    const a = (t * (1 + soft) - soft) * 100, b = t * (1 + soft) * 100;
    return `linear-gradient(${dir}, #000 ${a.toFixed(1)}%, transparent ${b.toFixed(1)}%)`;
  };
  const setMask = (el, m) => { el.style.webkitMaskImage = m; el.style.maskImage = m; };
  const reset = (el) => { el.style.visibility = 'hidden'; el.style.clipPath = ''; setMask(el, ''); el.style.opacity = ''; el.style.translate = ''; el.style.zIndex = ''; };

  let time = 0;
  function frames(p) {
    Object.values(F).forEach(reset);
    let cur = null;
    for (const tr of T) if (p >= tr.a) cur = tr;
    if (!cur) { F.s4.style.visibility = 'visible'; return; }
    const t = seg(p, cur.a, cur.b);
    const A = F[cur.from], B = F[cur.to];
    if (t >= 1) { B.style.visibility = 'visible'; return; }
    A.style.visibility = 'visible'; B.style.visibility = 'visible';
    const amp = reduce ? 0 : 1;
    switch (cur.type) {
      case 'drain': { // the finished cup empties from the top down
        const e = io(t);
        A.style.zIndex = 2; B.style.zIndex = 1;
        A.style.clipPath = wave(lerp(.2, LV.s0 + .03, e), (.012 * Math.sin(e * Math.PI) + .002) * amp, -time * .35);
        return;
      }
      case 'lidoff': // the lid lifts away before the cup drains
        A.style.zIndex = 2; B.style.zIndex = 1;
        A.style.opacity = 1 - io(t);
        A.style.translate = `0 ${(-io(t) * L.bh * .06).toFixed(2)}px`;
        return;
      case 'pour': // tea falls in from the top
        A.style.zIndex = 1; B.style.zIndex = 2;
        setMask(B, feather('180deg', io(t), .06));
        return;
      case 'rise': { // the surface climbs to the next level, then the rest of the frame follows
        A.style.zIndex = 1; B.style.zIndex = 2;
        const y0 = LV[cur.from], y1 = LV[cur.to];
        const y = t < .82 ? lerp(y0, y1, io(t / .82)) : lerp(y1, -.03, io((t - .82) / .18));
        B.style.clipPath = wave(y, .008 * amp, time * .4);
        return;
      }
      case 'sink': A.style.zIndex = 1; B.style.zIndex = 2; setMask(B, feather('180deg', t, cur.soft)); return;
      case 'fade': A.style.zIndex = 1; B.style.zIndex = 2; B.style.opacity = io(t); return;
      case 'lid':
        A.style.zIndex = 1; B.style.zIndex = 2;
        B.style.opacity = clamp(t * 2.4);
        B.style.translate = `0 ${(-(1 - back(t)) * L.bh * .04).toFixed(2)}px`;
        return;
    }
  }

  /* ---------- layout ---------- */
  let L = {};
  function layout() {
    const W = document.documentElement.clientWidth, H = innerHeight, desk = W / H >= .9;
    let bw, bh, bx, by;
    if (desk) { bh = H * .94; bw = bh * 2 / 3; bx = Math.max(W * .38, W * .62 - bw / 2); by = H * .04; }
    else { bw = W; bh = bw * 1.5; if (bh > H * .7) { bh = H * .7; bw = bh / 1.5; } bx = (W - bw) / 2; by = H - bh - H * .02; }
    let cw, ch;
    if (desk) { ch = H * .64; cw = ch * 2 / 3; } else { cw = W * .62; ch = cw * 1.5; if (ch > H * .56) { ch = H * .56; cw = ch / 1.5; } }
    L = { W, H, desk, bw, bh, bx, by, cx: bx + bw / 2, cy: by + bh * .55, cw, ch, ccx: W / 2, ccy: H * .5 };
    const st = stage.style;
    const set = (k, v) => st.setProperty(k, v);
    set('--bx', bx + 'px'); set('--by', by + 'px'); set('--bw', bw + 'px'); set('--bh', bh + 'px');
    set('--cx', (L.cx / W * 100) + '%'); set('--wx', L.cx + 'px');
    set('--wsize', (desk ? bw * .5 : W * .42) + 'px'); set('--wy', (by + bh * (desk ? .3 : .36)) + 'px');
    set('--ebh', (desk ? bh : Math.min(bh, H * .5)) + 'px'); set('--ebw', (desk ? bw : Math.min(bh, H * .5) / 1.5) + 'px'); set('--eby', (desk ? by : H - Math.min(bh, H * .5) - H * .01) + 'px'); set('--ebx', (desk ? bx : (W - Math.min(bh, H * .5) / 1.5) / 2) + 'px');
    set('--cw', cw + 'px'); set('--ch', ch + 'px'); set('--cy', L.ccy + 'px');
    set('--fw', (desk ? W * .24 : W * .3) + 'px');
    fg.forEach((im) => {
      const g = im.dataset.g;
      const s = g === 'tea' ? (desk ? H * .34 : W * .5) : g === 'pearl' ? (desk ? H * .09 : W * .14) : (desk ? H * .2 : W * .3);
      im.style.width = s + 'px';
    });
    render(cur);
  }

  /* ---------- foreground ingredients ---------- */
  const fgTea = fg.filter((i) => i.dataset.g === 'tea'), fgPearl = fg.filter((i) => i.dataset.g === 'pearl');
  const fgFlav = ['f1', 'f2', 'f3'].map((g) => fg.find((i) => i.dataset.g === g));
  const place = (im, x, y, s, r, o, blur) => {
    im.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) rotate(${r.toFixed(1)}deg) scale(${s.toFixed(3)})`;
    im.style.opacity = o.toFixed(3);
    im.style.filter = blur > .3 ? `blur(${blur.toFixed(1)}px)` : '';
  };

  /* ---------- flavours ---------- */
  const FL = [
    { word: 'Milk tea', tag: '01 · The signature', name: 'Milk tea, <em>with pearls</em>', bg: '#cfb08b' },
    { word: 'Peach', tag: '02 · Bright', name: 'Peach tea, <em>fresh slices</em>', bg: '#e8874a' },
    { word: 'Matcha', tag: '03 · Green', name: 'Matcha, <em>over milk</em>', bg: '#7d9d61' },
    { word: 'Coffee', tag: '04 · Bold', name: 'Iced milk coffee, <em>Saigon style</em>', bg: '#3e2618' },
  ];
  let shownK = -1;

  /* ---------- render ---------- */
  let cur = 0, mx = 0, tmx = 0;
  function render(p) {
    cur = p;
    const W = L.W, H = L.H;

    // HERO
    const hx = seg(p, .02, .07);
    cHero.style.opacity = 1 - out(hx);
    cHero.style.translate = `0 ${-60 * io(hx)}px`;
    w1968.style.transform = `translate(calc(-50% + ${(mx * 18).toFixed(1)}px), ${(-H * .06 * io(seg(p, 0, .1))).toFixed(1)}px)`;

    // HERO -> CREAM: cream rises over the green like a liquid
    const r = io(seg(p, .045, .1));
    sBrew.style.clipPath = r <= 0 ? 'polygon(0 100%,100% 100%,100% 100%,0 100%)' : r >= 1 ? 'none' : wave(1 - r * 1.05, (.022 * (1 - r) + .004) * (reduce ? 0 : 1), time * .3, 1.1);

    frames(p);

    // DIVE: the camera lunges into the cup, we look at macro photos, then pull back out
    let sc;
    if (p < .535) sc = 1 + 7 * Math.pow(seg(p, .39, .44), 2.4);
    else if (p < .585) sc = 1 + 7 * Math.pow(1 - out(seg(p, .535, .585)), 1.6);
    else sc = 1 + .03 * io(seg(p, .6, .64)) * (1 - seg(p, .64, .67)); // a tiny settle when the lid lands
    brewBox.style.transform = `scale(${sc.toFixed(4)})`;
    brewBox.style.transformOrigin = '50% 58%';
    const mo = p < .5 ? seg(p, .415, .44) : 1 - seg(p, .535, .565);
    sMacro.style.opacity = mo; sMacro.style.visibility = mo > .001 ? 'visible' : 'hidden';
    if (mo > .001) {
      const k1 = seg(p, .415, .5);
      mMilk.style.transform = `scale(${(1.3 - .22 * out(k1)).toFixed(3)}) translate(${(-1.5 * k1).toFixed(2)}%, ${(1 * k1).toFixed(2)}%)`;
      mPearl.style.opacity = seg(p, .48, .5);
      const k2 = seg(p, .48, .565);
      mPearl.style.transform = `scale(${(1.08 + .1 * k2).toFixed(3)}) translateY(${(-3 + 6 * k2).toFixed(2)}%)`;
      mc1.style.opacity = seg(p, .443, .458) * (1 - seg(p, .474, .484));
      mc1.style.translate = `0 ${(18 - 18 * out(seg(p, .443, .462)) - 14 * seg(p, .474, .484)).toFixed(1)}px`;
      mc2.style.opacity = seg(p, .503, .515) * (1 - seg(p, .527, .535));
      mc2.style.translate = `0 ${(18 - 18 * out(seg(p, .503, .518)) - 14 * seg(p, .527, .535)).toFixed(1)}px`;
    }

    // step copy + rail
    const bands = [[.10, .155], [.155, .295], [.295, .392], [.565, .60], [.60, .67]];
    bands.forEach(([a, b], k) => {
      const i = seg(p, a, a + .012), o = k === 4 ? seg(p, .655, .672) : seg(p, b - .01, b);
      const v = i * (1 - o);
      steps[k].style.opacity = v;
      steps[k].style.translate = `0 ${((1 - out(i)) * 26 - o * 22).toFixed(1)}px`;
      steps[k].style.visibility = v > .001 ? 'visible' : 'hidden';
    });
    rail.forEach((d, k) => d.classList.toggle('on', p >= bands[k + 1][0] && p < bands[k + 1][1]));

    // foreground tea leaves while the tea pours
    const lt = seg(p, .15, .3), lo = Math.sin(lt * Math.PI);
    if (L.desk) {
      if (fgTea[0]) place(fgTea[0], lerp(W * .98, W * .86, lt), lerp(-H * .12, H * .3, lt), 1, lerp(-30, 25, lt), lo * .95, 1.5);
      if (fgTea[1]) place(fgTea[1], lerp(-W * .06, W * .1, lt), lerp(H * 1.08, H * .84, lt), 1.7, lerp(140, 95, lt), lo * .9, 8);
    } else {
      if (fgTea[0]) place(fgTea[0], lerp(W * 1.1, W * .86, lt), lerp(H * .3, H * .52, lt), .8, lerp(-30, 20, lt), lo * .95, 1.2);
      if (fgTea[1]) place(fgTea[1], lerp(-W * .2, W * .06, lt), lerp(H * 1.05, H * .86, lt), 1.3, lerp(140, 95, lt), lo * .9, 6);
    }
    // pearls fly past the lens as the camera pulls back
    const pk = seg(p, .535, .585);
    const PD = [[-.95, -.75, 0], [.9, -.6, .1], [-.8, .85, .18], [1, .8, .05]];
    fgPearl.forEach((im, i) => {
      const [dx, dy, d] = PD[i]; const t = seg(pk, d, d + .8), e = out(t);
      place(im, W / 2 + dx * W * .55 * e, H * .55 + dy * H * .55 * e, 1.4 + 3 * e, i * 50 + t * 40, t > 0 && t < 1 ? Math.min(1, t * 5) * (1 - inn(t)) : 0, 3 + 9 * e);
    });

    // FLAVOURS: the cup shrinks into a card, the other cups join on a ring
    const fv = seg(p, .665, .675);
    sFlav.style.opacity = fv; sFlav.style.visibility = fv > .001 ? 'visible' : 'hidden';
    if (fv > .001) {
      const m = io(seg(p, .67, .715));
      const rot = seg(p, .73, .91) * 3;
      const idx = Math.min(3, Math.floor(rot) + io(rot - Math.floor(rot)));
      const k = Math.min(3, Math.round(idx));
      const a = Math.min(3, Math.floor(idx)), b = Math.min(3, a + 1);
      sFlav.style.setProperty('--fbg', m < 1 ? mix('#f3e8d8', FL[0].bg, m) : mix(FL[a].bg, FL[b].bg, idx - a));
      sFlav.classList.toggle('dark', idx > 2.5);
      cards.forEach((c, i) => {
        const d = i - idx, ang = d * 32 * Math.PI / 180, Rr = L.cw * (L.desk ? 2.25 : 1.9);
        let x = L.ccx + Math.sin(ang) * Rr, y = L.ccy, z = (Math.cos(ang) - 1) * Rr, ry = -d * 24, s = 1 - Math.min(1, Math.abs(d)) * .12;
        let op = clamp(1 - (Math.abs(d) - 1.25) * 1.4);
        if (i === 0) { // morph from the brew box
          const bs = L.bh / L.ch;
          x = lerp(L.cx, x, m); y = lerp(L.by + L.bh / 2, y, m); s = lerp(bs, s, m); z *= m; ry *= m;
          c.style.borderRadius = `${(26 * m / s).toFixed(1)}px`;
          c.style.boxShadow = `0 30px 60px -20px rgba(30,15,5,${(.45 * m).toFixed(2)})`;
        } else {
          op *= seg(m, .45, 1);
          x += (1 - out(seg(m, .3, 1))) * W * .35;
        }
        c.style.transform = `translate3d(${(x - L.cw / 2).toFixed(1)}px, ${(y - L.ch / 2).toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(2)}deg) scale(${s.toFixed(4)})`;
        c.style.opacity = op.toFixed(3);
        c.style.zIndex = String(100 - Math.round(Math.abs(d) * 10));
      });
      if (k !== shownK) { shownK = k; fWord.textContent = FL[k].word; fTag.textContent = FL[k].tag; fName.innerHTML = FL[k].name; dots.forEach((d, i) => d.classList.toggle('on', i === k)); }
      const near = 1 - clamp(Math.abs(idx - k) * 2.4);
      fWord.style.opacity = (near * seg(m, .5, 1)).toFixed(3);
      fWord.style.transform = `translate(calc(-50% + ${((k - idx) * W * .12 + mx * 14).toFixed(1)}px), -60%)`;
      fCopy.style.opacity = (near * seg(m, .7, 1)).toFixed(3);
      fHead.style.opacity = seg(m, .6, 1).toFixed(3);
      fgFlav.forEach((im, i) => {
        if (!im) return;
        const d = idx - (i + 1), v = clamp(1 - Math.abs(d) * 1.6) * seg(m, .8, 1) * (1 - seg(p, .92, .945));
        const sx = L.ccx + L.cw * (i === 1 ? -.78 : .72), sy = L.ccy - L.ch * (i === 2 ? -.28 : .3);
        place(im, sx - d * W * .25, sy + d * 30, 1, -d * 40 + (i - 1) * 25, v, Math.abs(d) * 6 + (i === 1 ? 2 : 0));
      });
    } else fgFlav.forEach((im) => im && (im.style.opacity = 0));

    // END: green rises over everything
    const f = io(seg(p, .925, .965));
    sEnd.style.clipPath = f <= 0 ? 'polygon(0 100%,100% 100%,100% 100%,0 100%)' : f >= 1 ? 'none' : wave(1 - f * 1.05, (.025 * (1 - f) + .004) * (reduce ? 0 : 1), time * .3, 1.1);
    const ce = seg(p, .95, .985);
    cEnd.style.opacity = ce; cEnd.style.translate = `0 ${((1 - out(ce)) * 24).toFixed(1)}px`;
    cEnd.style.visibility = ce > .001 ? 'visible' : 'hidden';

    // chrome colour
    const darkNow = p < .075 || (p > .425 && p < .56) || (p > .665 && sFlav.classList.contains('dark')) || p > .94;
    document.body.classList.toggle('ink', !darkNow);
    document.body.classList.toggle('at-end', p > .955);
  }

  /* ---------- scroll ---------- */
  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  const proxy = { p: 0 };
  const tl = gsap.timeline({ paused: true }).to(proxy, { p: 1, ease: 'none', duration: 1 });
  tl.eventCallback('onUpdate', () => render(proxy.p));
  window.__st = ScrollTrigger.create({ trigger: '#scroll', start: 'top top', end: 'bottom bottom', scrub: .7, animation: tl });
  $('#again').addEventListener('click', () => lenis.scrollTo(0, { duration: 3, easing: io }));

  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') tmx = (e.clientX / innerWidth - .5) * 2; }, { passive: true });
  gsap.ticker.add((t, dt) => {
    time += dt / 1000; mx += (tmx - mx) * .06;
    const live = (cur > .04 && cur < .26) || cur > .66 || Math.abs(tmx - mx) > .001;
    if (live) render(cur);
  });

  addEventListener('resize', () => { layout(); ScrollTrigger.refresh(); });
  layout();

  /* ---------- intro ---------- */
  const heroImg = heroBox.querySelector('img');
  const go = () => {
    if (reduce) return;
    gsap.timeline({ defaults: { ease: 'expo.out' } })
      .from('#sHero .box', { yPercent: 5, opacity: 0, duration: 1.6 }, 0)
      .from(w1968, { opacity: 0, duration: 1.8 }, .2)
      .from('#cHero .line > span', { yPercent: 110, duration: 1.2, stagger: .08 }, .25)
      .from('#cHero .cue', { opacity: 0, duration: 1 }, .9);
  };
  (heroImg.decode ? heroImg.decode() : Promise.resolve()).catch(() => {}).then(go);
})();
