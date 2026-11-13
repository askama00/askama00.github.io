// 阅读辅助：顶栏进度条 + 代码块复制
// 只挂在文章页（baseof 里用 .IsPage 判断），首页和列表页不加载。
(function () {
  /* ---------- 1. 阅读进度 ----------
     用 --p 传比例，让 CSS 用 transform: scaleX 画，
     不改 width（改 width 每帧都要重排，长文章会掉帧）。 */
  var bar = document.querySelector('.read-progress span');
  var article = document.querySelector('.post-content');
  if (bar && article) {
    var ticking = false;
    function paint() {
      ticking = false;
      var len = article.offsetHeight;
      var view = window.innerHeight;
      if (len <= view) {          // 一屏就能看完，没有"进度"可言
        bar.style.setProperty('--p', '0');
        return;
      }
      var top = article.getBoundingClientRect().top;
      var p = Math.min(1, Math.max(0, -top / (len - view)));
      bar.style.setProperty('--p', p.toFixed(4));
    }
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(paint);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paint();
  }

  /* ---------- 2. 代码块：语言标签 + 一键复制 ---------- */
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) {
      return false;
    }
  }

  var blocks = document.querySelectorAll('.post-content .highlight');
  Array.prototype.forEach.call(blocks, function (block) {
    var code = block.querySelector('code');
    if (!code) return;

    // 语言标签：Hugo 把 info string 写在 code 的 class 上（language-bash）
    var m = /language-([\w+#.-]+)/.exec(code.className || '');
    if (m) {
      var tag = document.createElement('span');
      tag.className = 'code-lang';
      tag.textContent = m[1];
      block.appendChild(tag);
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'code-copy';
    btn.textContent = '复制';
    btn.setAttribute('aria-label', '复制这段代码');
    block.appendChild(btn);

    var timer = null;
    function flash(text, ok) {
      btn.textContent = text;
      btn.classList.toggle('is-done', !!ok);
      clearTimeout(timer);
      timer = setTimeout(function () {
        btn.textContent = '复制';
        btn.classList.remove('is-done');
      }, 1600);
    }

    btn.addEventListener('click', function () {
      var text = code.innerText;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(
          function () { flash('已复制', true); },
          function () { flash(legacyCopy(text) ? '已复制' : '复制失败', true); }
        );
      } else {
        // http 或老浏览器没有 clipboard API
        flash(legacyCopy(text) ? '已复制' : '复制失败', true);
      }
    });
  });
})();
