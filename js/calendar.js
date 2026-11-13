// 首页日历：公历 + 农历 + 二十四节气 + 节日 + 发文统计
// 农历换算依赖 js/vendor/solarlunar.min.js（ISC）；拿不到就退化成纯公历，不报错、不留白。
(function () {
  var grid = document.getElementById('cal-grid');
  if (!grid) return;

  var SL = window.solarLunar && (window.solarLunar.default || window.solarLunar);
  var hasLunar = !!(SL && typeof SL.solar2lunar === 'function');

  var titleEl = document.getElementById('cal-title');
  var subEl = document.getElementById('cal-sub');
  var statMonth = document.getElementById('cal-stat-month');
  var statYear = document.getElementById('cal-stat-year');
  var statTotal = document.getElementById('cal-stat-total');

  /* 文章按日期归组。旧版是 postMap[date] = o 直接赋值，
     同一天发两篇时后一篇会把前一篇顶掉，标题和链接都变成最后一篇的。 */
  var postMap = {};
  var postTotal = 0;
  try {
    var raw = JSON.parse(document.getElementById('post-dates-data').textContent) || [];
    raw.forEach(function (o) {
      if (!o || !o.date) return;
      postTotal++;
      (postMap[o.date] = postMap[o.date] || []).push(o);
    });
  } catch (e) {}

  /* 公历固定节日。一律压成两个字，和农历节日、节气同宽，
     否则「国庆节」这种三字会在 30px 的格子里换行。 */
  var SOLAR_FEST = {
    '1-1': '元旦', '2-14': '情人', '3-8': '妇女', '3-12': '植树',
    '4-1': '愚人', '5-1': '劳动', '5-4': '青年', '6-1': '儿童',
    '7-1': '建党', '8-1': '建军', '9-10': '教师', '10-1': '国庆',
    '12-24': '平安', '12-25': '圣诞'
  };

  var now = new Date();
  var tY = now.getFullYear(), tM = now.getMonth(), tD = now.getDate();
  var y = tY, m = tM;

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  /* 格子第二行的小字。kind 决定颜色：
     fest 节日 / term 节气 / mon 农历月首 / day 平常日子 */
  function subLabel(yy, mm, dd) {
    if (!hasLunar) return null;
    var L;
    try { L = SL.solar2lunar(yy, mm + 1, dd); } catch (e) { return null; }
    if (!L || L === -1 || !L.lDay) return null;

    /* 除夕：腊月最后一天，二十九和三十都可能，得按当年实际天数判 */
    if (L.lMonth === 12 && !L.isLeap && typeof SL.monthDays === 'function') {
      var lastDay = SL.monthDays(L.lYear, 12);
      if (lastDay > 0 && L.lDay === lastDay) return { text: '除夕', kind: 'fest' };
    }

    /* 农历节日。内置表在同一天可能给出「春节」+「农历新年」两条，取第一条 */
    if (typeof SL.getFestivals === 'function') {
      var fs = SL.getFestivals(yy, mm + 1, dd);
      if (fs && fs.length) {
        var name = String(fs[0]).replace(/节$/, '');
        if (name.length > 2) name = name.slice(0, 2);
        return { text: name, kind: 'fest' };
      }
    }

    var sf = SOLAR_FEST[(mm + 1) + '-' + dd];
    if (sf) return { text: sf, kind: 'fest' };
    if (L.isTerm && L.term) return { text: L.term, kind: 'term' };
    if (L.lDay === 1) return { text: L.monthCn, kind: 'mon' };
    return { text: L.dayCn, kind: 'day' };
  }

  function render(yy, mm) {
    titleEl.textContent = yy + ' 年 ' + (mm + 1) + ' 月';

    /* 副标题取 15 号的干支：月柱是在节气当天换的，
       用月首那天的干支在节气前后会整整错一位。 */
    if (hasLunar && subEl) {
      var mid = null;
      try { mid = SL.solar2lunar(yy, mm + 1, 15); } catch (e) {}
      subEl.textContent = mid ? mid.gzYear + '年 · ' + mid.gzMonth + '月' : '';
    } else if (subEl) {
      subEl.textContent = '';
    }

    grid.innerHTML = '';
    var first = new Date(yy, mm, 1).getDay();
    var days = new Date(yy, mm + 1, 0).getDate();

    for (var i = 0; i < first; i++) {
      var blank = document.createElement('span');
      blank.className = 'cal-cell empty';
      grid.appendChild(blank);
    }

    for (var d = 1; d <= days; d++) {
      var key = yy + '-' + pad(mm + 1) + '-' + pad(d);
      var hits = postMap[key];
      var cell = document.createElement(hits ? 'a' : 'span');
      cell.className = 'cal-cell';
      if (hits) {
        cell.classList.add('has-post');
        cell.href = hits[0].url;
        cell.title = hits.length > 1
          ? (mm + 1) + '月' + d + '日 · ' + hits.length + ' 篇文章'
          : (mm + 1) + '月' + d + '日 · ' + hits[0].title;
      }
      if (yy === tY && mm === tM && d === tD) cell.classList.add('today');

      var num = document.createElement('span');
      num.className = 'cal-d';
      num.textContent = d;
      cell.appendChild(num);

      var lab = subLabel(yy, mm, d);
      if (lab) {
        var sub = document.createElement('span');
        sub.className = 'cal-l cal-l--' + lab.kind;
        sub.textContent = lab.text;
        cell.appendChild(sub);
        if (!cell.title) cell.title = (mm + 1) + '月' + d + '日 · 农历' + lab.text;
      }
      grid.appendChild(cell);
    }

    /* 统计跟着翻月走：本月 / 今年 都指「正在看的那个月 / 年」 */
    var inMonth = 0, inYear = 0;
    Object.keys(postMap).forEach(function (k) {
      var p = k.split('-');
      var n = postMap[k].length;
      if (+p[0] === yy) {
        inYear += n;
        if (+p[1] === mm + 1) inMonth += n;
      }
    });
    if (statMonth) statMonth.textContent = inMonth;
    if (statYear) statYear.textContent = inYear;
    if (statTotal) statTotal.textContent = postTotal;
  }

  render(y, m);

  var prev = document.getElementById('cal-prev');
  var next = document.getElementById('cal-next');
  var todayBtn = document.getElementById('cal-today');

  if (prev) prev.addEventListener('click', function () {
    m--; if (m < 0) { m = 11; y--; } render(y, m);
  });
  if (next) next.addEventListener('click', function () {
    m++; if (m > 11) { m = 0; y++; } render(y, m);
  });
  if (todayBtn) todayBtn.addEventListener('click', function () {
    y = tY; m = tM; render(y, m);
  });
})();
