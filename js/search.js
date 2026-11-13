// 本地全文搜索：读取根目录 index.json（兼容子路径部署）
(function () {
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  var empty = document.getElementById('search-empty');
  if (!input || !results) return;

  // 索引路径由模板写在 <body data-index>，是站根绝对路径。
  // 早先靠 pathname 深度推算相对路径，在 404（任意深的错误 URL）上必错。
  function indexURL() {
    var fromBody = document.body && document.body.dataset.index;
    if (fromBody) return fromBody;
    var segs = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
    var depth = segs.length;
    var prefix = depth === 0 ? '' : new Array(depth + 1).join('../');
    return prefix + 'index.json';
  }

  var data = null;
  var pending = null;   // 索引未就绪时先记住要查的词，等 fetch 回来再补跑

  fetch(indexURL())
    .then(function (r) { return r.json(); })
    .then(function (json) {
      data = json;
      if (pending) { var p = pending; pending = null; run(p); }
    })
    .catch(function (e) { results.innerHTML = '<p class="search-empty">搜索索引加载失败。</p>'; });

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function highlight(text, q) {
    var safe = escapeHTML(text);
    if (!q) return safe;
    var idx = safe.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return safe;
    return safe.slice(0, idx) + '<mark>' + safe.slice(idx, idx + q.length) + '</mark>' + safe.slice(idx + q.length);
  }

  function run(raw) {
    var q = String(raw || '').trim().toLowerCase();
    results.innerHTML = '';
    if (!q) { if (empty) empty.hidden = true; return; }
    if (!data) { pending = q; results.innerHTML = '<p class="search-empty">索引尚未就绪……</p>'; return; }

    var hits = data.filter(function (item) {
      return (item.title + ' ' + item.summary + ' ' + (item.content || '') + ' ' +
        (item.tags || []).join(' ') + ' ' + (item.categories || []).join(' ') + ' ' +
        (item.series || []).join(' ')).toLowerCase().indexOf(q) !== -1;
    });

    if (hits.length === 0) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    hits.forEach(function (item) {
      var div = document.createElement('div');
      div.className = 'search-result';
      div.innerHTML =
        '<h3><a href="' + item.uri + '">' + highlight(item.title, q) + '</a></h3>' +
        '<div class="sr-meta">' + (item.date || '') + '　' + (item.categories || []).map(function (c) { return '#' + c; }).join(' ') + '</div>' +
        '<p>' + highlight(item.summary || '', q) + '</p>';
      results.appendChild(div);
    });
  }

  input.addEventListener('input', function () { run(input.value); });

  // 支持 /search/?q=xxx 直接带查询词进来（404 页的搜索框就靠这个）
  var initial = new URLSearchParams(window.location.search).get('q');
  if (initial) {
    input.value = initial;
    run(initial);
  }
})();
