// 背景粒子：随主题切换的蓝青色光点，缓慢上浮（科技感）
(function () {
  var canvas = document.getElementById('snow');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  var w, h, dots = [];

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', function () { resize(); make(); });

  function make() {
    dots = [];
    var count = Math.min(70, Math.floor(w / 16));
    for (var i = 0; i < count; i++) {
      dots.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 2.2 + 0.5,
        s: Math.random() * 0.35 + 0.12,
        d: Math.random() * 0.5 + 0.2,
        p: Math.random() * Math.PI * 2
      });
    }
  }
  make();

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  function palette() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t === 'ink') {
      return ['rgba(120,190,255,0.75)', 'rgba(90,150,255,0.60)', 'rgba(150,235,255,0.55)'];
    }
    return ['rgba(77,107,254,0.42)', 'rgba(23,198,221,0.40)', 'rgba(139,107,255,0.32)'];
  }

  var colors = palette();
  var toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    setTimeout(function () { colors = palette(); }, 60);
  });

  var t = 0;
  function draw() {
    t += 0.01;
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < dots.length; i++) {
      var p = dots[i];
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      p.y -= p.s;
      p.x += Math.sin(t + p.p) * p.d * 0.35;
      if (p.y < -8) {
        p.y = h + 8;
        p.x = Math.random() * w;
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();
