// 评论（giscus）主题同步
// ------------------------------------------------------------------
// 为什么这么绕：giscus 是 giscus.app 上的 iframe，父页面改 CSS 碰不到它。
//   1) 首帧颜色由 <script data-theme="..."> 决定 —— 所以脚本必须由 JS 注入，
//      否则服务端渲染时还不知道用户上次选的是哪个主题，会先白后黑地闪一下；
//   2) 之后换主题只能给 iframe 发 postMessage，让它自己换 <link>，不能重载
//      （重载会丢掉正在输入的评论）。
// 配置全部写在 #giscus-mount 的 data-* 上，见 partials/giscus.html。
(function () {
  var mount = document.getElementById('giscus-mount');
  if (!mount) return;

  var cfg = mount.dataset;
  var ORIGIN = 'https://giscus.app';
  var THEMES = { paper: cfg.themePaper, ink: cfg.themeInk };
  var fallback = cfg.fallback ? document.querySelector(cfg.fallback) : null;

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'ink' ? 'ink' : 'paper';
  }

  /* ---------- 1. 注入客户端，首帧即当前主题 ---------- */
  var s = document.createElement('script');
  s.src = ORIGIN + '/client.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  var attrs = {
    'data-repo': cfg.repo,
    'data-repo-id': cfg.repoId,
    'data-category': cfg.category,
    'data-category-id': cfg.categoryId,
    'data-mapping': cfg.mapping,
    'data-reactions-enabled': cfg.reactionsEnabled,
    'data-emit-metadata': '0',
    'data-input-position': 'bottom',
    'data-theme': THEMES[currentTheme()],
    'data-lang': cfg.lang,
    'data-loading': 'lazy'
  };
  for (var k in attrs) {
    if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
    var v = attrs[k];
    // 注意别用 if (v)：data-reactions-enabled="0" 会被当成空值丢掉
    if (v !== undefined && v !== null && v !== '') s.setAttribute(k, v);
  }
  mount.appendChild(s);

  /* ---------- 2. 主题热切换 ---------- */
  var lastSent = null;
  function syncTheme() {
    var iframe = mount.querySelector('iframe.giscus-frame');
    if (!iframe || !iframe.contentWindow) return;
    var t = currentTheme();
    if (t === lastSent) return;
    lastSent = t;
    iframe.contentWindow.postMessage({ giscus: { setConfig: { theme: THEMES[t] } } }, ORIGIN);
  }

  // 任何一方改 <html data-theme>（顶栏按钮、快捷键、别的脚本）都会被这里接住
  new MutationObserver(syncTheme).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
  // 另一个标签页切了主题：storage 事件不触发上面的 MutationObserver，补一刀
  window.addEventListener('storage', function (e) {
    if (e.key === 'blog-theme') setTimeout(syncTheme, 0);
  });

  /* ---------- 3. iframe 出现 / 重载后对齐一次 ---------- */
  // iframe 加载期间用户可能已经切过主题，load 完必须重发，否则停在首帧的颜色
  new MutationObserver(function () {
    var iframe = mount.querySelector('iframe.giscus-frame');
    if (!iframe || iframe.__themeWired) return;
    iframe.__themeWired = true;
    iframe.addEventListener('load', function () {
      lastSent = null;                 // 强制重发
      syncTheme();
      setTimeout(syncTheme, 400);      // giscus 渲染完评论会重置样式，再对齐一次
    });
    setTimeout(function () { lastSent = null; syncTheme(); }, 600);
  }).observe(mount, { childList: true, subtree: true });

  /* ---------- 4. 失败兜底 ---------- */
  var shown = false;
  function showFallback(msg) {
    if (shown) return;
    shown = true;
    if (fallback) { if (msg) fallback.textContent = msg; fallback.style.display = 'block'; }
  }
  document.addEventListener('giscusError', function (e) {
    var m = (e && e.detail && e.detail.message) ? e.detail.message : 'Giscus 返回错误';
    showFallback('评论 / 点赞加载失败：' + m + '。请确认仓库已开启 Discussions，且已为 Giscus 应用授权。');
  });
  // data-loading="lazy" 要等评论区进入视口才开始加载，所以只在「露过面」之后才报失败
  var peeked = false;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) peeked = true;
    }, { rootMargin: '200px' }).observe(mount);
  } else {
    peeked = true;
  }
  setTimeout(function () {
    if (peeked && !mount.querySelector('iframe.giscus-frame')) {
      showFallback('评论 / 点赞加载较慢或失败：多为网络无法访问 giscus.app，或仓库配置有误。请打开浏览器控制台（F12）查看报错，并确认仓库已开启 Discussions 且已授权 Giscus。');
    }
  }, 9000);
})();
