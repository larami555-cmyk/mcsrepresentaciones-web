// Paso de publicación (lo ejecuta Netlify en cada deploy; ver netlify.toml).
//
// Deja HTML ya pintado en las dos páginas que dependían de JavaScript, para que
// Google y los asistentes de IA lean el contenido sin ejecutar nada:
//   1. index.html    -> pinta la app React dentro de <div id="root"> (con jsdom, sin navegador).
//   2. catalogo.html -> escribe las tarjetas de fotos a partir de content/catalogo/*/*.md.
//   3. /gl/           -> versión en gallego con dirección propia de la portada, el catálogo,
//                        las páginas de marca y los artículos, a partir de los textos data-gl
//                        que ya llevan las páginas. Añade hreflang es/gl y las URLs al sitemap.
//
// Los archivos del repositorio NO cambian: solo se modifica la copia que publica Netlify.
// Si un paso falla, la página se publica como estaba (sigue funcionando con JavaScript).
// En las vistas previas de un pull request el fallo sí detiene el deploy, para verlo a tiempo.
//
// Probar en local:  npm install && node scripts/build-static.mjs   (y después `git checkout index.html catalogo.html`)

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STRICT = process.env.CONTEXT === "deploy-preview" || process.argv.includes("--strict");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => fs.writeFileSync(path.join(ROOT, f), s);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// ---------------------------------------------------------------- portada
const EMPTY_ROOT = '<div id="root"></div>';
let INDEX_SRC = null; // index.html original, para pintar también la versión en gallego

async function renderApp(src, lang) {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const EMPTY = EMPTY_ROOT;
  if (!src.includes(EMPTY)) throw new Error('index.html: no encuentro <div id="root"></div> vacío');

  // Solo se ejecuta la app (el <script type="module">); el resto de scripts no hace falta para pintar.
  const m = src.match(/<script type="module">([\s\S]*?)<\/script>\s*(?=<script>|<\/body>)/);
  if (!m) throw new Error("index.html: no encuentro el script de la app");
  const head = src.slice(0, src.indexOf("</head>")).replace(/<script[\s\S]*?<\/script>/g, "");
  const page = `${head}</head><body>${EMPTY}<script>${m[1]}</script></body></html>`;

  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => errors.push(String(e.message || e).slice(0, 300)));
  const dom = new JSDOM(page, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    url: "https://mcsrepresentaciones.es/",
    virtualConsole: vc,
    beforeParse(w) {
      const noop = () => {};
      w.matchMedia = () => ({ matches: false, addListener: noop, removeListener: noop, addEventListener: noop, removeEventListener: noop });
      w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
      w.scrollTo = noop;
      try { w.localStorage.setItem("mcsLang", lang); } catch {}
    },
  });
  await new Promise((r) => setTimeout(r, 1500));
  const root = dom.window.document.getElementById("root");
  const first = root.firstElementChild;
  const h1 = root.querySelector("h1")?.textContent.trim();
  const ids = ["inicio", "quien-soy", "marcas", "servicios", "novedades", "contacto"].filter((i) => !root.querySelector("#" + i));
  if (errors.length) throw new Error("index.html: error al pintar: " + errors[0]);
  if (!first || !h1 || ids.length) throw new Error(`index.html: el pintado salió incompleto (h1: ${h1}; faltan: ${ids.join(", ")})`);

  // Marca para que los scripts de animación y de anclas esperen a que React sustituya este HTML.
  first.setAttribute("data-static", "1");
  const html = root.innerHTML;
  dom.window.close();
  return { html, h1 };
}

async function buildIndex() {
  const src = read("index.html");
  const { html, h1 } = await renderApp(src, "es");
  INDEX_SRC = src;
  write("index.html", src.replace(EMPTY_ROOT, `<div id="root">${html}</div>`));
  console.log(`[static] index.html: portada pintada (${Math.round(html.length / 1024)} KB, h1: "${h1}")`);
}

// ---------------------------------------------------------------- catálogo
const BRANDS = [
  { key: "treku", label: "TREKU", cat: "mueble de diseño", catGl: "moble de deseño" },
  { key: "baixmoduls", label: "BAIXMODULS", cat: "mueble modular", catGl: "moble modular" },
  { key: "tobisa", label: "Tobisa", cat: "mueble juvenil", catGl: "moble xuvenil" },
  { key: "kingsofa", label: "KingSofá", cat: "sofás", catGl: "sofás" },
  { key: "tapizadosmayor", label: "Tapizados Mayor", cat: "tapicería", catGl: "tapicería" },
  { key: "essenzia", label: "Essenzia Dormire", cat: "colchones y descanso", catGl: "colchóns e descanso" },
];

