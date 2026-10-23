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
    try {
      if (!actx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        actx = new AudioContextClass();
        adest = actx.createMediaStreamDestination();
        const len = Math.floor(actx.sampleRate * 0.045);
        clickBuf = actx.createBuffer(1, len, actx.sampleRate);
        const d = clickBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
      }
      if (actx && actx.state === 'suspended') {
        actx.resume().catch(() => {});
      }
    } catch (e) {
      // AudioContext autoplay kısıtlaması nedeniyle kullanıcı etkileşimi bekleniyor olabilir
    }
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
  let isExporting = false;
  const total = () => state.words.length * state.cuts * state.cutMs;

  function frame(now) {
    requestAnimationFrame(frame);
    if (!ready || isExporting) return;
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

    $('#shuffleBtn').addEventListener('click', () => { if (!isExporting) shuffle(); });
    $('#playBtn').addEventListener('click', () => { if (!isExporting) setPlaying(!state.playing); });
    $('#timeline').addEventListener('click', (e) => {
      if (isExporting) return;
      const r = e.currentTarget.getBoundingClientRect();
      seekTo(((e.clientX - r.left) / r.width) * total());
    });
    $('#exportBtn').addEventListener('click', startExport);

    window.addEventListener('keydown', (e) => {
      if (e.target.matches('textarea, input, select')) return;
      if (e.code === 'Space') { e.preventDefault(); if (!isExporting) setPlaying(!state.playing); }
      if (e.key === 'r' || e.key === 'R') { if (!isExporting) shuffle(); }
    });
  }
  function shuffle() {
    state.seed = Math.floor(Math.random() * 1e6);
    resetCache(); drawThumbs();
  }

  /* ---------- Video dışa aktarma (WebCodecs MP4 & MediaRecorder Fallback) ---------- */
  let recorder = null, chunks = [], stopping = false;

  function setRecStatus(visible, text) {
    const overlay = $('#recOverlay');
    if (overlay) {
      overlay.hidden = !visible;
      const recText = $('#recText') || overlay.querySelector('.mono');
      if (recText && text) recText.textContent = text;
    }
  }

  async function findSupportedVideoConfig(width, height) {
    if (typeof VideoEncoder === 'undefined') return null;
    const fpsCandidates = [60, 30];
    const codecCandidates = [
      'avc1.4d002a', // Main Profile Level 4.2 (1080p60)
      'avc1.64002a', // High Profile Level 4.2
      'avc1.42002a', // Baseline Profile Level 4.2
      'avc1.640028', // High Profile Level 4.0
      'avc1.4d001f', // Main Profile Level 3.1
      'avc1.42001f'  // Baseline Profile Level 3.1
    ];

    for (const fps of fpsCandidates) {
      for (const codec of codecCandidates) {
        try {
          const cfg = {
            codec,
            width,
            height,
            bitrate: fps === 60 ? 14_000_000 : 8_000_000,
            framerate: fps
          };
          if (typeof VideoEncoder.isConfigSupported === 'function') {
            const res = await VideoEncoder.isConfigSupported(cfg);
            if (res && res.supported) return cfg;
          } else {
            return cfg;
          }
        } catch (e) {}
      }
    }
    return null;
  }

  async function findSupportedAudioConfig() {
    if (typeof AudioEncoder === 'undefined') return null;
    const codecs = ['mp4a.40.2', 'mp4a.40.02', 'mp4a.40.5'];
    for (const codec of codecs) {
      try {
        const cfg = {
          codec,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitrate: 128_000
        };
        if (typeof AudioEncoder.isConfigSupported === 'function') {
          const res = await AudioEncoder.isConfigSupported(cfg);
          if (res && res.supported) return cfg;
        } else {
          return cfg;
        }
      } catch (e) {}
    }
    return null;
  }

  async function generateClickAudio(totalMs, cutMs, totalCuts, sampleRate = 44100) {
    const durSec = totalMs / 1000;
    const totalSamples = Math.max(1, Math.ceil(durSec * sampleRate));
    const OfflineCtxClass = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OfflineCtxClass) return null;

    const offlineCtx = new OfflineCtxClass(2, totalSamples, sampleRate);
    const len = Math.floor(sampleRate * 0.045);

    for (let idx = 0; idx < totalCuts; idx++) {
      const startTime = (idx * cutMs) / 1000;
      if (startTime >= durSec) break;

      const clickBuf = offlineCtx.createBuffer(1, len, sampleRate);
      const d = clickBuf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 5);
      }

      const src = offlineCtx.createBufferSource();
      src.buffer = clickBuf;

      const f = offlineCtx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = 1600 + Math.random() * 1400;
      f.Q.value = 0.8;

      const g = offlineCtx.createGain();
      g.gain.value = 0.55;

      src.connect(f).connect(g);
      g.connect(offlineCtx.destination);
      src.start(startTime);
    }

    return await offlineCtx.startRendering();
  }

  function feedAudioUpTo(renderedAudio, audioEncoder, targetMicros, audioState) {
    if (!renderedAudio || !audioEncoder) return;
    const sampleRate = renderedAudio.sampleRate;
    const numChannels = renderedAudio.numberOfChannels;
    const totalAudioFrames = renderedAudio.length;
    const c0 = renderedAudio.getChannelData(0);
    const c1 = numChannels > 1 ? renderedAudio.getChannelData(1) : c0;
    const aChunkSize = 1024;

    while (audioState.offset < totalAudioFrames) {
      const currentMicros = Math.round((audioState.offset / sampleRate) * 1e6);
      if (targetMicros !== null && currentMicros > targetMicros) {
        break;
      }
      const framesInChunk = Math.min(aChunkSize, totalAudioFrames - audioState.offset);
      const paddedFrames = 1024;
      const planarData = new Float32Array(paddedFrames * numChannels);
      planarData.set(c0.subarray(audioState.offset, audioState.offset + framesInChunk), 0);
      planarData.set(c1.subarray(audioState.offset, audioState.offset + framesInChunk), paddedFrames);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate: sampleRate,
        numberOfFrames: paddedFrames,
        numberOfChannels: numChannels,
        timestamp: currentMicros,
        data: planarData
      });

      audioEncoder.encode(audioData);
      audioData.close();
      audioState.offset += framesInChunk;
    }
  }

  async function exportWithWebCodecs(MuxerLib) {
    const btn = $('#exportBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Hazırlanıyor…';
    setRecStatus(true, 'HAZIRLANIYOR');

    const width = W % 2 === 0 ? W : W - 1;
    const height = H % 2 === 0 ? H : H - 1;

    const videoConfig = await findSupportedVideoConfig(width, height);
    if (!videoConfig) {
      throw new Error('VideoEncoder için uyumlu profil bulunamadı.');
    }

    for (let wi = 0; wi < state.words.length; wi++) {
      for (let ci = 0; ci < state.cuts; ci++) getCut(wi, ci);
      await new Promise((r) => setTimeout(r, 0));
    }

    let audioConfig = null;
    let renderedAudio = null;
    const totalMs = total();
    const totalCuts = state.words.length * state.cuts;

    if (state.sound) {
      audioConfig = await findSupportedAudioConfig();
      if (audioConfig) {
        try {
          renderedAudio = await generateClickAudio(totalMs, state.cutMs, totalCuts, audioConfig.sampleRate);
        } catch (err) {
          console.warn('Ses grafiği oluşturulamadı, videosuz devam ediliyor:', err);
          renderedAudio = null;
          audioConfig = null;
        }
      }
    }

    const hasAudio = !!(audioConfig && renderedAudio);

    const muxer = new MuxerLib.Muxer({
      target: new MuxerLib.ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: width,
        height: height
      },
      audio: hasAudio ? {
        codec: 'aac',
        numberOfChannels: audioConfig.numberOfChannels,
        sampleRate: audioConfig.sampleRate
      } : undefined,
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    });

    let encoderError = null;
    const videoEncoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        console.error('VideoEncoder error:', e);
        encoderError = e;
      }
    });
    videoEncoder.configure(videoConfig);

    let audioEncoder = null;
    if (hasAudio) {
      audioEncoder = new AudioEncoder({
        output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
        error: (e) => {
          console.error('AudioEncoder error:', e);
          encoderError = e;
        }
      });
      audioEncoder.configure(audioConfig);
    }

    const fps = videoConfig.framerate || 60;
    const durSec = totalMs / 1000;
    const totalFrames = Math.max(1, Math.round(durSec * fps));
    const audioState = { offset: 0 };

    const wasPlaying = state.playing;
    setPlaying(false);
    isExporting = true;
    lastIdx = -1;

    try {
      for (let i = 0; i < totalFrames; i++) {
        if (encoderError) throw encoderError;

        const t = (i / totalFrames) * totalMs;
        render(t);

        const frameMicros = Math.round((i / fps) * 1e6);
        const frameDurationMicros = Math.round(1e6 / fps);
        const nextVideoMicros = Math.round(((i + 1) / fps) * 1e6);

        if (hasAudio) {
          feedAudioUpTo(renderedAudio, audioEncoder, nextVideoMicros, audioState);
        }

        const isKeyFrame = (i % (fps * 2) === 0);
        const videoFrame = new VideoFrame(canvas, {
          timestamp: frameMicros,
          duration: frameDurationMicros
        });
        videoEncoder.encode(videoFrame, { keyFrame: isKeyFrame });
        videoFrame.close();

        const pct = Math.round(((i + 1) / totalFrames) * 100);
        setRecStatus(true, `KAYDEDİLİYOR %${pct}`);
        btn.querySelector('span').textContent = `MP4 Aktarılıyor… %${pct}`;

        if (videoEncoder.encodeQueueSize > 5) {
          await new Promise((resolve) => {
            videoEncoder.ondequeue = () => {
              if (videoEncoder.encodeQueueSize <= 2) {
                videoEncoder.ondequeue = null;
                resolve();
              }
            };
          });
        }

        if (i % 6 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
      }

      if (hasAudio) {
        feedAudioUpTo(renderedAudio, audioEncoder, null, audioState);
      }

      btn.querySelector('span').textContent = 'Tamamlanıyor…';
      setRecStatus(true, 'TAMAMLANDI');

      await videoEncoder.flush();
      if (audioEncoder) {
        await audioEncoder.flush();
      }

      muxer.finalize();

      const { buffer } = muxer.target;
      const blob = new Blob([buffer], { type: 'video/mp4' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `matchcut-${state.theme}-${Date.now()}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } finally {
      isExporting = false;
      setRecStatus(false);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Videoyu indir';
      if (wasPlaying) setPlaying(true);
      seekTo(0);
    }
  }

  function pickMime() {
    const types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm'
    ];
    return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  }

  async function exportWithMediaRecorder() {
    if (!window.MediaRecorder || !canvas.captureStream) {
      alert('Bu tarayıcı video kaydını desteklemiyor. Chrome, Safari veya Edge deneyin.');
      return;
    }
    const btn = $('#exportBtn');
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Hazırlanıyor…';

    for (let wi = 0; wi < state.words.length; wi++) {
      for (let ci = 0; ci < state.cuts; ci++) getCut(wi, ci);
      await new Promise((r) => setTimeout(r, 0));
    }

    const stream = canvas.captureStream(60);
    if (state.sound && adest) {
      adest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }

    const mime = pickMime();
    recorder = new MediaRecorder(stream, {
      mimeType: mime || undefined,
      videoBitsPerSecond: 16_000_000
    });
    chunks = [];
    recorder.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const rec = recorder;
    rec.onstop = () => {
      const type = rec.mimeType || mime || 'video/mp4';
      const isMp4 = type.includes('mp4');
      const blob = new Blob(chunks, { type: isMp4 ? 'video/mp4' : type });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `matchcut-${state.theme}-${Date.now()}.${isMp4 ? 'mp4' : 'webm'}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      recorder = null;
      stopping = false;
      setRecStatus(false);
      btn.disabled = false;
      btn.querySelector('span').textContent = 'Videoyu indir';
    };

    setPlaying(true);
    seekTo(0);
    recorder.start(250);
    setRecStatus(true, 'KAYDEDİLİYOR');
    btn.querySelector('span').textContent = 'Kaydediliyor…';
  }

  function stopRecording() {
    if (!recorder || stopping) return;
    stopping = true;
    const r = recorder;
    setTimeout(() => r.state !== 'inactive' && r.stop(), 80);
  }

  async function startExport() {
    if (isExporting || recorder) return;
    ensureAudio();

    const MuxerLib = window.Mp4Muxer || (typeof Mp4Muxer !== 'undefined' ? Mp4Muxer : null);
    const canUseWebCodecs = typeof window.VideoEncoder !== 'undefined' &&
                            typeof window.VideoFrame !== 'undefined' &&
                            MuxerLib &&
                            typeof MuxerLib.Muxer === 'function';

    if (canUseWebCodecs) {
      try {
        await exportWithWebCodecs(MuxerLib);
        return;
      } catch (err) {
        console.warn('WebCodecs dışa aktarma başarısız oldu, MediaRecorder deneniyor:', err);
        isExporting = false;
        setRecStatus(false);
        $('#exportBtn').disabled = false;
        $('#exportBtn').querySelector('span').textContent = 'Videoyu indir';
      }
    }

    await exportWithMediaRecorder();
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
