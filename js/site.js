/* 回岸音檔修復工作室 · 站務脚本 */
(function () {
  "use strict";

  /* ---------- 訪客計數器 ---------- */
  var el = document.getElementById("visits");
  if (el) {
    var n = parseInt(localStorage.getItem("hl_visits") || "7", 10);
    if (isNaN(n)) n = 7;
    el.textContent = ("000" + n).slice(-4);
    localStorage.setItem("hl_visits", String(n + 1));
  }

  /* ---------- 委託單：記住名字（不提示、不驗證） ---------- */
  var form = document.getElementById("orderForm");
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (document.getElementById("nm") || {}).value || "";
      localStorage.setItem("hl_name", name.trim());
      var box = document.getElementById("orderDone");
      if (box) {
        box.innerHTML =
          '<div class="notice">委託單已送出。<br>' +
          "我們會盡快與您聯絡，請保持電話暢通。</div>";
        box.style.display = "block";
        form.style.display = "none";
      }
    });
  }

  /* ---------- 留言板 ---------- */
  var gb = document.getElementById("gbForm");
  if (gb) {
    var nameInput = document.getElementById("gbName");
    if (nameInput) {
      var saved = localStorage.getItem("hl_name");
      if (saved) nameInput.value = saved;
    }
    gb.addEventListener("submit", function (e) {
      e.preventDefault();
      var msg = (document.getElementById("gbMsg") || {}).value || "";
      if (!msg.trim()) return;
      localStorage.setItem("hl_msg", msg);
      localStorage.setItem("hl_msg_time", new Date().toString());
      var done = document.getElementById("gbDone");
      if (done) done.style.display = "block";
      gb.style.display = "none";
    });
  }

  /* ---------- 「原始檔」連結 ---------- */
  var viewer = window.HL_VIEWER || "viewer.html";
  document.querySelectorAll("a.src").forEach(function (a) {
    a.addEventListener("click", function (e) {
      e.preventDefault();
      var f = a.getAttribute("data-src") || "";
      window.open(viewer + "?f=" + encodeURIComponent(f), "_blank");
    });
  });
})();
