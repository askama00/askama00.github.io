// 封面页个性签名打字机轮播
(function () {
  var el = document.getElementById('typewriter');
  if (!el) return;
  var sigs = [];
  try { sigs = JSON.parse(el.getAttribute('data-signatures') || '[]'); } catch (e) {}
  if (!sigs.length) return;

  var i = 0, txt = '', deleting = false;
  function tick() {
    var full = sigs[i];
    if (!deleting) {
      txt = full.slice(0, txt.length + 1);
      el.textContent = txt;
      if (txt === full) { deleting = true; return setTimeout(tick, 1900); }
      setTimeout(tick, 110);
    } else {
      txt = full.slice(0, txt.length - 1);
      el.textContent = txt;
      if (txt === '') { deleting = false; i = (i + 1) % sigs.length; setTimeout(tick, 350); return; }
      setTimeout(tick, 45);
    }
  }
  tick();
})();
