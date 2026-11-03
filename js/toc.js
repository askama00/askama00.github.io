// 左侧目录索引：滚动时高亮当前小节。
// 只在宽屏存在 .rail-toc（≥1300px），窄屏是内联目录卡，没有高亮需求。
// 注意：无头截图里 requestAnimationFrame 不推进，验证高亮要在真实浏览器里滚。
(function () {
  var rail = document.querySelector('.rail-toc');
  if (!rail) return;

  var links = [].slice.call(rail.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  var items = [];
  links.forEach(function (a) {
    var raw = a.getAttribute('href').slice(1);
    if (!raw) return;
    // Hugo 的标题 id 是中文，写进 href 时被百分号编码（#docker%e9%83%a8%e7%bd%b2）。
    // 不 decode 就 getElementById 不到，结果一条都匹配不上、高亮永远不亮。
    var id = raw;
    try { id = decodeURIComponent(raw); } catch (e) {}
    var el = document.getElementById(id) || document.getElementById(raw);
    if (el) items.push({ link: a, el: el });
  });
  if (!items.length) return;

  var HR = 120;           // 判定线：页面顶部往下 120px（页眉 ~57 + 余量）
  var current = null;
  var ticking = false;

  function activate(link) {
    if (link === current) return;
    if (current) current.classList.remove('is-active');
    current = link;
    if (!current) return;
    current.classList.add('is-active');

    // 目录比可视区高时，把当前项滚进目录自己的滚动区（不动页面）
    var box = rail.getBoundingClientRect();
    var r = current.getBoundingClientRect();
    if (r.top < box.top + 6) {
      rail.scrollTop -= box.top + 6 - r.top;
    } else if (r.bottom > box.bottom - 6) {
      rail.scrollTop += r.bottom - (box.bottom - 6);
    }
  }

  function update() {
    ticking = false;
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getBoundingClientRect().top - HR <= 0) found = items[i];
      else break;
    }
    // 滚到页面底部时，最后一个小节可能永远过不了判定线，直接兜住
    if (!found && window.scrollY > 0) {
      var atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      if (atBottom) found = items[items.length - 1];
    }
    activate(found ? found.link : null);
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  window.addEventListener('hashchange', onScroll);
  update();
})();
