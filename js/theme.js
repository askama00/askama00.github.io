// 主题切换：白昼（paper）/ 霓虹（ink）
// - 记忆到 localStorage
// - 同步按钮的 aria-pressed / title，以及移动端地址栏用的 theme-color
// - 广播 themechange 事件：评论 iframe 等第三方组件靠它换色（见 partials/giscus.html）
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  var KEY = 'blog-theme';
  var META = { paper: '#eaf1ff', ink: '#060a16' };

  function current() {
    return root.getAttribute('data-theme') === 'ink' ? 'ink' : 'paper';
  }

  function paint(theme, announce) {
    root.setAttribute('data-theme', theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', META[theme]);
    if (btn) {
      var isInk = theme === 'ink';
      btn.setAttribute('aria-pressed', isInk ? 'true' : 'false');
      btn.setAttribute('aria-label', isInk ? '切换到白昼主题' : '切换到霓虹主题');
      btn.setAttribute('title', isInk ? '切换到白昼主题' : '切换到霓虹主题');
    }
    // 首帧不广播：那时还没有别的组件在等这个信号
    if (announce) {
      document.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    }
  }

  // <head> 里的内联脚本已经定好 data-theme（防闪白），这里只把按钮状态对齐
  paint(current(), false);

  if (!btn) return;
  btn.addEventListener('click', function () {
    var next = current() === 'ink' ? 'paper' : 'ink';
    paint(next, true);
    try { localStorage.setItem(KEY, next); } catch (e) {}
  });
})();
