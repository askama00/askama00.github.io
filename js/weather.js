// 首页天气：open-meteo（免费无 key）+ 可选 IP 定位
// 任意一步失败就把卡片留在 hidden 状态，不在侧栏里留空壳。
(function () {
  var card = document.getElementById('weather-card');
  if (!card) return;

  var elIcon  = document.getElementById('wx-icon');
  var elTemp  = document.getElementById('wx-temp');
  var elCity  = document.getElementById('wx-city');
  var elDesc  = document.getElementById('wx-desc');
  var elDays  = document.getElementById('wx-days');

  var cfgCity = (card.dataset.city || '').trim();
  var cfgLat  = parseFloat(card.dataset.lat);
  var cfgLon  = parseFloat(card.dataset.lon);
  var hasCoord = isFinite(cfgLat) && isFinite(cfgLon);

  var CACHE_KEY = 'wx-cache-v1';
  var TTL = 20 * 60 * 1000;          // 20 分钟内不重复请求
  var fingerprint = hasCoord ? (cfgLat + ',' + cfgLon) : (cfgCity || 'ip');

  /* WMO 天气码 → [中文描述, 图标键] */
  var WMO = {
    0: ['晴', 'sun'], 1: ['大部晴朗', 'sun'], 2: ['多云', 'partly'], 3: ['阴', 'cloudy'],
    45: ['有雾', 'fog'], 48: ['雾凇', 'fog'],
    51: ['毛毛雨', 'rain'], 53: ['毛毛雨', 'rain'], 55: ['毛毛雨', 'rain'],
    56: ['冻雨', 'rain'], 57: ['冻雨', 'rain'],
    61: ['小雨', 'rain'], 63: ['中雨', 'rain'], 65: ['大雨', 'rain'],
    66: ['冻雨', 'rain'], 67: ['冻雨', 'rain'],
    71: ['小雪', 'snow'], 73: ['中雪', 'snow'], 75: ['大雪', 'snow'], 77: ['雪粒', 'snow'],
    80: ['阵雨', 'rain'], 81: ['阵雨', 'rain'], 82: ['强阵雨', 'rain'],
    85: ['阵雪', 'snow'], 86: ['阵雪', 'snow'],
    95: ['雷阵雨', 'thunder'], 96: ['雷阵雨伴冰雹', 'thunder'], 99: ['雷阵雨伴冰雹', 'thunder']
  };

  /* 线性图标，统一 24 视框 + currentColor，颜色交给 CSS */
  var ICONS = {
    sun: '<circle cx="12" cy="12" r="4.1"/><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>',
    moon: '<path d="M20.3 14.9A8.7 8.7 0 0 1 9.1 3.7 8.7 8.7 0 1 0 20.3 14.9z"/>',
    partly: '<circle cx="8.6" cy="8.4" r="3.4"/><path d="M8.6 2.4v1.7M2.6 8.4h1.7M4.2 4l1.2 1.2M13 4l-1.2 1.2"/><path d="M10 20h8.4a3.3 3.3 0 0 0 .3-6.6 4.9 4.9 0 0 0-9.4 1.1A3 3 0 0 0 10 20z"/>',
    cloudy: '<path d="M8.2 14.6h9a3.1 3.1 0 0 0 .3-6.2 4.7 4.7 0 0 0-9 1A2.8 2.8 0 0 0 8.2 14.6z"/><path d="M6.6 20h9.2a3 3 0 0 0 .3-6 4.3 4.3 0 0 0-8.4 1A2.6 2.6 0 0 0 6.6 20z"/>',
    fog: '<path d="M8 13.4h8.8a3.1 3.1 0 0 0 .3-6.2 4.7 4.7 0 0 0-9 1A2.8 2.8 0 0 0 8 13.4z"/><path d="M4.5 17h15M6.5 20.4h11"/>',
    rain: '<path d="M8 13.4h8.8a3.1 3.1 0 0 0 .3-6.2 4.7 4.7 0 0 0-9 1A2.8 2.8 0 0 0 8 13.4z"/><path d="M8.6 17l-1 2.6M12.4 17l-1 2.6M16.2 17l-1 2.6"/>',
    snow: '<path d="M8 13.4h8.8a3.1 3.1 0 0 0 .3-6.2 4.7 4.7 0 0 0-9 1A2.8 2.8 0 0 0 8 13.4z"/><path d="M8.4 17.6h.01M12 17.6h.01M15.6 17.6h.01M10.2 20.8h.01M13.8 20.8h.01"/>',
    thunder: '<path d="M8 13.4h8.8a3.1 3.1 0 0 0 .3-6.2 4.7 4.7 0 0 0-9 1A2.8 2.8 0 0 0 8 13.4z"/><path d="M13.4 15.6L11 19.2h2.6l-.9 3"/>'
  };

  function svg(key) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[key] || ICONS.cloudy) + '</svg>';
  }

  function getJSON(url) {
    return fetch(url, { credentials: 'omit' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    });
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || o.fp !== fingerprint || !o.d) return null;
      return o;
    } catch (e) { return null; }
  }

  function writeCache(d) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ fp: fingerprint, t: Date.now(), d: d }));
    } catch (e) {}
  }

  function locate() {
    if (hasCoord) {
      return Promise.resolve({ lat: cfgLat, lon: cfgLon, city: cfgCity });
    }
    if (cfgCity) {
      return getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' +
        encodeURIComponent(cfgCity))
        .then(function (j) {
          var r = j && j.results && j.results[0];
          if (!r) throw new Error('city not found');
          return { lat: r.latitude, lon: r.longitude, city: r.name };
        });
    }
    /* 兜底定位。ipwho.is 免费额度很容易 429（实测几次就限流），
       ipinfo 的 loc 字段是 "纬度,经度" 一个字符串，要自己拆。 */
    return getJSON('https://ipinfo.io/json')
      .then(function (j) {
        if (!j || !j.loc) throw new Error('ip locate failed');
        var p = String(j.loc).split(',');
        var lat = parseFloat(p[0]), lon = parseFloat(p[1]);
        if (!isFinite(lat) || !isFinite(lon)) throw new Error('bad loc');
        var city = j.city || '';
        /* ipinfo 只给英文城市名（Zhengzhou），拿它再查一次中文名。
           顺带用查到的城市中心坐标，比 IP 库的定位更贴合本地天气。
           查不到就退回原始值，不影响出天气。 */
        if (!city) return { lat: lat, lon: lon, city: '' };
        return getJSON('https://geocoding-api.open-meteo.com/v1/search?count=1&language=zh&format=json&name=' +
          encodeURIComponent(city))
          .then(function (g) {
            var r = g && g.results && g.results[0];
            if (r && r.name && isFinite(r.latitude)) {
              return { lat: r.latitude, lon: r.longitude, city: r.name };
            }
            return { lat: lat, lon: lon, city: city };
          })
          .catch(function () { return { lat: lat, lon: lon, city: city }; });
      });
  }

  function fetchWeather(loc) {
    var url = 'https://api.open-meteo.com/v1/forecast?timezone=auto&forecast_days=3' +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min' +
      '&latitude=' + loc.lat + '&longitude=' + loc.lon;
    return getJSON(url).then(function (j) {
      var c = j.current, dd = j.daily;
      if (!c || !dd) throw new Error('bad payload');
      var days = [];
      // 取前 3 天（今天 / 明天 / 后天），每段给图标 + 最高/最低温
      for (var i = 0; i < dd.time.length && i < 3; i++) {
        days.push({
          code: dd.weather_code[i],
          hi: Math.round(dd.temperature_2m_max[i]),
          lo: Math.round(dd.temperature_2m_min[i])
        });
      }
      return {
        city: loc.city || '',
        temp: Math.round(c.temperature_2m),
        code: c.weather_code,
        isDay: c.is_day === 1,
        feel: Math.round(c.apparent_temperature),
        hum: Math.round(c.relative_humidity_2m),
        days: days
      };
    });
  }

  function paint(d) {
    var m = WMO[d.code] || ['未知', 'cloudy'];
    var key = m[1];
    if (key === 'sun' && !d.isDay) key = 'moon';

    elIcon.innerHTML = svg(key);
    elTemp.textContent = d.temp;
    elCity.textContent = d.city || '本地';
    elDesc.textContent = m[0];

    // 三天预报：今天 / 明天 / 后天，每天一行小图标 + 高低温
    var labels = ['今天', '明天', '后天'];
    elDays.innerHTML = (d.days || []).map(function (day, i) {
      var dm = WMO[day.code] || ['未知', 'cloudy'];
      var lbl = labels[i] || '';
      return '<li class="wx-day">' +
        '<span class="wx-day-label">' + lbl + '</span>' +
        '<span class="wx-day-icon">' + svg(dm[1]) + '</span>' +
        '<span class="wx-day-temp"><b>' + day.hi + '°</b><i>' + day.lo + '°</i></span>' +
        '</li>';
    }).join('');

    card.hidden = false;
  }

  var cached = readCache();
  if (cached) paint(cached.d);
  if (cached && Date.now() - cached.t < TTL) return;

  locate()
    .then(fetchWeather)
    .then(function (d) {
      paint(d);
      writeCache(d);
    })
    .catch(function () { /* 网络不通就什么都不做，卡片保持隐藏 */ });
})();
