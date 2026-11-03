// 右下角吉祥物：Live2D「鲸鱼娘·溟月」
// 懒加载：首屏不加载 5MB 的模型，等页面空闲 / 用户点击后再拉运行时与模型。
// 素材 CC BY-NC-SA 4.0 © 上善无形 / ZipZipPipe / 氵六青
(function () {
  var mascot = document.getElementById('mascot');
  var stage = document.getElementById('mascot-stage');
  var canvas = document.getElementById('mascot-canvas');
  var bubble = document.getElementById('mascot-bubble');
  var textEl = document.getElementById('mascot-text');
  var closeBtn = document.getElementById('mascot-close');
  var restoreBtn = document.getElementById('mascot-restore');
  var loadingEl = document.getElementById('mascot-loading');
  var actionsEl = document.getElementById('mascot-actions');
  var actionsList = document.getElementById('mascot-actions-list');
  var actionsToggle = document.getElementById('mascot-actions-toggle');
  if (!mascot || !stage || !canvas) return;

  var KEY = 'mascot-hidden';
  var BASE = mascot.getAttribute('data-base') || '/live2d/';
  var MODEL_URL = mascot.getAttribute('data-model') || BASE + 'model/c_0120.model3.json';

  var LINES = [
    '主人，今天也要好好写代码哦～',
    '这条命令要不要我帮你敲？',
    '又熬夜啦？记得喝点水呀。',
    '欢迎回来！评论区别忘了留句话～',
    '我是一条鲸，不是鱼…算了，也行。',
    '编译通过！(๑•̀ㅂ•́)و✧',
    '摸鱼被抓到了？嘘——',
    '灵感没来的时候，就先写一行注释吧。',
    '需要帮忙就戳戳我，我会动的。',
    '左边那张唱片是我的电台，点开听听？',
    '今日份的可爱已上线 ✧',
    '网络是浩瀚的，你的 Bug 是有限的。',
    '又报错了？那是这个世界线的收束，换个分支试试。'
  ];
  // 一次性动作：名字 + 播放时长（毫秒）+ 权重 w。
  // ⚠️ 这模型所有 motion3 的 Meta.Loop 都是 true，动作不会自己结束。
  // 如果不按时 stopAllMotions()，currentPriority 会永远停在 3，
  // 而待机（IDLE 优先级）只在 currentPriority === 0 时才被接受 ——
  // 表现就是「点她一次之后她定格在那个动作里，眼神也不跟鼠标了」。
  //
  // w 决定被抽中的概率：曲线越多动作越明显，权重给高；
  // selfieQuick(2 条) / splash(1 条) 播起来几乎看不出变化，
  // 权重压低，保证点一下多数时候能看到明显反应。
  // ⚠️ ketchup(番茄酱) 带坏参数引用（keyboard / xbox），不进列表，别加回来。
  // ⚠️ splash(喷水/碰水) 已移除：它只驱动 1 条曲线（pengshui 碰水），
  // 实机看不出任何变化，留在随机里只会让"点了没反应"。
  // ⚠️ 蛋包饭(omelet) 已移除：自制 motion 实机不出现，连同 model3.json 注册与动作条一并去掉。
  var ONESHOTS = [
    { name: 'aidale',      ms: 4700, w: 3, label: '挨锤子' },   // 36 条曲线：凑近/招手，最明显
    { name: 'selfie',      ms: 3300, w: 3, label: '自拍' },     // 25 条：自拍，明显
    { name: 'bubble',      ms: 5000, w: 3, label: '吐泡泡' },   //  8 条：拿手机吐泡泡
    { name: 'openLid',     ms: 1800, w: 2, label: '开盖' },     //  5 条：开盖，较短
    { name: 'selfieQuick', ms: 1400, w: 1, label: '自拍简' }    //  2 条：自拍简版，变化极小
  ];

  // 道具类参数：动作**停止**后这些值不会自己回到 0，会残留最后一帧 ——
  // 这就是「锤子敲完不消失」「泡泡留在手上」的根因。
  // 名字整理自 cdi3.json（Param70=锤子出现、phone=手机手、chuipaopao3=泡泡出现…）。
  var PROP_PARAMS = [
    'Param70', 'Param75', 'Param76', 'Param78', 'Param79',        // 锤子：出现/旋转/X/压缩/放大
    'phone', 'phone3', 'phone4', 'phone6', 'phone7', 'shouji',    // 手机
    'paopao', 'chuipaopao', 'chuipaopao3', 'chuipaopao4',         // 泡泡
    'pengshui',                                                    // 碰水
    'pointX', 'pointY', 'pointY2', 'pointZ', 'maoshou'            // 点菜手 / 猫手
  ];

  var lastIndex = -1;
  var hideTimer = null;
  var idleTimer = null;
  var oneShotUntil = 0;   // 当前一次性动作预定结束的时间戳
  var lastPointer = null; // 最后一次鼠标位置，回到待机时把视线拨回去
  var app = null;
  var model = null;
  var loadingPromise = null;
  var bounds = { w: 0, h: 0 };
  var baseSize = { w: 0, h: 0 }; // 缩放前的原始包围盒，避免反复缩放累积误差

  // 自动待机动作（放她自己待着时偶尔来一下）的相关状态
  var ambientTimer = null;  // 下次自发动作的定时器
  var phoneHoldTimer = null; // 「举着手机待机」的收起定时器
  var ambientBusy = false;  // 是否正处于一段自发动作中（含举手机）
  var ambientGen = 0;       // 代次：手动交互打断时自增，让挂起的定时器作废

  function nextLine() {
    var i = Math.floor(Math.random() * LINES.length);
    if (LINES.length > 1 && i === lastIndex) i = (i + 1) % LINES.length;
    lastIndex = i;
    return LINES[i];
  }

  function say(text, duration) {
    if (!bubble || !textEl) return;
    textEl.textContent = text;
    bubble.classList.add('show');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function () { bubble.classList.remove('show'); }, duration || 4600);
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('load fail: ' + src)); };
      document.head.appendChild(s);
    });
  }

  function isSmall() { return window.innerWidth <= 680; }

  // 她住在右下角，尺寸只跟视口有关：桌面 300、平板 260、手机 200。
  // 之前用"左侧留白"推算尺寸，换到右边后不再适用。
  function targetHeight() {
    var w = window.innerWidth;
    if (w <= 680) return 200;
    if (w <= 1080) return 255;
    return 300;
  }

  function layout() {
    if (!model || !app) return;
    if (!baseSize.h) {
      baseSize.w = model.width;
      baseSize.h = model.height;
    }
    var targetH = targetHeight();
    var scale = targetH / baseSize.h;
    model.scale.set(scale);
    model.position.set(0, 0);
    var w = Math.max(1, Math.ceil(baseSize.w * scale));
    var h = Math.max(1, Math.ceil(baseSize.h * scale));
    bounds = { w: w, h: h };
    app.renderer.resize(w, h);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    mascot.style.width = w + 'px';
  }

  // 待机用 IDLE 优先级：它不会一直占着动作队列，点击的一次性动作才能插进来。
  // （之前用默认 NORMAL 播 idle，循环动作把后续动作全挡了，表现就是"点了没反应"）
  function P() {
    return (window.PIXI && PIXI.live2d && PIXI.live2d.MotionPriority) ||
           { IDLE: 1, NORMAL: 2, FORCE: 3 };
  }

  function hasMotion(name) {
    try {
      var defs = model.internalModel.motionManager.definitions;
      return !!(defs && defs[name] && defs[name].length);
    } catch (e) { return false; }
  }

  function motionState() {
    try { return model.internalModel.motionManager.state; } catch (e) { return null; }
  }

  // 找到能读写参数值的运行时对象（不同版本挂在 coreModel / internalModel 上，做特性探测）
  function coreRef() {
    try {
      var im = model && model.internalModel;
      if (!im) return null;
      var cands = [im.coreModel, im];
      for (var i = 0; i < cands.length; i++) {
        var c = cands[i];
        if (c && typeof c.setParameterValueById === 'function' &&
                typeof c.getParameterValueById === 'function') return c;
      }
    } catch (e) {}
    return null;
  }

  // 在待机状态下采样道具参数的「静息值」。
  // 这些参数**不被 idle 驱动**，所以待机时数值稳定，正好当复位基准。
  //
  // ⚠️ 只在模型刚加载、纯待机、没有任何道具动作时采样「一次」。之后绝不覆盖——
  // 否则像「举着手机待机」这类**故意保留道具**的姿态，会把静息基准污染成
  // phone=1，导致之后收不回手机、泡泡收不回去。
  var propSnapshot = null;
  var propSnapshotDone = false;
  function snapshotProps() {
    if (propSnapshotDone) return;
    var c = coreRef();
    if (!c) return;
    var s = {};
    var got = false;
    PROP_PARAMS.forEach(function (id) {
      try {
        var v = c.getParameterValueById(id);
        if (typeof v === 'number') { s[id] = v; got = true; }
      } catch (e) {}
    });
    if (got) { propSnapshot = s; propSnapshotDone = true; }
  }

  // 一次性动作收尾时把道具参数拨回静息值。
  // 不做这步的话，动作虽然停了，参数却停在最后一帧 ——
  // 表现就是锤子赖在画面上不消失、泡泡粘在手上。
  function restoreProps() {
    if (!propSnapshot) return;
    var c = coreRef();
    if (!c) return;
    Object.keys(propSnapshot).forEach(function (id) {
      try { c.setParameterValueById(id, propSnapshot[id]); } catch (e) {}
    });
  }

  // 加权随机：w 越大越容易抽中。抽中后仍要 hasMotion 校验——
  // definitions 只反映 model3.json 的声明，不代表文件真能加载，
  // 校验不过就跳过；一轮都没中就退化为顺序找第一个可用的。
  function pickWeighted() {
    var total = 0, i;
    for (i = 0; i < ONESHOTS.length; i++) total += ONESHOTS[i].w || 1;
    var r = Math.random() * total;
    for (i = 0; i < ONESHOTS.length; i++) {
      r -= (ONESHOTS[i].w || 1);
      if (r <= 0 && hasMotion(ONESHOTS[i].name)) return ONESHOTS[i];
    }
    for (i = 0; i < ONESHOTS.length; i++) {
      if (hasMotion(ONESHOTS[i].name)) return ONESHOTS[i];
    }
    return null;
  }

  // 清空动作队列并把优先级归零（stopAllMotions 内部会 state.reset()）。
  // 不清队列的话，循环中的动作会一直占着 currentPriority，待机进不来。
  function stopMotions() {
    try { model.internalModel.motionManager.stopAllMotions(); } catch (e) {}
  }

  // 视线跟随：不用 model.focus()。库里的实现会把「指针相对画布的方位」压到单位圆上，
  // 只保留方向、丢掉距离，而她蹲在右下角——全屏几乎都在她左上，看起来就是"没在看我"。
  // 这里直接写 focusController：以她的头部为原点算偏移，带死区、有上限，近处看得更明显。
  function applyFocus() {
    if (!model || !lastPointer) return;
    var fc;
    try { fc = model.internalModel.focusController; } catch (e) { return; }
    if (!fc) return;
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var cx = r.left + r.width * 0.5;
    var cy = r.top + r.height * 0.34;   // 她的头大概在画布三成高处
    var dx = (lastPointer.x - cx) / Math.max(240, window.innerWidth * 0.45);
    var dy = (lastPointer.y - cy) / Math.max(200, window.innerHeight * 0.45);
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));
    // 屏幕 y 向下，模型 ParamAngleY 向上，所以取反
    try { fc.focus(dx, -dy); } catch (e) {}
  }

  function playIdle() {
    if (!model) return;
    var st = motionState();
    // 已经在播待机就别重开——重开会把动作跳回第一帧，看起来像卡了一下
    var idleGroup = '';
    try { idleGroup = model.internalModel.motionManager.groups.idle; } catch (e) {}
    if (st && st.currentPriority === 1 && idleGroup && st.currentGroup === idleGroup) {
      applyFocus();
      return;
    }
    // 有动作还在占队列就先清干净，否则 IDLE 会被 reserve() 静默拒掉
    if (st && st.currentPriority > 0) stopMotions();
    try {
      var p = model.motion('idle', 0, P().IDLE);
      // motion() 返回的是 Promise，别用 if(!ok) 判断——Promise 永远为真
      if (p && typeof p.then === 'function') p.then(null, function () {});
    } catch (e) {}
    oneShotUntil = 0;
    // 此时已回到待机、不在一次性动作里，道具参数处于静息值，适合采样
    snapshotProps();
    applyFocus();
  }

  function backToIdle() {
    if (!model) return;
    cancelAmbient();        // 收尾时也清掉自动待机定时器，避免和手动动作打架
    stopMotions();
    restoreProps();   // 先把道具参数拨回静息值，锤子/泡泡才会消失
    playIdle();
    scheduleAmbient();      // 回到待机后，过一会儿再自发来一下
  }

  // forced 传 ONESHOTS 里的某一项就播**指定**动作（动作切换条用）；
  // 不传则按权重随机（点她本体时的老行为）。
  function playOneShot(forced) {
    if (!model) return;
    cancelAmbient();   // 手动戳她 / 点动作条 → 立刻打断自动待机节奏

    // 指定动作优先；否则按权重挑，抽中的若动作表里没有就退化为顺序找第一个可用的
    var pick = (forced && hasMotion(forced.name)) ? forced : pickWeighted();

    // 上一次动作还在循环：先掐掉。
    // 否则同名动作会被判「Motion is already playing」直接拒掉，点击就像没反应。
    stopMotions();

    var ms = 3800;
    if (pick) {
      ms = pick.ms;
      try {
        var p = model.motion(pick.name, 0, P().FORCE);
        // 动作文件拉取/解析失败会走 reject。以前是静默吞掉，
        // 表现就是「点了没反应」，现在打到控制台，方便定位是哪个动作坏了。
        if (p && typeof p.then === 'function') {
          p.then(null, function (err) {
            if (window.console) console.warn('[mascot] 动作播放失败：' + pick.name, err);
          });
        }
      } catch (e) {
        if (window.console) console.warn('[mascot] 动作播放异常：' + pick.name, e);
      }
    }

    // 关键：动作不会自己结束，到点自己收尾回待机
    oneShotUntil = Date.now() + ms;
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(backToIdle, ms + 120);
  }

  // ---------- 自动待机动作（放她自己待着时偶尔来一下）----------
  // 她不会干站着：回到待机后每隔一段随机时间，自发做一个轻动作；
  // 约一半概率来一段「玩手机」小剧场——举起手机、举着待机一会儿、
  // 再不定何时收起，正好对应你说的「一直拿着手机、时不时自拍、不定什么时候收了」。
  // 手动戳她 / 点动作条会立刻打断这套自动节奏（cancelAmbient 自增 ambientGen，
  // 让所有挂起的定时器作废，避免和手动动作重叠）。
  var AMBIENT_MOTIONS = ['selfie', 'selfieQuick', 'bubble', 'openLid'];

  function cancelAmbient() {
    ambientGen++;
    if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null; }
    if (phoneHoldTimer) { clearTimeout(phoneHoldTimer); phoneHoldTimer = null; }
    ambientBusy = false;
  }

  function scheduleAmbient() {
    if (reduceMotion) return;                 // 尊重系统「减少动态效果」偏好
    if (ambientTimer) clearTimeout(ambientTimer);
    var delay = 9000 + Math.random() * 16000; // 9~25s 之后再来一下
    ambientTimer = setTimeout(triggerAmbient, delay);
  }

  function triggerAmbient() {
    ambientTimer = null;
    if (!model || mascot.classList.contains('is-hidden') || document.hidden) { scheduleAmbient(); return; }
    if (Date.now() < oneShotUntil) { scheduleAmbient(); return; } // 手动动作进行中，稍后再来
    if (ambientBusy || phoneHoldTimer) { scheduleAmbient(); return; }
    if (!hasMotion('idle')) { scheduleAmbient(); return; }

    if (Math.random() < 0.5) {
      ambientPhoneScene();
    } else {
      var pool = AMBIENT_MOTIONS.filter(function (n) { return hasMotion(n); });
      if (!pool.length) { scheduleAmbient(); return; }
      playAmbientMotion(pool[Math.floor(Math.random() * pool.length)], 0);
    }
  }

  // 播一个待机小动作；holdMs>0 时动作播完先不收道具，举着待机 holdMs 毫秒后再收。
  function playAmbientMotion(name, holdMs) {
    if (!hasMotion(name)) { scheduleAmbient(); return; }
    ambientBusy = true;
    var gen = ambientGen;
    stopMotions();
    try {
      var p = model.motion(name, 0, P().FORCE);
      if (p && typeof p.then === 'function') p.then(null, function () {});
    } catch (e) {}
    var dur = 3200;
    for (var i = 0; i < ONESHOTS.length; i++) {
      if (ONESHOTS[i].name === name) { dur = ONESHOTS[i].ms; break; }
    }
    setTimeout(function () {
      if (gen !== ambientGen) return;   // 已被手动交互打断，挂起定时器作废
      if (!model) return;
      stopMotions();
      if (holdMs > 0) {
        playIdle();                     // 举着道具继续待机（此刻不复位道具参数，让它举着）
        phoneHoldTimer = setTimeout(function () {
          if (gen !== ambientGen) return;
          phoneHoldTimer = null;
          ambientBusy = false;
          restoreProps();               // 收起手机
          playIdle();
          scheduleAmbient();
        }, holdMs);
      } else {
        backToIdle();                   // 播完立刻复位回待机
      }
    }, dur + 120);
  }

  function ambientPhoneScene() {
    var name = (Math.random() < 0.6 ? 'selfie' : 'selfieQuick');
    if (!hasMotion(name)) name = 'selfie';
    var holdMs = 4000 + Math.random() * 7000; // 举着手机 4~11s，不定何时收起
    playAmbientMotion(name, holdMs);
  }

  // 巡检兜底：定时器在后台标签页会被节流/暂停，靠它把卡住的动作收回来
  var watchTimer = null;
  function startIdleWatch() {
    if (watchTimer) return;
    watchTimer = setInterval(function () {
      if (!model || mascot.classList.contains('is-hidden') || document.hidden) return;
      var st = motionState();
      if (!st) return;
      if (st.currentPriority > 1) {
        // 一次性动作早该结束了却还占着队列 → 强制归位
        if (!oneShotUntil || Date.now() > oneShotUntil + 1200) backToIdle();
      } else if (st.currentPriority === 0) {
        playIdle();
      }
    }, 2000);
  }

  function poke() {
    say(nextLine());
    playOneShot();
  }

  // 点透明空气要能穿透到下面的页面，所以 canvas 不吃指针事件；
  // 用全局监听 + 像素 alpha 判断「是否真的点到她身上」。
  function hitTransparent(x, y) {
    if (!app || !app.renderer) return false;
    var gl = app.renderer.gl;
    if (!gl) return false;
    var rect = canvas.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return true;
    var px = Math.round((x - rect.left) * (canvas.width / rect.width));
    var py = Math.round((y - rect.top) * (canvas.height / rect.height));
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return true;
    var buf = new Uint8Array(4);
    try {
      gl.readPixels(px, canvas.height - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    } catch (e) {
      return false;
    }
    return buf[3] <= 8;
  }

  function ensureLoaded() {
    if (loadingPromise) return loadingPromise;
    if (loadingEl) loadingEl.classList.add('show');

    loadingPromise = loadScript(BASE + 'vendor/live2dcubismcore.min.js')
      .then(function () { return loadScript(BASE + 'vendor/pixi.min.js'); })
      .then(function () { return loadScript(BASE + 'vendor/cubism4.min.js'); })
      .then(function () {
        app = new PIXI.Application({
          view: canvas,
          transparent: true,
          backgroundAlpha: 0,
          antialias: true,
          autoDensity: true,
          resolution: Math.min(window.devicePixelRatio || 1, 2),
          preserveDrawingBuffer: true
        });
        // 30fps 足够 Live2D 的呼吸与动作，省电、省 CPU
        app.ticker.maxFPS = 30;
        return PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false });
      })
      .then(function (m) {
        model = m;
        app.stage.addChild(model);
        layout();
        playIdle();
        startIdleWatch();
        scheduleAmbient();   // 放她自己待着时也会偶尔自发做点小动作
        applyFocus();
        if (loadingEl) loadingEl.classList.remove('show');
        mascot.classList.add('is-ready');
        return true;
      })
      .catch(function (err) {
        if (loadingEl) loadingEl.classList.remove('show');
        mascot.classList.add('is-failed');
        if (window.console) console.warn('[mascot] Live2D 加载失败：', err);
        return false;
      });

    return loadingPromise;
  }

  function hideMascot() {
    mascot.classList.add('is-hidden');
    if (bubble) bubble.classList.remove('show');
    if (restoreBtn) restoreBtn.classList.add('show');
    if (app) app.ticker.stop();
    try { localStorage.setItem(KEY, '1'); } catch (err) {}
  }

  function showMascot() {
    mascot.classList.remove('is-hidden');
    if (restoreBtn) restoreBtn.classList.remove('show');
    try {
      localStorage.removeItem(KEY);
      sessionStorage.setItem('mascot-opened', '1');
    } catch (err) {}
    ensureLoaded().then(function (ok) {
      if (ok && app) {
        app.ticker.start();
        playIdle();     // 召回时若动作队列是停的，重新起待机
        applyFocus();
      }
      say('我回来啦～', 2600);
    });
  }

  // ---------- 动作切换条 ----------
  // 点「动作」展开，可单独触发任一动作；「复位」立刻停掉当前动作回待机。
  // 两个用途：
  //   ① 想看某个特定动作时，不用靠随机碰运气；
  //   ② 某个动作播坏了/卡住时，用「复位」把她拽回待机（对治 Loop=true 卡动作的老毛病）。
  function buildActions() {
    if (!actionsList) return;
    ONESHOTS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mascot-action-btn';
      b.textContent = o.label || o.name;
      b.title = o.name + '（约 ' + (o.ms / 1000).toFixed(1) + 's）';
      b.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        ensureLoaded().then(function (ok) { if (ok) playOneShot(o); });
      });
      actionsList.appendChild(b);
    });

    var reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'mascot-action-btn is-reset';
    reset.textContent = '复位';
    reset.title = '立刻停止当前动作，回到待机';
    reset.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!model) return;
      backToIdle();
      say('好啦，回到待机～', 1800);
    });
    actionsList.appendChild(reset);

    // 收起她（区别于 ✕ 关气泡）。隐藏后右下角会出现 🐋 召回按钮。
    var hideBtn = document.createElement('button');
    hideBtn.type = 'button';
    hideBtn.className = 'mascot-action-btn is-hide';
    hideBtn.textContent = '隐藏';
    hideBtn.title = '把吉祥物收起来（右下角 🐋 可召回）';
    hideBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      hideMascot();
    });
    actionsList.appendChild(hideBtn);
  }

  // ---------- 事件 ----------
  if (actionsToggle && actionsEl) {
    actionsToggle.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var open = actionsEl.classList.toggle('open');
      actionsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  buildActions();

  stage.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      ensureLoaded().then(poke);
    }
  });

  document.addEventListener('click', function (e) {
    if (!model || mascot.classList.contains('is-hidden')) return;
    // 动作切换条也要排除——它是捕获阶段监听，按钮自己 stopPropagation 拦不住
    if (e.target && e.target.closest && e.target.closest('.mascot-bubble, .mascot-restore, .mascot-actions')) return;
    if (hitTransparent(e.clientX, e.clientY)) return;
    e.preventDefault();
    e.stopPropagation();
    poke();
  }, true);

  var lastMove = 0;
  document.addEventListener('pointermove', function (e) {
    lastPointer = { x: e.clientX, y: e.clientY };
    if (!model || mascot.classList.contains('is-hidden')) return;
    var now = Date.now();
    if (now - lastMove < 60) return;
    lastMove = now;
    applyFocus();
    var over = !hitTransparent(e.clientX, e.clientY);
    stage.classList.toggle('is-hover', over);
  }, { passive: true });

  // 触屏拖动时也能看过来（pointermove 已覆盖，这里补一个触摸兜底）
  document.addEventListener('touchmove', function (e) {
    var t = e.touches && e.touches[0];
    if (!t) return;
    lastPointer = { x: t.clientX, y: t.clientY };
    if (model && !mascot.classList.contains('is-hidden')) applyFocus();
  }, { passive: true });

  // ✕ 只关闭气泡，**不**隐藏吉祥物。
  // 之前点 ✕ 会整只消失并写 localStorage，还得去右下角点 🐋 召回，很反直觉。
  // 真正要收起她请用动作条里的「隐藏」。
  if (closeBtn) closeBtn.addEventListener('click', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (hideTimer) clearTimeout(hideTimer);
    if (bubble) bubble.classList.remove('show');
  });
  if (restoreBtn) restoreBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    showMascot();
  });

  window.addEventListener('resize', function () {
    if (!model) return;
    layout();
  });

  document.addEventListener('visibilitychange', function () {
    if (!app) return;
    if (document.hidden) app.ticker.stop();
    else if (!mascot.classList.contains('is-hidden')) {
      app.ticker.start();
      // 后台期间定时器可能被节流，动作会卡在那里
      var st = motionState();
      if (st && st.currentPriority > 1) backToIdle();
      applyFocus();
    }
  });

  // ---------- 初始状态 ----------
  var hidden = false;
  var openedThisSession = false;
  try {
    hidden = localStorage.getItem(KEY) === '1';
    openedThisSession = sessionStorage.getItem('mascot-opened') === '1';
  } catch (err) {}
  if (isSmall() && !openedThisSession) hidden = true;

  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (hidden) {
    mascot.classList.add('is-hidden');
    if (restoreBtn) restoreBtn.classList.add('show');
    return;
  }

  // 桌面端：首屏让给正文，空闲后再加载模型
  var kick = function () {
    ensureLoaded().then(function (ok) {
      if (!ok) return;
      var greeted = false;
      try { greeted = sessionStorage.getItem('mascot-greeted') === '1'; } catch (err) {}
      if (!greeted && !reduceMotion) {
        setTimeout(function () {
          say('你好呀，我是鲸鱼娘溟月～ 点我一下试试', 5200);
          try { sessionStorage.setItem('mascot-greeted', '1'); } catch (err) {}
        }, 1200);
      }
    });
  };
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(kick, { timeout: 2600 });
  } else {
    setTimeout(kick, 1600);
  }
})();
