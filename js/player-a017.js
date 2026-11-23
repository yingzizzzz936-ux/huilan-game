/* A-017 試聽：真音檔 + 假降噪。
   4.76：原始帶（含底噪），滑桿控制低通與額外底噪；100% 切「修復版」。
   2.4：切到離線半速母帶（v01_half.mp3／v01_half_clean.mp3），時間軸 80 秒。
   半速不再用瀏覽器 playbackRate 即時拉伸，避免尾音的金屬感。 */
(function () {
  "use strict";

  var btn = document.getElementById("playBtn");
  if (!btn || !window.HL) return;

  var slider = document.getElementById("denoise");
  var dnval = document.getElementById("dnval");
  var timeEl = document.getElementById("time");
  var totalEl = document.getElementById("total");
  var barEl = document.getElementById("bar");
  var subEl = document.getElementById("subtitle");
  var noteEl = document.getElementById("dnnote");

  var DUR_RAW = 40.0;
  var DUR_CLEAN = 39.2;
  var DUR_RAW_HALF = 80.0;
  var DUR_CLEAN_HALF = 78.4;

  var raw = new Audio(HL.url("v01_akizuki_a017"));
  var clean = new Audio(HL.url("v01_akizuki_a017_clean"));
  var rawHalf = new Audio(HL.url("v01_half"));
  var cleanHalf = new Audio(HL.url("v01_half_clean"));
  [raw, clean, rawHalf, cleanHalf].forEach(function (a) {
    a.preload = "auto";
    a.volume = 1;
  });

  var playing = false;
  var usingClean = false;
  var half = false;
  var breath = null;
  var startedAt = 0;      // 第一次播放的 timestamp，用來算停留
  var dwellBase = 0;

  var ctx = null;
  var srcNodes = [];
  var rawGain = null, rawLP = null, hissGain = null, hissSrc = null;

  var SUBS_RAW = [
    [0, 5, "（帶子轉動聲。底噪很重。）"],
    [5, 8, "前面六卷你都修好了。"],
    [8, 12, ""],
    [12, 15, "第七卷是空的，我知道。"],
    [15, 18, ""],
    [18, 23.6, "第七卷本來就該是空的，因為第七卷錄的是——還沒發生的事。"],
    [23.6, 30, "（長長的停頓。底噪裡有一個呼吸。）"],
    [30, 33, "你聽。"],
    [33, 40.1, "（帶子斷了）"]
  ];
  var SUBS_CLEAN = [
    [0, 5, "（帶子轉動聲。底噪很重。）"],
    [5, 8, "前面六卷你都修好了。"],
    [8, 12, ""],
    [12, 15, "第七卷是空的，我知道。"],
    [15, 18, ""],
    [18, 23.6, "第七卷本來就該是空的，因為第七卷錄的是——還沒發生的事。"],
    [23.6, 30, "（長長的停頓。）"],
    [30, 33, "你聽。"],
    [33, 36.6, "（帶子沒有斷。）"],
    [36.6, 39.3, "（房間另一頭，有一個人呼吸。）"]
  ];

  function fmt(s) {
    s = Math.max(0, s);
    var m = Math.floor(s / 60);
    var r = s - m * 60;
    return m + ":" + (r < 10 ? "0" : "") + r.toFixed(1);
  }

  function timelineDur() {
    if (usingClean) return half ? DUR_CLEAN_HALF : DUR_CLEAN;
    return half ? DUR_RAW_HALF : DUR_RAW;
  }

  function active() {
    if (usingClean) return half ? cleanHalf : clean;
    return half ? rawHalf : raw;
  }

  function initAudioGraph() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (location.protocol === "file:") { ctx = null; return; }
    try {
      ctx = new AC();
      rawLP = ctx.createBiquadFilter();
      rawLP.type = "lowpass";
      rawLP.frequency.value = 4000;
      rawLP.Q.value = 0.7;
      rawGain = ctx.createGain();
      rawGain.gain.value = 1.0;
      rawLP.connect(rawGain);
      rawGain.connect(ctx.destination);

      // 四卷共用同一組低通／增益；每卷只能建立一次 MediaElementSource。
      srcNodes = [raw, clean, rawHalf, cleanHalf].map(function (el) {
        var node = ctx.createMediaElementSource(el);
        node.connect(rawLP);
        return node;
      });

      // 額外底噪：滑桿越低越明顯
      var len = Math.floor(ctx.sampleRate * 2.5);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.6;
      hissSrc = ctx.createBufferSource();
      hissSrc.buffer = buf;
      hissSrc.loop = true;
      var hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 700;
      hissGain = ctx.createGain();
      hissGain.gain.value = 0.06;
      hissSrc.connect(hp);
      hp.connect(hissGain);
      hissGain.connect(ctx.destination);
      hissSrc.start();
    } catch (e) {
      ctx = null;
    }
  }

  function applyDenoise() {
    var d = parseInt(slider.value, 10) / 100;
    dnval.textContent = slider.value + "%";
    if (ctx && rawLP) {
      rawLP.frequency.setTargetAtTime(1600 + 7000 * d, ctx.currentTime, 0.08);
    }
    if (hissGain && ctx) {
      hissGain.gain.setTargetAtTime(0.075 * Math.pow(1 - d, 1.6) * (usingClean ? 0 : 1), ctx.currentTime, 0.1);
    }
    if (d >= 0.99 && !usingClean) switchToClean();
  }

  function switchToClean() {
    if (usingClean) return;
    var from = half ? rawHalf : raw;
    var to = half ? cleanHalf : clean;
    var t = from.currentTime;

    // 原始帶 33.0–33.8（半速時 66.0–67.6）是被剪掉的缺口。
    // 切到修復版時要把這段扣掉，否則時間軸會往前跳。
    var gapStart = half ? 66.0 : 33.0;
    var gapEnd = half ? 67.6 : 33.8;
    var gap = half ? 1.6 : 0.8;
    var cleanT;
    if (t < gapStart) cleanT = t;
    else if (t < gapEnd) cleanT = gapStart;
    else cleanT = t - gap;

    usingClean = true;
    from.pause();
    to.currentTime = Math.max(0, Math.min(cleanT, timelineDur() - 0.1));
    if (playing) {
      var p = to.play();
      if (p && p.catch) p.catch(function () {});
    }
    if (hissGain && ctx) hissGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    totalEl.textContent = fmt(timelineDur());
    timeEl.textContent = fmt(to.currentTime);
    barEl.style.width = Math.min(100, (to.currentTime / timelineDur()) * 100) + "%";
    slider.disabled = true;
    slider.style.opacity = "0.45";
    if (noteEl) {
      noteEl.innerHTML = '已修復 0.8 秒底噪。無法還原。　<span class="gray">（缺口在 <a href="../sys/restore.html">這裡</a>）</span>';
    }
  }

  function showSub(t) {
    if (half) return;
    var subs = usingClean ? SUBS_CLEAN : SUBS_RAW;
    var line = null;
    for (var i = 0; i < subs.length; i++) {
      if (t >= subs[i][0] && t < subs[i][1]) { line = subs[i][2]; break; }
    }
    if (line === subEl.dataset.line) return;
    subEl.dataset.line = line;
    if (line) subEl.textContent = line;
    else subEl.innerHTML = '<span class="gray">（……）</span>';
  }

  function tick() {
    var a = active();
    if (playing) {
      var dur = timelineDur();
      var t = a.currentTime;
      if (t >= dur) { finish(); return; }
      timeEl.textContent = fmt(t);
      barEl.style.width = Math.min(100, (t / dur) * 100) + "%";
      showSub(t);
    }
    requestAnimationFrame(tick);
  }

  function startBreath() {
    if (breath) return;
    var base = 0.025 + Math.min(1, dwellBase / 420) * 0.09;
    breath = HL.loop("v07_breath_loop", base);
    breath.base = base;
    breath.timer = setInterval(function () {
      if (!breath || !playing) return;
      var live = (Date.now() - startedAt) / 1000;
      breath.setVolume(Math.min(0.18, breath.base + live / 40 * 0.06));
    }, 2000);
  }

  function stopBreath() {
    if (breath) {
      clearInterval(breath.timer);
      breath.stop();
      breath = null;
    }
  }

  function play() {
    if (!ctx) initAudioGraph();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
    }
    applyDenoise();
    var a = active();
    var dur = timelineDur();
    if (a.currentTime >= dur - 0.05) a.currentTime = 0;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    playing = true;
    if (half) startHalfSeq();
    try { localStorage.setItem("hl_k_tape", "1"); } catch (e) {}
    btn.textContent = "❚❚";
    if (!startedAt) startedAt = Date.now();
    startBreath();
    requestAnimationFrame(tick);
  }

  function pause() {
    active().pause();
    playing = false;
    btn.textContent = "▶";
    stopHalfSeq();
    stopBreath();
  }

  function finish() {
    pause();
    dwellBase += (Date.now() - startedAt) / 1000;
    startedAt = 0;
    timeEl.textContent = fmt(timelineDur());
    barEl.style.width = "100%";
    subEl.innerHTML = '<span class="gray">（播放結束）</span>';
    subEl.dataset.line = "__end__";
  }

  btn.addEventListener("click", function () {
    if (playing) {
      pause();
      if (startedAt) { dwellBase += (Date.now() - startedAt) / 1000; startedAt = 0; }
    } else {
      play();
    }
  });

  slider.addEventListener("input", applyDenoise);
  slider.addEventListener("change", applyDenoise);

  [raw, clean, rawHalf, cleanHalf].forEach(function (el) {
    el.addEventListener("ended", function () {
      if (playing && el === active()) finish();
    });
  });

  dnval.textContent = slider.value + "%";
  totalEl.textContent = "0:40.0";
  applyDenoise();

  /* ---------- 轉速：4.76 / 2.4 ---------- */
  var halfTimer = null, halfStage = 0;
  var sp476 = document.getElementById("sp476");
  var sp24  = document.getElementById("sp24");

  function stopHalfSeq() {
    if (halfTimer) {
      clearInterval(halfTimer);
      halfTimer = null;
    }
  }

  function startHalfSeq() {
    stopHalfSeq();
    halfStage = 0;
    subEl.dataset.line = "__half__";
    subEl.innerHTML = '<span class="gray">（轉速慢了。聲音被拉長，像從水底傳上來。）</span>';
    halfTimer = setInterval(function () {
      if (!playing) return;
      halfStage++;
      if (halfStage === 1) subEl.innerHTML = '<span class="gray">（……）</span>';
      if (halfStage === 2) subEl.textContent = "（有人在數。）";
      if (halfStage === 3) subEl.textContent = "一。二。三。四。五。六。";
      if (halfStage === 4) subEl.textContent = "你終於慢下來了。";
      if (halfStage === 5) {
        subEl.innerHTML = '<span class="gray">（這句話不在轉錄稿上。）</span>';
        try { localStorage.setItem("hl_k_speed", "1"); } catch (e) {}
        stopHalfSeq();
      }
    }, 3000);
  }

  function setSpeed(isHalf) {
    if (half === isHalf) return;

    var wasPlaying = playing;
    var oldTime = active().currentTime;

    if (wasPlaying) pause();

    half = isHalf;
    var a = active();
    var mapped = isHalf ? oldTime * 2 : oldTime / 2;
    a.currentTime = Math.max(0, Math.min(mapped, timelineDur() - 0.1));

    if (sp476 && sp24) {
      sp476.className = "tsw" + (half ? "" : " on");
      sp24.className  = "tsw" + (half ? " on" : "");
    }

    totalEl.textContent = fmt(timelineDur());
    timeEl.textContent = fmt(a.currentTime);
    barEl.style.width = Math.min(100, (a.currentTime / timelineDur()) * 100) + "%";

    if (half) {
      // 只清掉舊序列；真正啟動留到 play()，避免未播放就跳第一句。
      stopHalfSeq();
    } else {
      stopHalfSeq();
      subEl.dataset.line = "";
      subEl.innerHTML = '<span class="gray">（轉速正常。）</span>';
    }

    if (wasPlaying) play();
  }

  if (sp476 && sp24) {
    sp476.addEventListener("click", function () { setSpeed(false); });
    sp24.addEventListener("click", function () { setSpeed(true); });
  }
})();