function frontmatter(text) {
  const m = text.match(/^---\s*([\s\S]*?)\s*---/);
  const data = {};
  if (m) for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > -1) data[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
  return data;
}

function buildCatalog() {
  const src = read("catalogo.html");
  const EMPTY = '<div id="grid" class="grid"></div>';
  if (!src.includes(EMPTY)) throw new Error("catalogo.html: no encuentro la rejilla vacía");
  const items = [];
  for (const b of BRANDS) {
    const dir = path.join(ROOT, "content/catalogo", b.key);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
      const d = frontmatter(fs.readFileSync(path.join(dir, f), "utf8"));
      if (!d.imagen && !d.video) continue;
      const t = f.match(/-(\d+)-(\d+)\.md$/);
      items.push({ b, imagen: d.imagen, video: d.video, ts: t ? Number(t[1]) : 0, n: t ? Number(t[2]) : 0 });
    }
  }
  if (!items.length) throw new Error("catalogo.html: no hay fotos en content/catalogo");
  items.sort((a, b) => b.ts - a.ts || b.n - a.n); // más reciente primero
  const cards = items.map((it, i) => {
    const alt = `${it.b.label}: ${it.b.cat} para tiendas en Galicia`;
    const media = it.video
      ? `<video src="${esc(it.video)}#t=0.1" controls playsinline preload="metadata"></video>`
      : `<img src="${esc(it.imagen)}" alt="${esc(alt)}" width="480" height="440" ${i < 4 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async" />`;
    return `<div class="card" data-brand="${it.b.key}">${media}<div class="label">${esc(it.b.label)}</div></div>`;
  });
  write("catalogo.html", src.replace(EMPTY, `<div id="grid" class="grid" data-static="1">\n${cards.join("\n")}\n</div>`));
  console.log(`[static] catalogo.html: ${cards.length} tarjetas escritas`);
}

// ---------------------------------------------------------------- gallego (/gl/)
const SITE = "https://mcsrepresentaciones.es";
const GL_PAGES = [
  "catalogo.html",
  "treku-galicia.html", "baixmoduls-galicia.html", "tobisa-galicia.html", "essenzia-dormire-galicia.html",
  "sweetbedding-galicia.html", "tapizados-mayor-galicia.html", "kingsofa-galicia.html",
  "normativa-mueble.html", "guia-tejidos-naturales.html", "novedad-sweetbedding.html",
  "feria-habitat-2026.html", "balance-feria-habitat-2026.html",
];
const GL_INDEX = {
  title: "MCS Representaciones | Mobles, tapicería e descanso en Galicia",
  desc: "Axente comercial de mobiliario, tapicería e descanso en Galicia para tendas. Treku, Baixmoduls, Tobisa, Essenzia Dormire, SweetBedding, Tapizados Mayor e KingSofá.",
};
const esUrl = (f) => SITE + "/" + (f === "index.html" ? "" : f);
const glUrl = (f) => SITE + "/gl/" + (f === "index.html" ? "" : f);
// Fija el gallego antes de que arranque nada: la app y los scripts de cada página leen localStorage.mcsLang.
const FORCE_GL = '<script>try{localStorage.setItem("mcsLang","gl")}catch(e){}</script>';

function setMeta(doc, sel, value) {
  doc.querySelectorAll(sel).forEach((el) => el.setAttribute("content", value));
}

// Convierte un documento ya cargado en su versión gallega (cabecera, enlaces internos, idioma).
function toGalician(doc, file, title, desc, glSet) {
  doc.documentElement.lang = "gl";
  if (title) {
    doc.title = title;
    setMeta(doc, 'meta[property="og:title"], meta[name="twitter:title"]', title);
  }
  if (desc) setMeta(doc, 'meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', desc);
  setMeta(doc, 'meta[property="og:url"]', glUrl(file));
  setMeta(doc, 'meta[property="og:locale"]', "gl_ES");
  const canon = doc.querySelector('link[rel="canonical"]');
  if (canon) canon.setAttribute("href", glUrl(file));
  // Enlaces internos absolutos: llevan a la versión gallega cuando existe.
  doc.querySelectorAll("a[href^='/']").forEach((a) => {
    const href = a.getAttribute("href");
    if (href.startsWith("//") || href.startsWith("/gl/")) return;
    const [p, hash = ""] = href.split("#");
    const h = hash ? "#" + hash : "";
    if (p === "/" || p === "/index.html") a.setAttribute("href", "/gl/" + h);
    else if (glSet.has(p.slice(1))) a.setAttribute("href", "/gl" + p + h);
  });
  doc.head.insertAdjacentHTML("afterbegin", FORCE_GL);
}

