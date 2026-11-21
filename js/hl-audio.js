/* 回瀾 · 站內音檔（2005 年的站不會有這個檔案，就當它是後來補的） */
(function () {
  "use strict";

  var me = document.currentScript;
  var base = "";
  if (me && me.src) {
    base = me.src.replace(/js\/hl-audio\.js.*$/, "");
  }

  var cache = {};

  function url(name) {
    return base + "assets/audio/web/" + name + ".mp3";
  }

  function get(name) {
    if (!cache[name]) {
      var a = new Audio();
      a.src = url(name);
      a.preload = "auto";
      cache[name] = a;
    }
    return cache[name];
  }

  function once(name, vol, cb) {
    var a = get(name);
    try { a.currentTime = 0; } catch (e) {}
    a.volume = vol === undefined ? 0.8 : vol;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    if (cb) {
      a.onended = function () { cb(); };
    }
    return a;
  }

  function loop(name, vol) {
    var a = get(name);
    a.loop = true;
    a.volume = vol === undefined ? 0.5 : vol;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    return {
      audio: a,
      stop: function () {
        a.pause();
        try { a.currentTime = 0; } catch (e) {}
      },
      setVolume: function (v) { a.volume = v; }
    };
  }

  function playAt(name, start, dur, vol) {
    var a = get(name);
    a.loop = false;
    a.volume = vol === undefined ? 0.8 : vol;
    var stopAt = function () {
      if (a.currentTime >= start + dur) {
        a.pause();
        a.removeEventListener("timeupdate", stopAt);
      }
    };
    a.addEventListener("timeupdate", stopAt);
    a.currentTime = start;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    return a;
  }

  /* ---------- 頁面環境音：<body data-amb="e04_sea_low"> ---------- */
  function initAmbience() {
    var name = document.body.getAttribute("data-amb");
    if (!name) return;
    var foot = document.querySelector(".foot");
    if (!foot) return;

    var wrap = document.createElement("div");
    wrap.className = "small";
    wrap.style.marginTop = "7px";
    var btn = document.createElement("span");
    btn.className = "amb";
    btn.textContent = "♪ 環境音：關";
    wrap.appendChild(btn);
    foot.appendChild(wrap);

    var handle = null;
    btn.addEventListener("click", function () {
      if (!handle) {
        handle = loop(name, parseFloat(document.body.getAttribute("data-amb-vol") || "0.38"));
        btn.className = "amb on";
        btn.textContent = "♪ 環境音：開";
      } else {
        handle.stop();
        handle = null;
        btn.className = "amb";
        btn.textContent = "♪ 環境音：關";
      }
    });
  }

  window.HL = {
    once: once,
    loop: loop,
    playAt: playAt,
    url: url
  };

  if (document.body) initAmbience();
})();
