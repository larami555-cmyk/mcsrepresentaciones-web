// Paso de publicación (lo ejecuta Netlify en cada deploy; ver netlify.toml).
//
// Deja HTML ya pintado en las dos páginas que dependían de JavaScript, para que
// Google y los asistentes de IA lean el contenido sin ejecutar nada:
//   1. index.html    -> pinta la app React dentro de <div id="root"> (con jsdom, sin navegador).
//   2. catalogo.html -> escribe las tarjetas de fotos a partir de content/catalogo/*/*.md.
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
async function buildIndex() {
  const { JSDOM, VirtualConsole } = await import("jsdom");
  const src = read("index.html");
  const EMPTY = '<div id="root"></div>';
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
  write("index.html", src.replace(EMPTY, `<div id="root">${html}</div>`));
  console.log(`[static] index.html: portada pintada (${Math.round(html.length / 1024)} KB, h1: "${h1}")`);
}

// ---------------------------------------------------------------- catálogo
const BRANDS = [
  { key: "treku", label: "TREKU", cat: "mueble de diseño" },
  { key: "baixmoduls", label: "BAIXMODULS", cat: "mueble modular" },
  { key: "tobisa", label: "Tobisa", cat: "mueble juvenil" },
  { key: "kingsofa", label: "KingSofá", cat: "sofás" },
  { key: "tapizadosmayor", label: "Tapizados Mayor", cat: "tapicería" },
  { key: "essenzia", label: "Essenzia Dormire", cat: "colchones y descanso" },
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

// ---------------------------------------------------------------- ejecución
let failed = false;
for (const [name, step] of [["portada", buildIndex], ["catálogo", buildCatalog]]) {
  try {
    await step();
  } catch (e) {
    failed = true;
    console.error(`[static] AVISO: no se pudo generar el HTML estático de ${name}: ${e.message}`);
  }
}
if (failed && STRICT) process.exit(1);
