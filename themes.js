/* ============================================================
   themes.js — Match cut temaları (Canvas 2D)
   Kural: Kelime HER ZAMAN ekranın tam ortasında ve aynı boyutta.
   Arka plandaki "sayfa" her kesmede seed'e göre değişir.
   ============================================================ */
(function (global) {
  const TAU = Math.PI * 2;

  /* ---------- Rastgelelik (seed'li) ---------- */
  function rng(seed) {
    let a = seed >>> 0;
    const r = () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.range = (x, y) => x + r() * (y - x);
    r.int = (x, y) => Math.floor(r.range(x, y + 1));
    r.pick = (arr) => arr[Math.floor(r() * arr.length)];
    r.chance = (p) => r() < p;
    return r;
  }
  function hash(...parts) {
    const s = parts.join('|');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* ---------- Dolgu metni ---------- */
  const TR = ('ve bir bu için ile olarak daha çok gibi kadar sonra yeni büyük şehir hükümet açıklama yaptı göre yıl gün insan dünya zaman ancak her şey olan değil bile hem önce son ilk iki üç bütün karar haber ekonomi piyasa halk ülke tarih bilim araştırma sonuç gelecek geçen hafta bugün yarın sabah akşam sessiz uzun kısa eski genç güçlü sorun çözüm proje sistem gece yol kapı ev deniz ışık rüzgar ses söz kitap sayfa mektup hikaye yine artık hiç belki aslında üzerinde altında arasında karşı doğru tüm birlikte yalnız hızla yavaşça kendi onun bizim onların şimdi orada burada bazı birçok önemli farklı özel genel yerel meclis bakan başkan toplantı rapor veri oran yüzde milyon sektör şirket teknoloji gelişme değişim süreç dönem bölge merkez kültür sanat müzik film sahne yazar okur bilgi düşünce fikir duygu umut korku sevgi anı yaşam doğa orman dağ nehir göl yağmur kar güneş ay yıldız gökyüzü toprak taş demir cam kağıt kalem masa pencere duvar sokak cadde meydan köprü liman tren istasyon').split(' ');
  const EN = ('the of and to in that is was for on with as by at from his her it this which but not are be have one all their they were has had been would there an we more when who will no if out so said what up its about into than them can only other new some could time these two may first then do any like my now over such our man me even most made after also did many before must through back years where much your way well down should because each just those people how too little state good very make world still own see men work long get here between both life being under never day same another know while last might us great old year off come since against go came right used take three city river letter story night window light silence future memory').split(' ');

  const locale = (lang) => (lang === 'en' ? 'en' : 'tr');
  const cap1 = (w, lang) => w.charAt(0).toLocaleUpperCase(locale(lang)) + w.slice(1);

  function filler(R, lang) {
    const pool = lang === 'en' ? EN : TR;
    let cap = true, count = 0, len = R.int(5, 14);
    return () => {
      let w = R.pick(pool);
      if (cap) { w = cap1(w, lang); cap = false; }
      count++;
      if (count >= len) {
        count = 0; len = R.int(5, 14);
        const p = R.chance(0.78) ? '.' : R.chance(0.5) ? ',' : R.chance(0.5) ? ';' : '?';
        w += p;
        if (p === '.' || p === '?') cap = true;
      } else if (R.chance(0.05)) w += ',';
      return w;
    };
  }
  const clean = (w) => w.replace(/[.,;?]/g, '');

  /* ---------- Fontlar ---------- */
  const FONTS = {
    news: ['Libre Baskerville', 'Playfair Display', 'Merriweather', 'PT Serif', 'Old Standard TT', 'EB Garamond'],
    book: ['EB Garamond', 'Cormorant Garamond', 'Crimson Text', 'Lora', 'Libre Baskerville'],
    sans: ['Inter', 'Roboto', 'Open Sans', 'Source Sans 3'],
    mono: ['Special Elite', 'Courier Prime', 'Cutive Mono', 'IBM Plex Mono'],
    mag: ['Bebas Neue', 'Abril Fatface', 'Anton', 'Playfair Display', 'Oswald', 'Permanent Marker', 'Special Elite', 'Archivo Black', 'Lobster', 'Bodoni Moda', 'Courier Prime', 'Libre Baskerville'],
  };
  const ALL_FAMILIES = [...new Set(Object.values(FONTS).flat())];
  const F = (fam, size, weight = 400, style = 'normal') =>
    `${style} ${weight} ${Math.max(1, Math.round(size))}px "${fam}", Georgia, serif`;

  /* ---------- Çizim yardımcıları ---------- */
  function rr(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  let _noise = null;
  function getNoise() {
    if (_noise) return _noise;
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const img = g.createImageData(256, 256);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + Math.random() * 145;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return (_noise = c);
  }

  function grain(ctx, W, H, R, alpha, mode = 'multiply') {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = mode;
    ctx.fillStyle = ctx.createPattern(getNoise(), 'repeat');
    ctx.translate(-R() * 256, -R() * 256);
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }

  function paper(ctx, W, H, color, R, amt = 1) {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 6; i++) {
      const x = R() * W, y = R() * H, r = R.range(0.2, 0.7) * Math.max(W, H);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, R.chance(0.5) ? `rgba(110,75,25,${0.06 * amt})` : `rgba(255,255,255,${0.08 * amt})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
    grain(ctx, W, H, R, 0.12 * amt);
  }

  /* ---------- Vurgu (highlight) ---------- */
  function highlight(ctx, x, base, w, size, style, color, R, dark) {
    if (!style || style === 'none') return;
    ctx.save();
    const pad = size * 0.12;
    const j = () => R.range(-1, 1) * size * 0.05;
    if (style === 'marker') {
      ctx.globalCompositeOperation = dark ? 'source-over' : 'multiply';
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = color;
      const top = base - size * 0.84, bot = base + size * 0.24;
      ctx.beginPath();
      ctx.moveTo(x - pad + j(), top + j());
      ctx.lineTo(x + w + pad + j(), top + j());
      ctx.lineTo(x + w + pad + j(), bot + j());
      ctx.lineTo(x - pad + j(), bot + j());
      ctx.closePath();
      ctx.fill();
    } else if (style === 'underline') {
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.09;
      ctx.lineCap = 'round';
      const y = base + size * 0.16;
      ctx.beginPath();
      ctx.moveTo(x - pad * 0.5, y + j());
      ctx.quadraticCurveTo(x + w / 2, y + R.range(-1, 1) * size * 0.08, x + w + pad * 0.5, y + j());
      ctx.stroke();
    } else if (style === 'box') {
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.07;
      ctx.lineJoin = 'round';
      rr(ctx, x - pad * 1.6, base - size * 0.95, w + pad * 3.2, size * 1.32, size * 0.14);
      ctx.stroke();
    } else if (style === 'circle') {
      ctx.strokeStyle = color;
      ctx.lineWidth = size * 0.075;
      ctx.lineCap = 'round';
      const cx = x + w / 2, cy = base - size * 0.32, rx = w / 2 + size * 0.5, ry = size * 0.88;
      const start = R.range(0, TAU);
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const p = i / 72, a = start + p * TAU * 1.12;
        const k = 1 + p * 0.07 + Math.sin(a * 3) * 0.012;
        ctx.lineTo(cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- Kelime çizimi ---------- */
  function drawWord(ctx, t, x, y, R, o, color) {
    let col = color || o.color;
    if (!color && o.linkChance && R.chance(o.linkChance)) col = o.linkColor;
    ctx.fillStyle = col;
    if (o.perChar) {
      let cx = x;
      for (const ch of t) {
        ctx.globalAlpha = R.range(0.6, 1);
        ctx.fillText(ch, cx + R.range(-1, 1) * o.jit, y + R.range(-1, 1) * o.jit);
        cx += ctx.measureText(ch).width;
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillText(t, x, y);
    }
  }

  /* ---------- Genel metin sayfası (gazete/kitap/wiki/daktilo) ---------- */
  function textPage(ctx, W, H, R, o) {
    const cx = W / 2, S = o.wordSize, base = H / 2 + S * 0.36;
    const next = filler(R, o.lang);
    const bodySize = o.bodySize || S;
    const lineH = o.lineH || bodySize * 1.45;
    const cols = o.cols || [[-S * 2, W + S * 2]];
    const gapA = o.gapAbove || lineH, gapB = o.gapBelow || lineH;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';

    ctx.font = o.wordFont;
    const ww = ctx.measureText(o.word).width;
    const wx = cx - ww / 2;

    highlight(ctx, wx, base, ww, S, o.hl, o.hlColor, R, o.dark);

    const line = (y, x0, x1, indent) => {
      ctx.font = o.bodyFont;
      const sp = ctx.measureText(' ').width;
      let x = x0 + (indent ? bodySize * 1.6 : 0);
      if (x0 < 0) x -= R() * bodySize * 4;
      const ends = R.chance(o.paraChance ?? 0.08);
      const end = ends ? x0 + (x1 - x0) * R.range(0.3, 0.8) : x1;
      let guard = 0;
      while (guard++ < 200) {
        const w = next();
        const mw = ctx.measureText(w).width;
        if (x + mw > end) break;
        drawWord(ctx, w, x, y, R, o);
        x += mw + sp;
      }
      return ends;
    };

    cols.forEach(([x0, x1]) => {
      const isCenter = x0 <= wx && wx + ww <= x1;
      if (isCenter) {
        ctx.font = o.centerFont || o.bodyFont;
        const csp = ctx.measureText(' ').width;
        let x = wx - csp, guard = 0;
        while (guard++ < 80) {
          const w = next(); const mw = ctx.measureText(w).width;
          if (x - mw < x0) break;
          drawWord(ctx, w, x - mw, base, R, o);
          x -= mw + csp;
        }
        x = wx + ww + csp; guard = 0;
        while (guard++ < 80) {
          const w = next(); const mw = ctx.measureText(w).width;
          if (x + mw > x1) break;
          drawWord(ctx, w, x, base, R, o);
          x += mw + csp;
        }
        let para = false;
        for (let y = base - gapA; y > -lineH; y -= lineH) para = line(y, x0, x1, para && o.indent);
        para = false;
        for (let y = base + gapB; y < H + lineH; y += lineH) para = line(y, x0, x1, para && o.indent);
      } else {
        let para = false;
        const startY = base - Math.ceil((base + lineH) / lineH) * lineH;
        for (let y = startY; y < H + lineH; y += lineH) para = line(y, x0, x1, para && o.indent);
      }
    });

    ctx.font = o.wordFont;
    drawWord(ctx, o.word, wx, base, R, o, o.wordColor || o.color);
    if (o.doubleStrike) drawWord(ctx, o.word, wx + 1.2, base + 0.6, R, o, o.wordColor || o.color);
    return { wx, ww, base, lineH };
  }

  /* ============================================================
     TEMALAR
     ============================================================ */
  const themes = {};

  /* 1. GAZETE */
  themes.newspaper = {
    label: 'Gazete', hl: { style: 'marker', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size;
      paper(ctx, W, H, R.pick(['#f1ebdd', '#ebe3cf', '#f4f0e6', '#e6dcc4', '#efe8d8']), R, 1.3);
      const fam = R.pick(FONTS.news);
      const ink = R.pick(['#161412', '#221e1a', '#2a2622']);
      const headline = R.chance(0.35);
      const wordFont = F(fam, S, headline ? R.pick([700, 900]) : R.pick([400, 700]));
      ctx.font = wordFont;
      const ww = ctx.measureText(word).width;
      const wx = W / 2 - ww / 2;

      if (headline) {
        const bodySize = S * R.range(0.36, 0.48);
        const m = S * R.range(0.6, 2.5);
        textPage(ctx, W, H, R, {
          ...o, word, wordSize: S, wordFont, color: ink,
          bodyFont: F(fam, bodySize), bodySize, lineH: bodySize * 1.32,
          centerFont: F(fam, S, 700), cols: [[Math.min(m, wx), Math.max(W - m, wx + ww)]],
          gapAbove: S * 1.1, gapBelow: S * 0.42 + bodySize * 1.25, indent: true,
        });
        // üst/alt ince çizgiler
        ctx.fillStyle = ink;
        ctx.fillRect(0, H / 2 - S * 0.85, W, S * 0.025);
        ctx.fillRect(0, H / 2 + S * 0.62, W, S * 0.025);
      } else {
        const colW = Math.max(ww + S, S * R.range(10, 15));
        const gap = S * R.range(1.1, 1.7);
        const c0 = wx - R() * (colW - ww);
        const cols = [];
        for (let x = c0; x > -colW - gap; x -= colW + gap) cols.unshift([x, x + colW]);
        for (let x = c0 + colW + gap; x < W + gap; x += colW + gap) cols.push([x, x + colW]);
        textPage(ctx, W, H, R, {
          ...o, word, wordSize: S, wordFont, color: ink,
          bodyFont: F(fam, S), bodySize: S, lineH: S * R.range(1.22, 1.38), cols, indent: true,
        });
        ctx.fillStyle = ink;
        ctx.globalAlpha = 0.55;
        cols.forEach(([x0], i) => { if (i > 0) ctx.fillRect(x0 - gap / 2, 0, Math.max(1.5, S * 0.02), H); });
        ctx.globalAlpha = 1;
      }
    },
  };

  /* 2. KİTAP */
  themes.book = {
    label: 'Kitap', hl: { style: 'marker', color: '#f7d94c' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size;
      paper(ctx, W, H, R.pick(['#f3e9d2', '#efe3c6', '#f7f0dd', '#e9dcbd', '#faf5e8']), R, 1);
      const fam = R.pick(FONTS.book);
      const ink = R.pick(['#2a241c', '#1f1a14', '#33291f']);
      const st = R();
      const wordFont = st < 0.3 ? F(fam, S, 400, 'italic') : F(fam, S, st < 0.55 ? 700 : 400);
      ctx.font = wordFont;
      const ww = ctx.measureText(word).width;
      const wx = W / 2 - ww / 2;
      let cols = [[-S * 2, W + S * 2]];
      let edge = null;
      if (R.chance(0.55)) {
        const left = R.chance(0.5);
        const margin = S * R.range(1.4, 3);
        if (left) {
          const tx = wx - R.range(0.5, 5) * S;
          edge = { x: tx - margin, left };
          cols = [[tx, W + S * 2]];
        } else {
          const tx = wx + ww + R.range(0.5, 5) * S;
          edge = { x: tx + margin, left };
          cols = [[-S * 2, tx]];
        }
      }
      textPage(ctx, W, H, R, {
        ...o, word, wordSize: S, wordFont, color: ink,
        bodyFont: F(fam, S), bodySize: S, lineH: S * R.range(1.35, 1.55), cols, indent: true, paraChance: 0.1,
      });
      if (edge) { // cilt/gutter gölgesi
        const w = S * 3;
        const g = ctx.createLinearGradient(edge.x - w, 0, edge.x + w, 0);
        g.addColorStop(0, 'rgba(60,40,20,0)');
        g.addColorStop(0.5, 'rgba(60,40,20,0.38)');
        g.addColorStop(1, 'rgba(60,40,20,0)');
        ctx.fillStyle = g;
        ctx.fillRect(edge.x - w, 0, w * 2, H);
      }
    },
  };

  /* 3. GOOGLE ARAMA */
  const SITES = {
    tr: ['Vikipedi', 'Hürriyet', 'Ekşi Sözlük', 'YouTube', 'Milliyet', 'TDK Sözlük', 'Medium', 'Reddit', 'BBC Türkçe', 'NTV'],
    en: ['Wikipedia', 'Merriam-Webster', 'YouTube', 'Reddit', 'Medium', 'BBC', 'The Guardian', 'Britannica', 'Quora', 'NY Times'],
  };
  function magnifier(ctx, x, y, s, col) {
    ctx.save();
    ctx.strokeStyle = col; ctx.lineWidth = s * 0.075; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x - s * 0.06, y - s * 0.06, s * 0.24, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 0.12, y + s * 0.12); ctx.lineTo(x + s * 0.32, y + s * 0.32); ctx.stroke();
    ctx.restore();
  }
  function mic(ctx, x, y, s) {
    ctx.save();
    ctx.fillStyle = '#4285F4';
    rr(ctx, x - s * 0.12, y - s * 0.4, s * 0.24, s * 0.44, s * 0.12); ctx.fill();
    ctx.strokeStyle = '#34A853'; ctx.lineWidth = s * 0.07; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, y - s * 0.1, s * 0.24, 0.1, Math.PI - 0.1); ctx.stroke();
    ctx.strokeStyle = '#EA4335';
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.15); ctx.lineTo(x, y + s * 0.32); ctx.stroke();
    ctx.restore();
  }
  function gLogo(ctx, x, y, size, fam, align) {
    const letters = ['G', 'o', 'o', 'g', 'l', 'e'];
    const cols = ['#4285F4', '#EA4335', '#FBBC05', '#4285F4', '#34A853', '#EA4335'];
    ctx.font = F(fam, size, 500);
    const total = ctx.measureText('Google').width;
    let cx = align === 'right' ? x - total : align === 'center' ? x - total / 2 : x;
    letters.forEach((l, i) => { ctx.fillStyle = cols[i]; ctx.fillText(l, cx, y); cx += ctx.measureText(l).width; });
  }
  themes.google = {
    label: 'Google Arama', hl: { style: 'none', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size, cx = W / 2, cy = H / 2;
      const dark = o.mode ? (o.mode === 'dark') : R.chance(0.35);
      const c = dark
        ? { bg: '#202124', bar: '#303134', text: '#e8eaed', sub: '#9aa0a6', link: '#8ab4f8', border: '#5f6368', btn: '#303134' }
        : { bg: '#ffffff', bar: '#ffffff', text: '#202124', sub: '#4d5156', link: '#1a0dab', border: '#dfe1e5', btn: '#f8f9fa' };
      c.dark = dark;
      const fam = R.pick(['Roboto', 'Open Sans', 'Inter']);
      const lang = o.lang;
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';

      ctx.font = F(fam, S, 400);
      const ww = ctx.measureText(word).width;
      const barH = S * 1.9;
      const barW = Math.max(ww + S * 6, Math.min(W * 0.82, S * R.range(11, 15)));
      const barX = cx - barW / 2, barY = cy - barH / 2;
      const home = R.chance(0.5);

      if (home) {
        gLogo(ctx, cx, barY - S * 1.2, S * 2.6, fam, 'center');
      } else {
        gLogo(ctx, barX - S * 0.7, cy + S * 0.4, S * 1.15, fam, 'right');
      }

      // arama çubuğu
      ctx.save();
      ctx.shadowColor = dark ? 'rgba(0,0,0,0.6)' : 'rgba(32,33,36,0.28)';
      ctx.shadowBlur = S * 0.35; ctx.shadowOffsetY = S * 0.06;
      rr(ctx, barX, barY, barW, barH, barH / 2);
      ctx.fillStyle = c.bar; ctx.fill();
      ctx.restore();
      rr(ctx, barX, barY, barW, barH, barH / 2);
      ctx.strokeStyle = c.border; ctx.lineWidth = Math.max(1.5, S * 0.025); ctx.stroke();
      magnifier(ctx, barX + S * 0.95, cy, S, c.sub);
      mic(ctx, barX + barW - S * 0.95, cy, S);

      const base = cy + S * 0.36, wx = cx - ww / 2;
      highlight(ctx, wx, base, ww, S, o.hl, o.hlColor, R, dark);
      ctx.font = F(fam, S, 400);
      ctx.fillStyle = c.text; ctx.fillText(word, wx, base);
      ctx.fillStyle = c.link; ctx.fillRect(wx + ww + S * 0.08, cy - S * 0.55, Math.max(2, S * 0.035), S * 1.1);

      if (home) {
        const labels = lang === 'en' ? ['Google Search', "I'm Feeling Lucky"] : ["Google'da Ara", 'Kendimi Şanslı Hissediyorum'];
        ctx.font = F(fam, S * 0.4, 400);
        const bw = labels.map((l) => ctx.measureText(l).width + S * 0.9);
        const gap = S * 0.3, tot = bw[0] + bw[1] + gap;
        let bx = cx - tot / 2; const by = barY + barH + S * 0.9;
        labels.forEach((l, i) => {
          rr(ctx, bx, by, bw[i], S * 0.95, S * 0.12); ctx.fillStyle = c.btn; ctx.fill();
          ctx.fillStyle = c.text; ctx.fillText(l, bx + S * 0.45, by + S * 0.62);
          bx += bw[i] + gap;
        });
        ctx.font = F(fam, S * 0.36, 400); ctx.fillStyle = c.sub;
        ctx.fillText((lang === 'en' ? 'Google offered in: ' : 'Google şu dillerde kullanılabilir: ') + 'English  Deutsch  Français', cx - S * 5.2, by + S * 2.2);
      } else {
        const next = filler(R, lang);
        const tabs = lang === 'en' ? ['All', 'Images', 'News', 'Videos', 'Maps'] : ['Tümü', 'Görseller', 'Haberler', 'Videolar', 'Haritalar'];
        let tx = barX + S * 0.4, ty = barY + barH + S * 0.95;
        ctx.font = F(fam, S * 0.4, 400);
        tabs.forEach((t, i) => {
          ctx.fillStyle = i === 0 ? c.link : c.sub;
          ctx.fillText(t, tx, ty);
          if (i === 0) ctx.fillRect(tx, ty + S * 0.22, ctx.measureText(t).width, S * 0.06);
          tx += ctx.measureText(t).width + S * 0.7;
        });
        ctx.fillStyle = c.border; ctx.fillRect(0, ty + S * 0.28, W, Math.max(1, S * 0.015));
        let y = ty + S * 1.4; const x = barX + S * 0.4;
        const sites = SITES[lang === 'en' ? 'en' : 'tr'];
        while (y < H + S) {
          const fav = S * 0.3;
          ctx.fillStyle = `hsl(${R.int(0, 360)},55%,${dark ? 45 : 82}%)`;
          ctx.beginPath(); ctx.arc(x + fav, y - S * 0.1, fav, 0, TAU); ctx.fill();
          const site = R.pick(sites);
          ctx.font = F(fam, S * 0.38, 500); ctx.fillStyle = c.text;
          ctx.fillText(site, x + fav * 2 + S * 0.25, y - S * 0.15);
          ctx.font = F(fam, S * 0.32, 400); ctx.fillStyle = c.sub;
          ctx.fillText('https://www.' + site.toLowerCase().replace(/[^a-zçğıöşü]/g, '') + '.com › ' + clean(next()).toLowerCase(), x + fav * 2 + S * 0.25, y + S * 0.28);
          y += S * 1.1;
          ctx.font = F(fam, S * 0.62, 400); ctx.fillStyle = c.link;
          ctx.fillText(cap1(word, lang) + ' — ' + [next(), next(), next()].map(clean).join(' '), x, y);
          y += S * 0.78;
          for (let l = 0; l < 2; l++) {
            let xx = x; const maxX = x + Math.min(W - x - S, S * 17);
            let guard = 0;
            while (guard++ < 60) {
              const isW = R.chance(0.08);
              const w = isW ? word : next();
              ctx.font = F(fam, S * 0.42, isW ? 700 : 400);
              const mw = ctx.measureText(w + ' ').width;
              if (xx + mw > maxX) break;
              ctx.fillStyle = isW ? c.text : c.sub;
              ctx.fillText(w, xx, y); xx += mw;
            }
            y += S * 0.62;
          }
          y += S * 0.95;
        }
      }
    },
  };

  /* 4. VİKİPEDİ */
  themes.wiki = {
    label: 'Vikipedi', hl: { style: 'marker', color: '#ffec6e' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size;
      const dark = o.mode ? (o.mode === 'dark') : false;
      const bg = dark ? (R.chance(0.7) ? '#101418' : '#181d22') : (R.chance(0.8) ? '#ffffff' : '#f8f9fa');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
      const fam = R.pick(FONTS.sans);
      const text = dark ? '#eaecf0' : '#202122';
      const link = dark ? '#6b9eff' : '#3366cc';
      const border = dark ? '#3c4043' : '#a2a9b1';
      const cardBg = dark ? '#1b2026' : '#f8f9fa';
      const headerBg = dark ? '#101418' : '#ffffff';
      const asLink = R.chance(0.35);
      const wordFont = F(fam, S, asLink ? 400 : 700);
      ctx.font = wordFont;
      const ww = ctx.measureText(word).width;
      const wx = W / 2 - ww / 2;
      const lineH = S * R.range(1.45, 1.65);
      const x0 = R.chance(0.6) ? wx - R.range(1, 8) * S : -S * 2;
      let x1 = W + S * 2, box = null;
      const bx = wx + ww + R.range(1.5, 4) * S;
      if (bx < W - S * 5 && R.chance(0.6)) { box = bx; x1 = bx - S; }
      const res = textPage(ctx, W, H, R, {
        ...o, word, wordSize: S, wordFont, color: text, wordColor: asLink ? link : text,
        bodyFont: F(fam, S), bodySize: S, lineH, cols: [[x0, x1]],
        linkChance: 0.1, linkColor: link, paraChance: 0.12, dark,
      });
      const lx = Math.max(x0, -S * 2);
      if (R.chance(0.55)) { // başlık bandı
        const k = R.int(3, 5), base = res.base;
        const top = base - (k + 2) * lineH - S * 0.9, bot = base - k * lineH + S * 0.3;
        ctx.fillStyle = headerBg; ctx.fillRect(lx - S, top, x1 - lx + S * 2, bot - top);
        const tx = x0 < 0 ? W / 2 - S * 6 : x0;
        ctx.font = F(R.pick(['Libre Baskerville', 'Lora', 'PT Serif']), S * 1.6, 400);
        ctx.fillStyle = dark ? '#ffffff' : '#000000';
        ctx.fillText(cap1(word, o.lang), tx, bot - S * 0.85);
        ctx.fillStyle = border; ctx.fillRect(lx, bot - S * 0.5, x1 - lx, Math.max(1.5, S * 0.02));
        ctx.font = F(fam, S * 0.42, 400); ctx.fillStyle = dark ? '#9aa0a6' : '#54595d';
        ctx.fillText(o.lang === 'en' ? 'From Wikipedia, the free encyclopedia' : 'Vikipedi, özgür ansiklopedi', tx, bot - S * 0.05);
      }
      if (box !== null) { // bilgi kutusu
        const top = R.range(-S * 2, H * 0.25), h = H * R.range(0.8, 1.2);
        ctx.fillStyle = cardBg; ctx.fillRect(box, top, W, h);
        ctx.strokeStyle = border; ctx.lineWidth = Math.max(1.5, S * 0.02); ctx.strokeRect(box, top, W, h);
        const iw = Math.min(W - box - S * 0.8, S * 7);
        ctx.font = F(fam, S * 0.6, 700); ctx.fillStyle = text;
        ctx.fillText(cap1(word, o.lang), box + S * 0.4, top + S * 0.9);
        const g = ctx.createLinearGradient(box, top + S * 1.3, box + iw, top + S * 1.3 + iw * 0.7);
        const hue = R.int(0, 360);
        g.addColorStop(0, `hsl(${hue},35%,${dark ? 45 : 55}%)`); g.addColorStop(1, `hsl(${(hue + 60) % 360},30%,${dark ? 20 : 25}%)`);
        ctx.fillStyle = g; ctx.fillRect(box + S * 0.4, top + S * 1.3, iw, iw * 0.7);
        let y = top + S * 1.9 + iw * 0.7; const next = filler(R, o.lang);
        for (let i = 0; i < 8; i++) {
          ctx.font = F(fam, S * 0.38, 700); ctx.fillStyle = text;
          ctx.fillText(cap1(clean(next()), o.lang), box + S * 0.4, y);
          ctx.font = F(fam, S * 0.38, 400); ctx.fillStyle = R.chance(0.4) ? link : text;
          ctx.fillText(clean(next()) + ' ' + clean(next()), box + S * 3, y);
          y += S * 0.62;
        }
      }
    },
  };

  /* 5. SOHBET */
  const CHAT_SCHEMES = [
    { name: 'imessage', bg: '#ffffff', me: '#0a84ff', meText: '#ffffff', them: '#e9e9eb', themText: '#000000', meta: '#8e8e93', dark: false },
    { name: 'imessage-dark', bg: '#000000', me: '#0a84ff', meText: '#ffffff', them: '#26262a', themText: '#ffffff', meta: '#8e8e93', dark: true },
    { name: 'whatsapp-dark', bg: '#0b141a', me: '#005c4b', meText: '#e9edef', them: '#202c33', themText: '#e9edef', meta: '#8696a0', dark: true },
    { name: 'whatsapp', bg: '#efeae2', me: '#d9fdd3', meText: '#111b21', them: '#ffffff', themText: '#111b21', meta: '#667781', dark: false },
    { name: 'telegram', bg: '#a7c4a0', me: '#effdde', meText: '#000000', them: '#ffffff', themText: '#000000', meta: '#5f8a5a', dark: false },
    { name: 'telegram-dark', bg: '#0e1621', me: '#2b5278', meText: '#ffffff', them: '#182533', themText: '#ffffff', meta: '#647c94', dark: true },
  ];
  function wrapWords(ctx, words, maxW) {
    const lines = []; let cur = '';
    words.forEach((w) => {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  themes.chat = {
    label: 'Sohbet', hl: { style: 'none', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size, cx = W / 2, cy = H / 2;
      const isDark = o.mode ? (o.mode === 'dark') : R.chance(0.5);
      const pool = CHAT_SCHEMES.filter((s) => s.dark === isDark);
      const sc = R.pick(pool.length ? pool : CHAT_SCHEMES);
      const fam = R.pick(['Inter', 'Roboto', 'Open Sans']);
      ctx.fillStyle = sc.bg; ctx.fillRect(0, 0, W, H);
      if (sc.name.startsWith('whatsapp')) grain(ctx, W, H, R, 0.05);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const font = F(fam, S, 400);
      ctx.font = font;
      const next = filler(R, o.lang);
      const padX = S * 0.6, padY = S * 0.42, lh = S * 1.25, rad = S * 0.75;
      const ww = ctx.measureText(word).width, wx = cx - ww / 2, base = cy + S * 0.36;
      const pre = Array.from({ length: R.int(0, 2) }, () => clean(next()).toLowerCase()).join(' ');
      const suf = Array.from({ length: R.int(0, 2) }, () => clean(next()).toLowerCase()).join(' ');
      const preW = pre ? ctx.measureText(pre + ' ').width : 0;
      const sufW = suf ? ctx.measureText(' ' + suf).width : 0;
      const side = R.chance(0.5) ? 'me' : 'them';
      const bx = wx - preW - padX, bw = preW + ww + sufW + padX * 2;
      const btop = base - S * 0.8 - padY, bh = S * 1.05 + padY * 2;
      const maxW = Math.min(W * 0.62, S * 11);
      const themX = side === 'them' ? bx : Math.min(bx, W * 0.05);
      const meRight = side === 'me' ? bx + bw : Math.max(bx + bw, W * 0.95);

      const bubble = (x, y, w, h, who) => {
        rr(ctx, x, y, w, h, rad);
        ctx.fillStyle = who === 'me' ? sc.me : sc.them; ctx.fill();
      };
      // orta balon
      bubble(bx, btop, bw, bh, side);
      highlight(ctx, wx, base, ww, S, o.hl, o.hlColor, R, sc.dark);
      ctx.fillStyle = side === 'me' ? sc.meText : sc.themText;
      if (pre) ctx.fillText(pre, bx + padX, base);
      ctx.fillText(word, wx, base);
      if (suf) ctx.fillText(suf, wx + ww + ctx.measureText(' ').width, base);

      const makeBubble = () => {
        const who = R.chance(0.5) ? 'me' : 'them';
        if (R.chance(0.12)) return { stamp: true, h: S * 1.1 };
        const words = Array.from({ length: R.int(1, 10) }, () => next());
        words[0] = cap1(words[0], o.lang);
        ctx.font = font;
        const lines = wrapWords(ctx, words, maxW);
        const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
        const h = S * 1.05 + padY * 2 + (lines.length - 1) * lh;
        return { who, lines, w, h };
      };
      const drawB = (b, top) => {
        if (b.stamp) {
          ctx.font = F(fam, S * 0.42, 600); ctx.fillStyle = sc.meta; ctx.textAlign = 'center';
          const t = (o.lang === 'en' ? R.pick(['Today', 'Yesterday', 'Monday']) : R.pick(['Bugün', 'Dün', 'Pazartesi'])) + ' ' + R.int(0, 23).toString().padStart(2, '0') + ':' + R.int(0, 59).toString().padStart(2, '0');
          ctx.fillText(t, cx, top + S * 0.7); ctx.textAlign = 'left';
          return;
        }
        const x = b.who === 'them' ? themX : meRight - b.w;
        bubble(x, top, b.w, b.h, b.who);
        ctx.font = font; ctx.fillStyle = b.who === 'me' ? sc.meText : sc.themText;
        b.lines.forEach((l, i) => ctx.fillText(l, x + padX, top + padY + S * 0.8 + i * lh));
      };
      const gap = S * 0.3;
      let y = btop - gap;
      while (y > -S) { const b = makeBubble(); y -= b.h; drawB(b, y); y -= gap; }
      y = btop + bh + gap;
      while (y < H + S) { const b = makeBubble(); drawB(b, y); y += b.h + gap; }
    },
  };

  /* 6. YORUMLAR */
  const NAMES = ['deniz', 'mert', 'ece', 'kaan', 'zeynep', 'arda', 'selin', 'emre', 'ayse', 'can', 'nova', 'pixel', 'luna', 'atlas', 'mavi', 'kuzey', 'echo', 'jules', 'sam', 'riley'];
  themes.comments = {
    label: 'Yorumlar', hl: { style: 'none', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size, cx = W / 2, cy = H / 2;
      const dark = o.mode ? (o.mode === 'dark') : R.chance(0.6);
      const c = dark ? { bg: '#0f0f0f', text: '#f1f1f1', sub: '#aaaaaa', blue: '#3ea6ff' } : { bg: '#ffffff', text: '#0f0f0f', sub: '#606060', blue: '#065fd4' };
      const fam = R.pick(['Roboto', 'Inter', 'Open Sans']);
      ctx.fillStyle = c.bg; ctx.fillRect(0, 0, W, H);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      const next = filler(R, o.lang);
      const font = F(fam, S, 400);
      ctx.font = font;
      const sp = ctx.measureText(' ').width;
      const ww = ctx.measureText(word).width, wx = cx - ww / 2, base = cy + S * 0.36;
      const lineH = S * 1.3, right = W - S * 0.6;

      const textX = wx;

      const fillLine = (y, partial) => {
        ctx.font = font; ctx.fillStyle = c.text;
        let x = textX; const end = partial ? textX + (right - textX) * R.range(0.3, 0.9) : right;
        let g = 0;
        while (g++ < 60) { const w = next(); const mw = ctx.measureText(w).width; if (x + mw > end) break; ctx.fillText(w, x, y); x += mw + sp; }
      };
      const header = (y) => {
        ctx.font = F(fam, S * 0.55, 600); ctx.fillStyle = c.text;
        const name = '@' + R.pick(NAMES) + R.pick(['', '_', '.']) + R.int(1, 999);
        ctx.fillText(name, textX, y);
        const nw = ctx.measureText(name + '  ').width;
        ctx.font = F(fam, S * 0.5, 400); ctx.fillStyle = c.sub;
        const n = R.int(1, 11);
        const unit = o.lang === 'en' ? R.pick(['day', 'week', 'month', 'year']) : R.pick(['gün', 'hafta', 'ay', 'yıl']);
        ctx.fillText(o.lang === 'en' ? `${n} ${unit}${n > 1 ? 's' : ''} ago` : `${n} ${unit} önce`, textX + nw, y);
        // avatar
        const ar = S * 0.75, ax = textX - S * 1.35, ay = y + S * 0.45;
        ctx.fillStyle = `hsl(${R.int(0, 360)},55%,${dark ? 45 : 60}%)`;
        ctx.beginPath(); ctx.arc(ax, ay, ar, 0, TAU); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = F(fam, S * 0.75, 500); ctx.textAlign = 'center';
        ctx.fillText(name.charAt(1).toLocaleUpperCase('tr'), ax, ay + S * 0.27); ctx.textAlign = 'left';
      };
      const actions = (y) => {
        ctx.font = F(fam, S * 0.5, 400); ctx.fillStyle = c.sub;
        const likes = R.chance(0.5) ? R.int(1, 999) : (R.int(1, 99) / 10).toFixed(1).replace('.', ',') + (o.lang === 'en' ? 'K' : ' B');
        const t = `👍 ${likes}     👎     ${o.lang === 'en' ? 'Reply' : 'Yanıtla'}`;
        ctx.fillText(t, textX, y);
        if (R.chance(0.35)) {
          ctx.fillStyle = c.blue; ctx.font = F(fam, S * 0.5, 600);
          ctx.fillText(`▾ ${R.int(2, 140)} ${o.lang === 'en' ? 'replies' : 'yanıt'}`, textX, y + S * 0.85);
          return S * 0.85;
        }
        return 0;
      };
      const blockH = (n) => S * 0.7 + lineH * 0.95 + (n - 1) * lineH + lineH * 1.05 + S * 0.35;

      // orta yorum (bizim yorumumuz - sadece yazdığımız metin)
      header(base - lineH * 0.95);
      highlight(ctx, wx, base, ww, S, o.hl, o.hlColor, R, dark);
      ctx.font = font; ctx.fillStyle = c.text;
      ctx.fillText(word, wx, base);
      const extra = actions(base + lineH * 1.05);
      let top = base - lineH * 0.95 - S * 0.7;
      let bottom = base + lineH * 1.05 + S * 0.35 + extra;

      const drawComment = (topY, k) => {
        const hy = topY + S * 0.7;
        header(hy);
        for (let i = 0; i < k; i++) fillLine(hy + lineH * 0.95 + i * lineH, i === k - 1);
        return actions(hy + lineH * 0.95 + (k - 1) * lineH + lineH * 1.05);
      };
      const gap = S * 0.9;
      let y = top - gap;
      while (y > -S * 2) { const k = R.int(1, 3); const h = blockH(k); y -= h; drawComment(y, k); y -= gap; }
      y = bottom + gap;
      while (y < H + S) { const k = R.int(1, 3); const e = drawComment(y, k); y += blockH(k) + e + gap; }
    },
  };

  /* 7. DAKTİLO */
  themes.typewriter = {
    label: 'Daktilo', hl: { style: 'circle', color: '#c62828' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size;
      paper(ctx, W, H, R.pick(['#f3eedf', '#ebe3cc', '#f6f2e6', '#e6dcc3', '#efe6d0']), R, 1.4);
      const fam = R.pick(FONTS.mono);
      const ink = R.pick(['#1b1a18', '#2a2724', '#1f2430', '#2b1d1a']);
      const wordFont = F(fam, S, 400);
      ctx.font = wordFont;
      const ww = ctx.measureText(word).width, wx = W / 2 - ww / 2;
      const x0 = R.chance(0.5) ? wx - R.range(1, 9) * S * 0.6 : -S * 2;
      textPage(ctx, W, H, R, {
        ...o, word, wordSize: S, wordFont, color: ink,
        bodyFont: F(fam, S), bodySize: S, lineH: S * R.range(1.45, 1.9), cols: [[x0, W + S * 2]],
        perChar: true, jit: S * 0.03, doubleStrike: R.chance(0.5), paraChance: 0.12,
      });
      // katlanma izi
      if (R.chance(0.5)) {
        const fy = R.range(0.15, 0.85) * H;
        if (Math.abs(fy - H / 2) > S) {
          const g = ctx.createLinearGradient(0, fy - S * 0.2, 0, fy + S * 0.2);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(80,60,30,0.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          ctx.fillStyle = g; ctx.fillRect(0, fy - S * 0.2, W, S * 0.4);
        }
      }
    },
  };

  /* 8. DERGİ HARFLERİ (fidye notu) */
  const TILE_COLORS = ['#ffffff', '#111111', '#e63946', '#f1c40f', '#2a9d8f', '#f4a261', '#fefae0', '#264653', '#ff70a6', '#90be6d', '#3a86ff', '#e9e3d5'];
  const isDarkColor = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000 < 140;
  };
  function tornRect(ctx, x, y, w, h, R, amp) {
    const step = Math.max(4, amp * 4);
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let i = step; i < w; i += step) ctx.lineTo(x + i, y + R.range(-1, 1) * amp);
    ctx.lineTo(x + w, y);
    for (let i = step; i < h; i += step) ctx.lineTo(x + w + R.range(-1, 1) * amp, y + i);
    ctx.lineTo(x + w, y + h);
    for (let i = w - step; i > 0; i -= step) ctx.lineTo(x + i, y + h + R.range(-1, 1) * amp);
    ctx.lineTo(x, y + h);
    for (let i = h - step; i > 0; i -= step) ctx.lineTo(x + R.range(-1, 1) * amp, y + i);
    ctx.closePath();
  }
  themes.magazine = {
    label: 'Dergi Harfleri', hl: { style: 'none', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const S = o.size, cx = W / 2, cy = H / 2;
      const bg = R.pick(['#141414', '#e8e2d4', '#1d1d1f', '#f2efe8', '#d9d2c3', '#2b2d42']);
      paper(ctx, W, H, bg, R, 1.2);
      const next = filler(R, o.lang);
      // arka plan kağıt parçaları
      for (let i = 0; i < 16; i++) {
        const w = S * R.range(3, 9), h = S * R.range(2, 6);
        ctx.save();
        ctx.translate(R() * W, R() * H); ctx.rotate(R.range(-0.4, 0.4));
        tornRect(ctx, -w / 2, -h / 2, w, h, R, S * 0.04);
        ctx.fillStyle = R.pick(TILE_COLORS); ctx.fill();
        ctx.clip();
        ctx.font = F(R.pick(FONTS.mag), S * 0.45); ctx.fillStyle = 'rgba(0,0,0,0.55)';
        for (let yy = -h / 2 + S * 0.5; yy < h / 2; yy += S * 0.55) ctx.fillText([next(), next(), next(), next(), next()].join(' '), -w / 2 + S * 0.15, yy);
        ctx.restore();
      }
      ctx.fillStyle = bg; ctx.globalAlpha = 0.72; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;

      // harf karoları
      const chars = [...word];
      const tiles = chars.map((ch) => {
        if (ch === ' ') return { space: true, w: S * 0.5 };
        const fam = R.pick(FONTS.mag);
        const size = S * R.range(1.0, 1.3);
        const up = R.chance(0.6);
        const t = up ? ch.toLocaleUpperCase(locale(o.lang)) : ch.toLocaleLowerCase(locale(o.lang));
        const font = F(fam, size, R.chance(0.5) ? 700 : 400);
        ctx.font = font;
        const cw = ctx.measureText(t).width;
        const color = R.pick(TILE_COLORS);
        return {
          t, font, size, color, text: isDarkColor(color) ? R.pick(['#ffffff', '#f1c40f', '#ff70a6']) : R.pick(['#111111', '#e63946', '#264653']),
          w: cw + S * R.range(0.25, 0.45), h: size * R.range(1.05, 1.3), rot: R.range(-0.14, 0.14), dy: R.range(-0.12, 0.12) * S,
        };
      });
      const gap = S * 0.06;
      const total = tiles.reduce((a, t) => a + t.w, 0) + gap * (tiles.length - 1);
      let x = cx - total / 2;
      tiles.forEach((t) => {
        if (t.space) { x += t.w + gap; return; }
        ctx.save();
        ctx.translate(x + t.w / 2, cy + t.dy); ctx.rotate(t.rot);
        ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = S * 0.15; ctx.shadowOffsetX = S * 0.04; ctx.shadowOffsetY = S * 0.06;
        tornRect(ctx, -t.w / 2, -t.h / 2, t.w, t.h, R, S * 0.025);
        ctx.fillStyle = t.color; ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.font = t.font; ctx.fillStyle = t.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(t.t, 0, t.size * 0.04);
        ctx.restore();
        x += t.w + gap;
      });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    },
  };

  /* 9. WORD STAMP (zlabz.io: Styled words stamp onto grid paper, beat by beat) */
  const STAMP_PALETTES = {
    light: [
      { text: '#16191d', border: '#16191d', shadow: 'rgba(20,24,28,0.2)' },
      { text: '#ea580c', border: '#ea580c', shadow: 'rgba(234,88,12,0.22)' }, // warm orange (like 'on')
      { text: '#059669', border: '#059669', shadow: 'rgba(5,150,105,0.22)' }, // emerald green
      { text: '#1d4ed8', border: '#1d4ed8', shadow: 'rgba(29,78,216,0.22)' }, // royal blue
      { text: '#e11d48', border: '#e11d48', shadow: 'rgba(225,29,72,0.22)' }, // rose red
      { text: '#6d28d9', border: '#6d28d9', shadow: 'rgba(109,40,217,0.22)' }, // deep violet
    ],
    dark: [
      { text: '#ffffff', border: '#ffffff', shadow: 'rgba(0,0,0,0.6)' },
      { text: '#c8ff3d', border: '#c8ff3d', shadow: 'rgba(200,255,61,0.3)' }, // volt
      { text: '#fb923c', border: '#fb923c', shadow: 'rgba(251,146,60,0.3)' }, // orange
      { text: '#38bdf8', border: '#38bdf8', shadow: 'rgba(56,189,248,0.3)' }, // sky
      { text: '#4ade80', border: '#4ade80', shadow: 'rgba(74,222,128,0.3)' }, // lime
      { text: '#f472b6', border: '#f472b6', shadow: 'rgba(244,114,182,0.3)' }, // pink
    ],
  };

  const STAMP_STYLES = [
    { fam: 'Bebas Neue', weight: 400, scale: 1.25, upper: true, rot: -0.04 },
    { fam: 'Permanent Marker', weight: 400, scale: 1.05, upper: false, rot: 0.12 },
    { fam: 'Playfair Display', weight: 700, style: 'italic', scale: 1.0, upper: false, rot: -0.14 },
    { fam: 'Lobster', weight: 400, scale: 1.05, upper: false, rot: 0.08 },
    { fam: 'Anton', weight: 400, scale: 1.15, upper: true, rot: 0.03 },
    { fam: 'Archivo Black', weight: 400, scale: 1.08, upper: true, rot: -0.06 },
    { fam: 'Special Elite', weight: 400, scale: 1.0, upper: false, rot: -0.08 },
    { fam: 'Bricolage Grotesque', weight: 800, scale: 1.12, upper: true, rot: 0.05 },
  ];

  function drawGridPaper(ctx, W, H, dark, R) {
    const bg = dark ? '#0f1418' : '#f9f6ed';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    const cellSize = Math.max(30, Math.min(W, H) * 0.038);
    const lineMajor = dark ? 'rgba(200, 255, 61, 0.14)' : 'rgba(70, 110, 140, 0.22)';
    const lineMinor = dark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(70, 110, 140, 0.09)';

    ctx.lineWidth = 1;
    let col = 0;
    for (let x = 0; x <= W; x += cellSize, col++) {
      ctx.strokeStyle = col % 5 === 0 ? lineMajor : lineMinor;
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, H);
      ctx.stroke();
    }
    let row = 0;
    for (let y = 0; y <= H; y += cellSize, row++) {
      ctx.strokeStyle = row % 5 === 0 ? lineMajor : lineMinor;
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(W, y + 0.5);
      ctx.stroke();
    }
    ctx.restore();

    grain(ctx, W, H, R, dark ? 0.07 : 0.05);

    const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, dark ? 'rgba(0,0,0,0.5)' : 'rgba(90, 70, 40, 0.12)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  themes.wordstamp = {
    label: 'Word Stamp', hl: { style: 'none', color: '#ffe14d' },
    draw(ctx, W, H, word, R, o) {
      const dark = o.mode ? (o.mode === 'dark') : false;
      const S = o.size || Math.min(W, H) * 0.088;
      const rawWords = Array.isArray(o.words) && o.words.length ? o.words : [word];
      const curWi = typeof o.wi === 'number' ? Math.max(0, Math.min(rawWords.length - 1, o.wi)) : 0;
      const nextWi = (curWi + 1) % rawWords.length;
      const u = typeof o.u === 'number' ? Math.max(0, Math.min(1, o.u)) : 0.05;

      const userColors = Array.isArray(o.stampColors) && o.stampColors.length > 0 ? o.stampColors : null;
      const defaultPalettes = dark ? STAMP_PALETTES.dark : STAMP_PALETTES.light;
      const styles = STAMP_STYLES;

      const positions = rawWords.map((wrd, i) => {
        const sSeed = hash(1001, 'ws_layout', i, wrd);
        const sR = rng(sSeed);
        const style = styles[Math.abs(sSeed) % styles.length];

        let pal;
        if (userColors) {
          const c = userColors[i % userColors.length];
          pal = {
            text: c,
            border: c,
            shadow: dark ? 'rgba(0,0,0,0.65)' : 'rgba(20,24,28,0.22)',
          };
        } else {
          pal = defaultPalettes[Math.abs(sSeed * 5 + 2) % defaultPalettes.length];
        }

        const side = (i % 2 === 1) ? 1 : -1;
        const x = i === 0 ? 0 : side * (S * sR.range(1.5, 2.5)) + (sR.range(-0.25, 0.25) * S);
        const y = i * (S * 2.2) + (sR.range(-0.15, 0.15) * S);
        const rot = (style.rot || 0) + sR.range(-0.04, 0.04);
        return { x, y, rot, style, pal, sSeed };
      });

      const targetA = positions[curWi];
      const targetB = positions[nextWi];

      let camX, camY, camRot;
      const glideStart = 0.38;
      if (u < glideStart || rawWords.length === 1) {
        camX = targetA.x;
        camY = targetA.y;
        camRot = targetA.rot * 0.35;
      } else {
        const progress = (u - glideStart) / (1 - glideStart);
        const ease = progress * progress * (3 - 2 * progress);
        camX = targetA.x + (targetB.x - targetA.x) * ease;
        camY = targetA.y + (targetB.y - targetA.y) * ease;
        camRot = (targetA.rot + (targetB.rot - targetA.rot) * ease) * 0.35;
      }

      const pitch = 0.40;
      const stampBounce = Math.max(0, 1 - u * 5.5);
      const camZoom = 1.0 + stampBounce * 0.05;

      const project = (wx, wy, wz = 0) => {
        const dx = wx - camX;
        const dy = wy - camY;
        const cosR = Math.cos(-camRot);
        const sinR = Math.sin(-camRot);
        const rx = dx * cosR - dy * sinR;
        const ry = dx * sinR + dy * cosR;

        const cosP = Math.cos(pitch);
        const sinP = Math.sin(pitch);
        const y3d = ry * cosP;
        const z3d = wz + ry * sinP;

        const focal = Math.max(W, H) * 1.15;
        const depth = focal + z3d;
        if (depth < 20) return null;

        const scale = (focal / depth) * camZoom;
        return {
          screenX: W / 2 + rx * scale,
          screenY: H / 2 + y3d * scale,
          scale,
        };
      };

      const bg = dark ? '#0d1216' : '#f9f6ed';
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      const cellSize = Math.max(30, S * 0.44);
      const lineMajor = dark ? 'rgba(200, 255, 61, 0.16)' : 'rgba(70, 110, 140, 0.24)';
      const lineMinor = dark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(70, 110, 140, 0.09)';

      const gridSpan = Math.max(W, H) * 2.2;
      const startX = Math.floor((camX - gridSpan) / cellSize) * cellSize;
      const endX = Math.ceil((camX + gridSpan) / cellSize) * cellSize;
      const startY = Math.floor((camY - gridSpan) / cellSize) * cellSize;
      const endY = Math.ceil((camY + gridSpan) / cellSize) * cellSize;

      ctx.lineWidth = 1;
      let colIdx = Math.round(startX / cellSize);
      for (let gx = startX; gx <= endX; gx += cellSize, colIdx++) {
        const p1 = project(gx, startY, 0);
        const p2 = project(gx, endY, 0);
        if (p1 && p2) {
          ctx.strokeStyle = (colIdx % 5 === 0) ? lineMajor : lineMinor;
          ctx.beginPath();
          ctx.moveTo(p1.screenX, p1.screenY);
          ctx.lineTo(p2.screenX, p2.screenY);
          ctx.stroke();
        }
      }
      let rowIdx = Math.round(startY / cellSize);
      for (let gy = startY; gy <= endY; gy += cellSize, rowIdx++) {
        const p1 = project(startX, gy, 0);
        const p2 = project(endX, gy, 0);
        if (p1 && p2) {
          ctx.strokeStyle = (rowIdx % 5 === 0) ? lineMajor : lineMinor;
          ctx.beginPath();
          ctx.moveTo(p1.screenX, p1.screenY);
          ctx.lineTo(p2.screenX, p2.screenY);
          ctx.stroke();
        }
      }
      ctx.restore();

      grain(ctx, W, H, R, dark ? 0.06 : 0.04);

      const minVisibleWi = Math.max(0, curWi - 5);
      for (let i = minVisibleWi; i <= curWi; i++) {
        const wrd = rawWords[i];
        const p = positions[i];
        const isCur = (i === curWi);

        let stampZ = 0;
        let stampScale = 1.0;
        let alpha = 1.0;
        if (isCur) {
          const hit = Math.max(0, 1 - u * 5);
          stampZ = hit * (S * 0.85);
          stampScale = 1.0 + hit * 0.22;
          alpha = Math.min(1, u * 8);
        }

        const proj = project(p.x, p.y, stampZ);
        if (!proj) continue;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(proj.screenX, proj.screenY);
        ctx.rotate(p.rot - camRot);
        ctx.scale(proj.scale * stampScale, proj.scale * stampScale * Math.cos(pitch));

        const fontSize = S * (isCur ? 1.35 : 1.05) * p.style.scale;
        const font = F(p.style.fam, fontSize, p.style.weight, p.style.style || 'normal');
        ctx.font = font;

        const displayText = p.style.upper ? wrd.toLocaleUpperCase(locale(o.lang)) : wrd;
        const tw = ctx.measureText(displayText).width;

        const shadowBlur = (fontSize * 0.1) + (stampZ * 0.14);
        const shadowOff = (fontSize * 0.05) + (stampZ * 0.08);
        ctx.shadowColor = p.pal.shadow;
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetY = shadowOff;

        if (isCur && o.hl && o.hl !== 'none') {
          highlight(ctx, -tw / 2, fontSize * 0.35, tw, fontSize, o.hl, o.hlColor, R, dark);
        }

        const hasFrame = (p.sSeed % 3 === 0);
        if (hasFrame) {
          const padX = fontSize * 0.35, padY = fontSize * 0.18;
          ctx.strokeStyle = p.pal.border;
          ctx.lineWidth = Math.max(2, fontSize * 0.045);
          rr(ctx, -tw / 2 - padX, -fontSize * 0.72 - padY, tw + padX * 2, fontSize * 0.9 + padY * 2, fontSize * 0.2);
          ctx.stroke();
        }

        ctx.font = font;
        ctx.fillStyle = p.pal.text;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(displayText, 0, fontSize * 0.3);

        ctx.restore();
      }

      const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.28, W / 2, H / 2, Math.max(W, H) * 0.78);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, dark ? 'rgba(0,0,0,0.65)' : 'rgba(70, 50, 30, 0.16)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    },
  };

  global.MC = { rng, hash, themes, getNoise, F, rr, grain, locale, families: ALL_FAMILIES, STAMP_PALETTES, STAMP_STYLES, order: ['newspaper', 'book', 'google', 'wiki', 'chat', 'comments', 'wordstamp', 'typewriter', 'magazine'] };
})(window);
