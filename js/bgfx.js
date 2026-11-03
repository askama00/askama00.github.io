// 背景动态层：只负责把指针位置写进 CSS 变量，位移和渐变全交给 CSS。
// 动画（光球漂移、扫光）是纯 CSS 的，这里不参与逐帧绘制。
(function () {
  var fx = document.querySelector('.bg-fx');
  if (!fx) return;

  // 用户要求减少动效 / 触屏（没有指针）：整层保持静态，连监听都不挂
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (reduce && reduce.matches) return;
  var fine = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine || !fine.matches) return;

  var root = document.documentElement;
  var W = window.innerWidth;
  var H = window.innerHeight;
  var shown = false;

  // pointermove 本身就按帧节流（浏览器会合并高频移动），
  // 这里直接写变量、不再套 requestAnimationFrame：少一层延迟，也不会在
  // 某些环境（后台标签页 / 无头渲染）里因为 rAF 不触发而完全不动。
  function update(x, y) {
    // 相对屏幕中心的偏移比，-1 ~ 1
    var rx = (x - W / 2) / (W / 2);
    var ry = (y - H / 2) / (H / 2);

    root.style.setProperty('--mx', x.toFixed(1) + 'px');
    root.style.setProperty('--my', y.toFixed(1) + 'px');
    // 网格逆着指针走一点（近处动得多），光球顺着走一点（远处动得少），形成纵深
    root.style.setProperty('--gx', (-rx * 16).toFixed(1) + 'px');
    root.style.setProperty('--gy', (-ry * 16).toFixed(1) + 'px');
    root.style.setProperty('--ox', (rx * 24).toFixed(1) + 'px');
    root.style.setProperty('--oy', (ry * 24).toFixed(1) + 'px');
  }

  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    if (!shown) {
      shown = true;
      fx.classList.add('is-pointer');
    }
    update(e.clientX, e.clientY);
  }, { passive: true });

  // 指针移出窗口就把聚光淡掉，避免光斑停在边角
  document.addEventListener('pointerleave', function () {
    shown = false;
    fx.classList.remove('is-pointer');
  });
  window.addEventListener('blur', function () {
    shown = false;
    fx.classList.remove('is-pointer');
  });

  window.addEventListener('resize', function () {
    W = window.innerWidth;
    H = window.innerHeight;
  });
})();