function hreflang(file) {
  return `<link rel="alternate" hreflang="es" href="${esUrl(file)}">\n<link rel="alternate" hreflang="gl" href="${glUrl(file)}">\n<link rel="alternate" hreflang="x-default" href="${esUrl(file)}">\n`;
}

async function buildGalician() {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  fs.mkdirSync(path.join(ROOT, "gl"), { recursive: true });
  const glSet = new Set(["index.html", ...GL_PAGES.filter((f) => fs.existsSync(path.join(ROOT, f)))]);
  const done = [];

  // --- portada
  if (!INDEX_SRC) throw new Error("gl: la portada en castellano no se generó, no hay base para la gallega");
  {
    const { html, h1 } = await renderApp(INDEX_SRC, "gl");
    const dom = new JSDOM(INDEX_SRC.replace(EMPTY_ROOT, '<div id="root"><!--GLROOT--></div>'), { virtualConsole: new VirtualConsole() });
    const doc = dom.window.document;
    toGalician(doc, "index.html", GL_INDEX.title, GL_INDEX.desc, glSet);
    // "Castellano" en /gl/ lleva a la portada en castellano (si no, la dirección /gl/ mostraría castellano).
    doc.body.insertAdjacentHTML("beforeend", '<script>document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("button");if(b&&b.textContent.trim()==="Castellano"){e.stopPropagation();try{localStorage.setItem("mcsLang","es")}catch(x){}location.href="/"+location.hash}},true);</script>');
    write("gl/index.html", dom.serialize().replace("<!--GLROOT-->", html));
    dom.window.close();
    done.push("index.html");
    console.log(`[static] gl/index.html: portada en gallego (h1: "${h1}")`);
  }

  // --- resto de páginas: aplicar los textos data-gl
  for (const file of GL_PAGES) {
    if (!glSet.has(file)) continue;
    const src = read(file);
    const dom = new JSDOM(src, { virtualConsole: new VirtualConsole() }); // sin avisos de CSS en el log
    const doc = dom.window.document;
    // Se aplica el texto gallego y se retira el atributo, para que el script de la página no lo vuelva a pisar.
    doc.querySelectorAll("[data-gl]").forEach((el) => { el.innerHTML = el.getAttribute("data-gl"); el.removeAttribute("data-gl"); el.removeAttribute("data-es"); });
    const t = src.match(/document\.title\s*=\s*("(?:[^"\\]|\\.)*")/);
    const d = doc.querySelector('meta[name="description"]')?.getAttribute("data-gl-content");
    toGalician(doc, file, t ? JSON.parse(t[1]) : null, d, glSet);
    if (file === "catalogo.html") {
      for (const b of BRANDS) doc.querySelectorAll(`.card[data-brand="${b.key}"] img`).forEach((img) => img.setAttribute("alt", `${b.label}: ${b.catGl} para tendas en Galicia`));
    }
    write("gl/" + file, dom.serialize());
    dom.window.close();
    done.push(file);
  }

  // --- hreflang recíproco en las dos versiones, y direcciones gallegas en el sitemap
  for (const file of done) {
    for (const f of [file, "gl/" + file]) write(f, read(f).replace("</head>", hreflang(file) + "</head>"));
  }
  const today = new Date().toISOString().slice(0, 10);
  const urls = done.map((f) => `  <url><loc>${glUrl(f)}</loc><lastmod>${today}</lastmod></url>\n`).join("");
  write("sitemap.xml", read("sitemap.xml").replace("</urlset>", urls + "</urlset>"));
  // En la portada en castellano, "Galego" lleva a /gl/.
  write("index.html", read("index.html").replace("</body>", '<script>document.addEventListener("click",function(e){var b=e.target.closest&&e.target.closest("button");if(b&&b.textContent.trim()==="Galego"){e.stopPropagation();try{localStorage.setItem("mcsLang","gl")}catch(x){}location.href="/gl/"+location.hash}},true);</script>\n</body>'));
  console.log(`[static] gl/: ${done.length} páginas en gallego, con hreflang y sitemap`);
}

// ---------------------------------------------------------------- ejecución
let failed = false;
for (const [name, step] of [["portada", buildIndex], ["catálogo", buildCatalog], ["versión en gallego", buildGalician]]) {
  try {
    await step();
  } catch (e) {
    failed = true;
    console.error(`[static] AVISO: no se pudo generar ${name}: ${e.message}`);
  }
}
if (failed && STRICT) process.exit(1);
