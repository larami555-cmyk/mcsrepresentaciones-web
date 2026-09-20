/* MCS Representaciones — consentimiento de cookies + Google Analytics 4
   1) Pega tu ID de medición de GA4 en GA_ID (formato G-XXXXXXXXXX).
   2) Con GA_ID vacío no se muestra banner ni se carga nada. */
(function () {
  var GA_ID = "G-BH9P7L30X7"; // ID de medición GA4
  var KEY = "mcsCookieConsent";
  var MAX_AGE = 365 * 24 * 60 * 60 * 1000; // se vuelve a preguntar a los 12 meses

  window.mcsCookiesActive = !!GA_ID;
  if (!GA_ID) return;

  var gl = false;
  try { gl = localStorage.getItem("mcsLang") === "gl"; } catch (e) {}
  var T = gl
    ? { txt: "Usamos cookies de analítica (Google Analytics) para saber como se usa a web. Só se activan se as aceptas.", ok: "Aceptar", no: "Rexeitar", more: "Máis información" }
    : { txt: "Usamos cookies de analítica (Google Analytics) para saber cómo se usa la web. Solo se activan si las aceptas.", ok: "Aceptar", no: "Rechazar", more: "Más información" };

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "null");
      if (v && v.t && Date.now() - v.t < MAX_AGE && (v.c === "granted" || v.c === "denied")) return v.c;
    } catch (e) {}
    return null;
  }
  function save(c) { try { localStorage.setItem(KEY, JSON.stringify({ c: c, t: Date.now() })); } catch (e) {} }

  function loadGA() {
    if (window.__mcsGA) { window["ga-disable-" + GA_ID] = false; return; }
    window.__mcsGA = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "granted" });
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, { allow_google_signals: false, allow_ad_personalization_signals: false });
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
  }
  function removeGA() {
    window["ga-disable-" + GA_ID] = true;
    var host = location.hostname.split(".");
    var domains = [location.hostname, "." + location.hostname];
    if (host.length > 2) domains.push("." + host.slice(-2).join("."));
    document.cookie.split(";").forEach(function (c) {
      var name = c.split("=")[0].trim();
      if (name === "_ga" || name.indexOf("_ga_") === 0 || name === "_gid") {
        domains.forEach(function (d) { document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=" + d; });
        document.cookie = name + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
      }
    });
  }

  function css() {
    if (document.getElementById("mcs-ck-css")) return;
    var st = document.createElement("style");
    st.id = "mcs-ck-css";
    st.textContent =
      "#mcs-ck{position:fixed;left:0;right:0;bottom:0;z-index:2147483647;background:#121212;color:#FAF8F5;padding:16px 20px;font:13px/1.5 Inter,sans-serif;box-shadow:0 -4px 20px rgba(0,0,0,.25)}" +
      "#mcs-ck .in{max-width:1100px;margin:0 auto;display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;justify-content:space-between}" +
      "#mcs-ck p{margin:0;flex:1 1 380px;color:#FAF8F5;font-size:13px}#mcs-ck a{color:#C5A880;text-decoration:underline}" +
      "#mcs-ck .bt{display:flex;gap:10px;flex:0 0 auto}" +
      "#mcs-ck button{cursor:pointer;font:600 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;padding:12px 22px;background:#FAF8F5;color:#121212;border:1px solid #FAF8F5;min-width:112px}" +
      "#mcs-ck button:hover{background:#C5A880;border-color:#C5A880}";
    document.head.appendChild(st);
  }
  function hide() { var b = document.getElementById("mcs-ck"); if (b) b.remove(); }
  function show() {
    hide(); css();
    var b = document.createElement("div");
    b.id = "mcs-ck"; b.setAttribute("role", "dialog"); b.setAttribute("aria-label", "Cookies");
    b.innerHTML = '<div class="in"><p>' + T.txt + ' <a href="./privacidad.html#cookies">' + T.more + '</a></p><div class="bt"><button type="button" data-a="no">' + T.no + '</button><button type="button" data-a="ok">' + T.ok + '</button></div></div>';
    b.addEventListener("click", function (e) {
      var a = e.target && e.target.getAttribute && e.target.getAttribute("data-a");
      if (!a) return;
      if (a === "ok") { save("granted"); loadGA(); } else { save("denied"); removeGA(); }
      hide();
    });
    document.body.appendChild(b);
  }

  window.mcsCookies = { open: show };

  function init() {
    var c = read();
    if (c === "granted") loadGA();
    else if (c === "denied") window["ga-disable-" + GA_ID] = true;
    else show();
    var l = document.getElementById("mcs-ck-open");
    if (l) { l.style.display = "inline"; l.addEventListener("click", function (e) { e.preventDefault(); show(); }); }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
