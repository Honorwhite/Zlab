/* ============================================================
   app.js — Oynatma döngüsü, arayüz, ses ve video dışa aktarma
   ============================================================ */
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const ASPECTS = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };
  const state = {
    words: [], theme: 'newspaper', aspect: '16:9',
    cutMs: 140, cuts: 6, zoom: 1,
    hl: 'auto', hlColor: '#ffe14d', lang: 'tr',
    focusBlur: true, blurRadius: 16,
    film: true, sound: true, upper: false,
    seed: Math.floor(Math.random() * 1e6), playing: true,
  };

  const canvas = $('#stage');
  const ctx = canvas.getContext('2d');
  let W = 1920, H = 1080;

  /* ---------- Kesim önbelleği ---------- */
  const cache = new Map();
  const resetCache = () => cache.clear();

  const display = (w) => (state.upper ? w.toLocaleUpperCase(state.lang === 'en' ? 'en' : 'tr') : w);

  function renderCut(themeKey, word, seed, w, h, zoom = state.zoom) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = MC.rng(seed);
    const th = MC.themes[themeKey];
    const hl = state.hl === 'auto' ? th.hl : { style: state.hl, color: state.hlColor };
    th.draw(g, w, h, word, R, { size: Math.min(w, h) * 0.085 * zoom, lang: state.lang, hl: hl.style, hlColor: hl.color });
    c._rot = R.range(-1, 1) * 1.1 * (Math.PI / 180);
    c._sc = R.range(1.04, 1.09);
    return c;
  }

  function getCut(wi, ci) {
    const key = wi + ':' + ci;
    let c = cache.get(key);
    if (c) return c;
    c = renderCut(state.theme, display(state.words[wi]), MC.hash(state.seed, state.theme, wi, ci, state.words[wi]), W, H);
    cache.set(key, c);
    const limit = Math.max(80, state.words.length * state.cuts + 8);
    while (cache.size > limit) cache.delete(cache.keys().next().value);
    return c;
  }

  /* ---------- Odaklanma / Kenar Bulanıklığı Katmanı ---------- */
  let blurMaskCanvas = null;
  function buildBlurMask() {
    blurMaskCanvas = document.createElement('canvas');
    blurMaskCanvas.width = W; blurMaskCanvas.height = H;
    const mctx = blurMaskCanvas.getContext('2d');
    
    // Merkez şeffaf (net olan kısım silinmeyecek), kenarlar ise opak siyah (bulanık katmanın görüneceği yer)
    const cx = W / 2, cy = H / 2;
    const rx = W * 0.28, ry = H * 0.22;
    
    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, W, H);
    
    mctx.globalCompositeOperation = 'destination-out';
    const grad = mctx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.45, cx, cy, Math.max(rx, ry) * 1.35);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.4, 'rgba(0,0,0,0.95)');
    grad.addColorStop(0.75, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    
    mctx.fillStyle = grad;
    mctx.beginPath();
    mctx.arc(cx, cy, Math.max(rx, ry) * 1.4, 0, Math.PI * 2);
    mctx.fill();
  }

  // Bulanık katmanı çizmek için yardımcı önbellek canvas'ı
  let blurLayerCanvas = null;
  function initBlurLayer() {
    blurLayerCanvas = document.createElement('canvas');
    blurLayerCanvas.width = W; blurLayerCanvas.height = H;
  }

  /* ---------- Film katmanı ---------- */
  let vignette = null;
  function buildVignette() {
    vignette = document.createElement('canvas');
    vignette.width = W; vignette.height = H;
    const g = vignette.getContext('2d');
    const r = Math.hypot(W, H) / 2;
    const grad = g.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
  }
  function filmOverlay() {
    ctx.drawImage(vignette, 0, 0);
    ctx.save();
    ctx.globalAlpha = 0.09;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(MC.getNoise(), 'repeat');
    ctx.translate(-Math.random() * 256, -Math.random() * 256);
    ctx.fillRect(0, 0, W + 256, H + 256);
    ctx.restore();
  }

  /* ---------- Ses (kesim tıkı) ---------- */
  let actx = null, adest = null, clickBuf = null;
  function ensureAudio() {
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)();
      adest = actx.createMediaStreamDestination();
      const len = Math.floor(actx.sampleRate * 0.045);
      clickBuf = actx.createBuffer(1, len, actx.sampleRate);
      const d = clickBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
    }
    if (actx.state === 'suspended') actx.resume();
  }
  function click() {
    if (!state.sound || !actx || actx.state !== 'running') return;
    const src = actx.createBufferSource();
    src.buffer = clickBuf;
    const f = actx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1600 + Math.random() * 1400; f.Q.value = 0.8;
    const g = actx.createGain(); g.gain.value = 0.55;
    src.connect(f).connect(g);
    g.connect(actx.destination); g.connect(adest);
    src.start();
  }
  window.addEventListener('pointerdown', ensureAudio, { once: true });
  window.addEventListener('keydown', ensureAudio, { once: true });

  /* ---------- Zaman çizelgesi ---------- */
  let t0 = performance.now(), pausedAt = 0, lastIdx = -1, curT = 0;
  const total = () => state.words.length * state.cuts * state.cutMs;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready) return;
    const T = total();
    let t = state.playing ? now - t0 : pausedAt;
    if (recorder && t >= T) { stopRecording(); t = T - 1; }
    if (stopping) t = T - 1;
    t = ((t % T) + T) % T;
    curT = t;
    render(t);
  }

  function render(t) {
    const idx = Math.floor(t / state.cutMs);
    const wi = Math.floor(idx / state.cuts) % state.words.length;
    const ci = idx % state.cuts;
    const local = (t % state.cutMs) / state.cutMs;
    if (idx !== lastIdx) {
      lastIdx = idx;
      if (state.playing) click();
      $$('.chip').forEach((c, i) => c.classList.toggle('on', i === wi));
    }
    const c = getCut(wi, ci);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.rotate(c._rot);
    const s = c._sc * (1 + 0.025 * local);
    ctx.scale(s, s);
    ctx.drawImage(c, -W / 2, -H / 2);
    ctx.restore();

    // Kenarları bulanıklaştırıp merkezdeki kelimeyi net tutan odak efekti
    if (state.focusBlur && state.blurRadius > 0 && blurMaskCanvas) {
      if (!blurLayerCanvas) initBlurLayer();
      const bctx = blurLayerCanvas.getContext('2d');
      bctx.clearRect(0, 0, W, H);
      
      // Bulanık katmanı çiz
      bctx.save();
      bctx.filter = `blur(${state.blurRadius}px)`;
      bctx.drawImage(canvas, 0, 0);
      bctx.restore();

      // Maskeyi uygula (merkez şeffaf, kenarlar kalır)
      bctx.save();
      bctx.globalCompositeOperation = 'destination-in';
      bctx.drawImage(blurMaskCanvas, 0, 0);
      bctx.restore();

      // Bulanık kenar katmanını ana tuvalin üzerine yerleştir
      ctx.drawImage(blurLayerCanvas, 0, 0);
    }

    if (state.film) filmOverlay();

    const T = total();
    $('#bar').style.width = (t / T) * 100 + '%';
    $('#timeLabel').textContent = `${(t / 1000).toFixed(1)} / ${(T / 1000).toFixed(1)}s`;
  }

  function setPlaying(p) {
    const now = performance.now();
    if (p && !state.playing) t0 = now - pausedAt;
    if (!p && state.playing) pausedAt = now - t0;
    state.playing = p;
    $('#playBtn').classList.toggle('paused', !p);
  }
  function seekTo(t) {
    pausedAt = t; t0 = performance.now() - t; lastIdx = -1;
  }

  /* ---------- Boyut / format ---------- */
  function applyAspect() {
    [W, H] = ASPECTS[state.aspect];
    canvas.width = W; canvas.height = H;
    $('#resLabel').textContent = `${W}×${H}`;
    buildVignette();
    buildBlurMask();
    initBlurLayer();
    resetCache();
  }

  /* ---------- Kelimeler ---------- */
  function parseWords() {
    state.words = $('#words').value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!state.words.length) state.words = ['match cut'];
    $('#chips').innerHTML = state.words.map((w) => `<span class="chip">${escapeHtml(display(w))}</span>`).join('');
    $('#ticks').innerHTML = state.words.map((w) => `<div>${escapeHtml(display(w))}</div>`).join('');
    lastIdx = -1;
    resetCache();
  }
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  /* ---------- Tema kartları ---------- */
  function buildThemeGrid() {
    const grid = $('#themeGrid');
    grid.innerHTML = '';
    MC.order.forEach((key) => {
      const b = document.createElement('button');
      b.className = 'theme-card' + (key === state.theme ? ' on' : '');
      b.id = 'theme-' + key;
      b.setAttribute('role', 'radio');
      b.dataset.key = key;
      b.innerHTML = `<span>${MC.themes[key].label}</span>`;
      b.addEventListener('click', () => selectTheme(key));
      grid.appendChild(b);
    });
    drawThumbs();
  }
  function drawThumbs() {
    const sample = state.lang === 'en' ? 'Memory' : 'Zaman';
    $$('.theme-card').forEach((b) => {
      const old = b.querySelector('canvas'); if (old) old.remove();
      const c = renderCut(b.dataset.key, display(sample), MC.hash('thumb', b.dataset.key, state.seed), 480, 300, 1.25);
      b.prepend(c);
    });
  }
  function selectTheme(key) {
    state.theme = key;
    $$('.theme-card').forEach((b) => {
      b.classList.toggle('on', b.dataset.key === key);
      b.setAttribute('aria-checked', b.dataset.key === key);
    });
    $('#themeName').textContent = MC.themes[key].label;
    resetCache();
  }

  /* ---------- Kontroller ---------- */
  function rangeFill(el) {
    const p = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty('--p', p + '%');
  }
  function bindRange(id, fmt, apply) {
    const el = $('#' + id);
    const upd = () => { rangeFill(el); $('#' + id + 'Val').textContent = fmt(+el.value); apply(+el.value); };
    el.addEventListener('input', upd);
    upd();
  }
  function bindSeg(id, apply) {
    $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
      $$(`#${id} button`).forEach((x) => x.classList.toggle('on', x === b));
      apply(b.dataset.v);
    }));
  }

  function bindUI() {
    let deb;
    $('#words').addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(parseWords, 220); });

    bindRange('cutMs', (v) => v + ' ms', (v) => {
      const frac = curT / total();
      state.cutMs = v; lastIdx = -1;
      if (ready) seekTo(frac * total());
    });
    bindRange('cuts', (v) => String(v), (v) => { state.cuts = v; lastIdx = -1; resetCache(); });
    bindRange('zoom', (v) => v + '%', (v) => { state.zoom = v / 100; resetCache(); });

    bindSeg('aspectSeg', (v) => { state.aspect = v; applyAspect(); });
    bindSeg('langSeg', (v) => { state.lang = v; resetCache(); drawThumbs(); });

    $('#hl').addEventListener('change', (e) => {
      state.hl = e.target.value;
      $('#swatches').classList.toggle('disabled', state.hl === 'auto' || state.hl === 'none');
      resetCache(); drawThumbs();
    });
    $('#swatches').classList.add('disabled');
    $$('#swatches button').forEach((b) => b.addEventListener('click', () => {
      $$('#swatches button').forEach((x) => x.classList.toggle('on', x === b));
      state.hlColor = b.dataset.c; $('#hlColor').value = b.dataset.c;
      resetCache(); drawThumbs();
    }));
    $('#hlColor').addEventListener('input', (e) => {
      $$('#swatches button').forEach((x) => x.classList.remove('on'));
      state.hlColor = e.target.value; resetCache();
    });

    $('#focusBlur').addEventListener('change', (e) => {
      state.focusBlur = e.target.checked;
      $('#blurRadiusWrap').style.display = state.focusBlur ? 'block' : 'none';
    });
    bindRange('blurRadius', (v) => v + 'px', (v) => {
      state.blurRadius = v;
    });

    $('#film').addEventListener('change', (e) => (state.film = e.target.checked));
    $('#sound').addEventListener('change', (e) => { state.sound = e.target.checked; if (state.sound) ensureAudio(); });
    $('#upper').addEventListener('change', (e) => { state.upper = e.target.checked; parseWords(); drawThumbs(); });

    $('#shuffleBtn').addEventListener('click', shuffle);
    $('#playBtn').addEventListener('click', () => setPlaying(!state.playing));
    $('#timeline').addEventListener('click', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      seekTo(((e.clientX - r.left) / r.width) * total());
    });
    $('#exportBtn').addEventListener('click', startRecording);

    window.addEventListener('keydown', (e) => {
      if (e.target.matches('textarea, input, select')) return;
      if (e.code === 'Space') { e.preventDefault(); setPlaying(!state.playing); }
      if (e.key === 'r' || e.key === 'R') shuffle();
    });
  }
  function shuffle() {
    state.seed = Math.floor(Math.random() * 1e6);
    resetCache(); drawThumbs();
  }

  /* ---------- Video dışa aktarma (MediaRecorder) ---------- */
  let recorder = null, chunks = [], mime = '', stopping = false;
  function pickMime() {
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4'];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }
  async function startRecording() {
    if (recorder) return;
    if (!window.MediaRecorder || !canvas.captureStream) { alert('Bu tarayıcı video kaydını desteklemiyor. Chrome veya Edge deneyin.'); return; }
    ensureAudio();
    const btn = $('#exportBtn');
    btn.disabled = true; btn.querySelector('span').textContent = 'Hazırlanıyor…';
    // Takılma olmaması için tüm kesimleri önceden çiz
    for (let wi = 0; wi < state.words.length; wi++) {
      for (let ci = 0; ci < state.cuts; ci++) getCut(wi, ci);
      await new Promise((r) => setTimeout(r, 0));
    }
    const stream = canvas.captureStream(60);
    if (state.sound && adest) adest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    mime = pickMime();
    recorder = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 16_000_000 });
    chunks = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const rec = recorder;
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/webm';
      const blob = new Blob(chunks, { type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `matchcut-${state.theme}-${Date.now()}.${type.includes('mp4') ? 'mp4' : 'webm'}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      recorder = null; stopping = false;
      $('#recOverlay').hidden = true;
      btn.disabled = false; btn.querySelector('span').textContent = 'Videoyu indir';
    };
    setPlaying(true);
    seekTo(0);
    recorder.start(250);
    $('#recOverlay').hidden = false;
    btn.querySelector('span').textContent = 'Kaydediliyor…';
  }
  function stopRecording() {
    if (!recorder || stopping) return;
    stopping = true;
    const r = recorder;
    // son karenin yakalanması için çok kısa bekle
    setTimeout(() => r.state !== 'inactive' && r.stop(), 80);
  }

  /* ---------- Başlat ---------- */
  let ready = false;
  async function loadFonts() {
    const sample = 'AaBbŞşĞğİıÖöÜüÇç';
    const jobs = [];
    MC.families.concat(['Inter', 'Roboto', 'Open Sans']).forEach((f) => {
      jobs.push(document.fonts.load(`400 40px "${f}"`, sample));
      jobs.push(document.fonts.load(`700 40px "${f}"`, sample));
    });
    ['EB Garamond', 'Libre Baskerville', 'Crimson Text', 'Lora'].forEach((f) => jobs.push(document.fonts.load(`italic 400 40px "${f}"`, sample)));
    await Promise.race([Promise.allSettled(jobs), new Promise((r) => setTimeout(r, 6000))]);
  }

  async function init() {
    bindUI();
    applyAspect();
    parseWords();
    buildThemeGrid();
    requestAnimationFrame(frame);
    await loadFonts();
    resetCache();
    drawThumbs();
    ready = true;
    t0 = performance.now();
    $('#loader').classList.add('hide');
  }
  init();
})();
