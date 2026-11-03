// 左下角「星海电台」播放器
// 唱片旋转 + 环形频谱 + 浮游粒子，全部零依赖；
// 音频走 Web Audio 的 AnalyserNode，播放时才建图，避免无谓的自动播放请求。
(function () {
  var root = document.getElementById('player');
  if (!root) return;

  var audio = document.getElementById('player-audio');
  var disc = document.getElementById('player-disc');
  var art = document.getElementById('player-art');
  var toggle = document.getElementById('player-toggle');
  var prevBtn = document.getElementById('player-prev');
  var nextBtn = document.getElementById('player-next');
  var muteBtn = document.getElementById('player-mute');
  var volInput = document.getElementById('player-vol');
  var listBtn = document.getElementById('player-list-btn');
  var listPanel = document.getElementById('player-playlist');
  var foldBtn = document.getElementById('player-fold');
  var titleEl = document.getElementById('player-title');
  var artistEl = document.getElementById('player-artist');
  var curEl = document.getElementById('player-cur');
  var durEl = document.getElementById('player-dur');
  var fillEl = document.getElementById('player-fill');
  var knobEl = document.getElementById('player-knob');
  var timeline = document.getElementById('player-timeline');
  var ring = document.getElementById('player-ring');
  var items = Array.prototype.slice.call(root.querySelectorAll('.player-item'));

  if (!audio || !disc || !items.length) return;

  var VOL_KEY = 'player-volume';
  var IDX_KEY = 'player-track';
  var MINI_KEY = 'player-mini';
  var MUTE_KEY = 'player-muted';

  var idx = 0;
  var playing = false;
  var ctx = null;
  var analyser = null;
  var freq = null;
  var smooth = [];
  var rafId = 0;
  var dragging = false;
  var lastDraw = 0;

  // ---------- 工具 ----------
  function fmt(t) {
    if (!isFinite(t) || t < 0) t = 0;
    var m = Math.floor(t / 60);
    var s = Math.floor(t % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function setPlaying(v) {
    playing = v;
    root.classList.toggle('is-playing', v);
    toggle.setAttribute('aria-label', v ? '暂停' : '播放');
    disc.setAttribute('aria-label', v ? '暂停' : '播放');
    if (v) startLoop();
  }

  function applyTrack(i, keepTime) {
    i = (i + items.length) % items.length;
    idx = i;
    var it = items[i];
    titleEl.textContent = it.getAttribute('data-title') || '';
    artistEl.textContent = it.getAttribute('data-artist') || '';
    var c1 = it.getAttribute('data-c1') || '#4d6bfe';
    var c2 = it.getAttribute('data-c2') || '#17c6dd';
    art.style.setProperty('--p1', c1);
    art.style.setProperty('--p2', c2);
    root.style.setProperty('--p1', c1);
    root.style.setProperty('--p2', c2);

    items.forEach(function (el, n) {
      el.classList.toggle('is-active', n === i);
    });

    var src = it.getAttribute('data-src');
    if (audio.getAttribute('src') !== src) {
      audio.setAttribute('src', src);
      audio.load();
    }
    if (!keepTime) {
      fillEl.style.width = '0%';
      knobEl.style.left = '0%';
      curEl.textContent = '0:00';
      durEl.textContent = '--:--';
    }
    updateMediaSession(it);
    try { localStorage.setItem(IDX_KEY, String(i)); } catch (e) {}
  }

  function updateMediaSession(it) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: it.getAttribute('data-title') || '',
        artist: it.getAttribute('data-artist') || '',
        album: '星海电台'
      });
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', function () { skip(-1); });
      navigator.mediaSession.setActionHandler('nexttrack', function () { skip(1); });
    } catch (e) {}
  }

  // ---------- 音频 ----------
  function ensureGraph() {
    if (ctx) return;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      ctx = new AC();
      var src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.78;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      freq = new Uint8Array(analyser.frequencyBinCount);
      smooth = new Array(48).fill(0);
    } catch (e) {
      ctx = null;
      analyser = null;
    }
  }

  function play() {
    ensureGraph();
    if (ctx && ctx.state === 'suspended') ctx.resume();
    var p = audio.play();
    if (p && p.catch) {
      p.catch(function () {
        setPlaying(false);
        root.classList.add('is-blocked');
      });
    }
  }

  function pause() {
    audio.pause();
  }

  function skip(dir) {
    var was = playing;
    applyTrack(idx + dir, false);
    if (was) play();
  }

  function restoreVolume() {
    var v = parseFloat(root.getAttribute('data-volume')) || 0.4;
    try {
      var saved = parseFloat(localStorage.getItem(VOL_KEY));
      if (isFinite(saved)) v = saved;
    } catch (e) {}
    v = Math.max(0, Math.min(1, v));
    audio.volume = v;
    volInput.value = v;
    paintRange(v);
    try {
      if (localStorage.getItem(MUTE_KEY) === '1') audio.muted = true;
    } catch (e) {}
    root.classList.toggle('is-muted', audio.muted);
  }

  function paintRange(v) {
    volInput.style.setProperty('--vol', (v * 100) + '%');
  }

  // ---------- 进度 ----------
  function paintProgress() {
    var d = audio.duration;
    var t = audio.currentTime;
    var pct = d > 0 ? Math.min(100, (t / d) * 100) : 0;
    fillEl.style.width = pct + '%';
    knobEl.style.left = pct + '%';
    if (!dragging) {
      curEl.textContent = fmt(t);
      timeline.setAttribute('aria-valuenow', Math.round(pct));
    }
  }

  function seekFromEvent(e) {
    var r = timeline.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
    var pct = Math.max(0, Math.min(1, x / r.width));
    if (audio.duration) {
      audio.currentTime = pct * audio.duration;
      fillEl.style.width = pct * 100 + '%';
      knobEl.style.left = pct * 100 + '%';
      curEl.textContent = fmt(audio.currentTime);
    }
  }

  // ---------- 频谱 ----------
  function sizeRing() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var box = ring.getBoundingClientRect();
    var size = Math.max(80, box.width || 168);
    ring.width = Math.round(size * dpr);
    ring.height = Math.round(size * dpr);
    return { w: ring.width, h: ring.height, dpr: dpr };
  }

  function drawRing(ts) {
    if (!ring) return;
    var w = ring.width;
    var h = ring.height;
    if (!w || !h) { var s = sizeRing(); w = s.w; h = s.h; }
    var c = ring.getContext('2d');
    if (!c) return;
    c.clearRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h / 2;
    var unit = w / 148; // 设计稿 148px
    var r0 = 52 * unit;
    var bars = 48;

    var cs = getComputedStyle(root);
    var c1 = cs.getPropertyValue('--p1').trim() || '#4d6bfe';
    var c2 = cs.getPropertyValue('--p2').trim() || '#17c6dd';
    var grad = c.createLinearGradient(cx - r0, cy - r0, cx + r0, cy + r0);
    grad.addColorStop(0, c1);
    grad.addColorStop(0.55, c2);
    grad.addColorStop(1, c1);

    if (analyser && playing) {
      analyser.getByteFrequencyData(freq);
    }

    c.lineCap = 'round';
    for (var i = 0; i < bars; i++) {
      var v;
      if (playing && analyser) {
        // 低频给更多权重，视觉上更"跳"
        var bin = Math.floor(Math.pow(i / bars, 1.35) * 96) + 2;
        v = (freq[bin] || 0) / 255;
      } else {
        v = 0.12 + 0.1 * Math.sin(ts / 900 + i * 0.42);
      }
      smooth[i] += (v - smooth[i]) * 0.28;
      var ang = (i / bars) * Math.PI * 2 - Math.PI / 2;
      var len = (2.5 + smooth[i] * 26) * unit;
      var x1 = cx + Math.cos(ang) * r0;
      var y1 = cy + Math.sin(ang) * r0;
      var x2 = cx + Math.cos(ang) * (r0 + len);
      var y2 = cy + Math.sin(ang) * (r0 + len);
      c.globalAlpha = playing ? 0.45 + smooth[i] * 0.55 : 0.28;
      c.strokeStyle = grad;
      c.lineWidth = 2.1 * unit;
      c.beginPath();
      c.moveTo(x1, y1);
      c.lineTo(x2, y2);
      c.stroke();
    }
    c.globalAlpha = 1;
  }

  function loop(ts) {
    rafId = requestAnimationFrame(loop);
    if (document.hidden) return;
    // 30fps 足够，省电
    if (ts - lastDraw < 33) return;
    lastDraw = ts;
    drawRing(ts);
    if (playing) paintProgress();
  }

  function startLoop() {
    if (!rafId) rafId = requestAnimationFrame(loop);
  }
  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  // ---------- 事件 ----------
  disc.addEventListener('click', function () {
    playing ? pause() : play();
  });
  toggle.addEventListener('click', function () {
    playing ? pause() : play();
  });
  prevBtn.addEventListener('click', function () { skip(-1); });
  nextBtn.addEventListener('click', function () { skip(1); });

  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });
  audio.addEventListener('ended', function () { skip(1); });

  // 缓冲态：真实曲目码率更高，网络慢时点击后要等一会儿才出声。
  // 用转圈提示"正在取流"，避免用户以为按钮坏了。
  var bufferTimer = null;
  function setBuffering(v) {
    root.classList.toggle('is-buffering', v);
    if (v) {
      if (bufferTimer) clearTimeout(bufferTimer);
      // 兜底：超过 12 秒还没起来就撤掉转圈，靠 is-error 提示
      bufferTimer = setTimeout(function () { root.classList.remove('is-buffering'); }, 12000);
    } else if (bufferTimer) {
      clearTimeout(bufferTimer);
      bufferTimer = null;
    }
  }
  audio.addEventListener('loadstart', function () { if (playing) setBuffering(true); });
  audio.addEventListener('waiting', function () { setBuffering(true); });
  audio.addEventListener('stalled', function () { setBuffering(true); });
  audio.addEventListener('playing', function () { setBuffering(false); });
  audio.addEventListener('canplay', function () { setBuffering(false); });
  audio.addEventListener('loadedmetadata', function () {
    durEl.textContent = fmt(audio.duration);
    paintProgress();
  });
  audio.addEventListener('timeupdate', paintProgress);
  audio.addEventListener('error', function () {
    if (!audio.getAttribute('src')) return;
    root.classList.add('is-error');
  });

  items.forEach(function (el) {
    el.addEventListener('click', function () {
      var i = parseInt(el.getAttribute('data-index'), 10) || 0;
      if (i === idx && playing) { pause(); return; }
      applyTrack(i, false);
      play();
    });
  });

  muteBtn.addEventListener('click', function () {
    audio.muted = !audio.muted;
    root.classList.toggle('is-muted', audio.muted);
    try { localStorage.setItem(MUTE_KEY, audio.muted ? '1' : '0'); } catch (e) {}
  });

  volInput.addEventListener('input', function () {
    var v = parseFloat(volInput.value);
    audio.volume = v;
    if (v > 0 && audio.muted) {
      audio.muted = false;
      root.classList.remove('is-muted');
    }
    paintRange(v);
    try { localStorage.setItem(VOL_KEY, String(v)); } catch (e) {}
  });

  // 进度条：点按 / 拖动
  function down(e) {
    dragging = true;
    root.classList.add('is-seeking');
    seekFromEvent(e);
  }
  function move(e) {
    if (!dragging) return;
    if (e.cancelable) e.preventDefault();
    seekFromEvent(e);
  }
  function up() {
    if (!dragging) return;
    dragging = false;
    root.classList.remove('is-seeking');
    paintProgress();
  }
  timeline.addEventListener('pointerdown', down);
  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  timeline.addEventListener('keydown', function (e) {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') { audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); e.preventDefault(); }
  });

  // 播放列表
  function closeList() {
    listPanel.hidden = true;
    root.classList.remove('is-list-open');
    listBtn.setAttribute('aria-expanded', 'false');
  }
  listBtn.addEventListener('click', function () {
    var open = listPanel.hidden;
    listPanel.hidden = !open;
    root.classList.toggle('is-list-open', open);
    listBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) {
    if (listPanel.hidden) return;
    if (root.contains(e.target)) return;
    closeList();
  });

  // 收起 / 展开
  function setMini(v) {
    root.classList.toggle('is-mini', v);
    if (v) closeList();
    foldBtn.setAttribute('aria-label', v ? '展开播放器' : '收起播放器');
    foldBtn.setAttribute('title', v ? '展开' : '收起');
    try { localStorage.setItem(MINI_KEY, v ? '1' : '0'); } catch (e) {}
  }
  foldBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    userToggled = true;
    setMini(!root.classList.contains('is-mini'));
  });
  disc.addEventListener('dblclick', function () { userToggled = true; setMini(true); });

  // 小屏点击唱片以外的区域也能展开
  root.addEventListener('click', function (e) {
    if (!root.classList.contains('is-mini')) return;
    if (e.target.closest('.player-disc')) return;
    userToggled = true;
    setMini(false);
  });

  /* 滚动到正文时自动收起。
     播放器是 fixed、桌面端 352 宽，正文卡左缘在 1440 下大约 309，
     所以展开态会盖掉段落开头和代码块左边一截（归档页页脚署名也被盖）。
     这里只做一次"跟着滚动走"的自动折叠，不写 localStorage：
     用户手动点过之后就完全听用户的，不再自动动。 */
  var userToggled = false;
  var autoMini = false;
  function applyMini(v) {
    root.classList.toggle('is-mini', v);
    if (v) closeList();
    foldBtn.setAttribute('aria-label', v ? '展开播放器' : '收起播放器');
    foldBtn.setAttribute('title', v ? '展开' : '收起');
  }
  window.addEventListener('scroll', function () {
    if (userToggled) return;
    var y = window.scrollY;
    if (y > 220 && !root.classList.contains('is-mini')) { autoMini = true; applyMini(true); }
    else if (y < 90 && autoMini) { autoMini = false; applyMini(false); }
  }, { passive: true });

  window.addEventListener('resize', function () {
    if (ring) { sizeRing(); }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopLoop();
    else if (playing) startLoop();
  });

  // ---------- 初始化 ----------
  var savedIdx = 0;
  try { savedIdx = parseInt(localStorage.getItem(IDX_KEY), 10) || 0; } catch (e) {}
  applyTrack(savedIdx, false);
  restoreVolume();
  sizeRing();
  startLoop();

  /* 初始收起状态：
     - 用户手动设过（localStorage 有值）→ 完全听用户的；
     - 从没设过 → 手机端、以及首页以外的页面，一律收成小唱片。
       首页首屏左右两角是留白，播放器和吉祥物正好对称；文章页/归档页那个角落
       是正文和列表，展开态 352 宽会压住内容（11.42）。 */
  var savedMini = null;
  try { savedMini = localStorage.getItem(MINI_KEY); } catch (e) {}
  if (savedMini === '1') {
    applyMini(true);
  } else if (savedMini === null) {
    if (window.innerWidth <= 680 || !document.body.classList.contains('is-home')) {
      applyMini(true);
    }
  }
})();
