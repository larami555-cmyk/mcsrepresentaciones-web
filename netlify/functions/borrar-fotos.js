// Lista y borra fotos/vídeos/PDF/comentarios subidos desde el panel (subir-fotos.html).
const crypto = require('crypto');
const GITHUB_API = 'https://api.github.com';
const OWNER = 'larami555-cmyk', REPO = 'mcsrepresentaciones-web', BRANCH = 'main';
const MARCAS = ['treku', 'baixmoduls', 'tobisa', 'kingsofa', 'tapizadosmayor', 'essenzia', 'feria'];
const SLUG = /^(foto|video|doc|nota)-\d+-\d+$/;
const json = (c, o) => ({ statusCode: c, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(o) });
const sha = x => crypto.createHash('sha256').update(String(x)).digest();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  const token = process.env.GITHUB_TOKEN;
  if (!token) return json(500, { error: 'Falta GITHUB_TOKEN en Netlify' });
  let p; try { p = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'JSON inválido' }); }
  const expected = process.env.FOTOS_PASSWORD || '';
  if (expected.length < 10 || !crypto.timingSafeEqual(sha(p.password || ''), sha(expected))) {
    await new Promise(r => setTimeout(r, 1200));
    return json(401, { error: 'Contraseña incorrecta' });
  }
  if (!MARCAS.includes(p.marca)) return json(400, { error: 'Marca no válida' });
  const gh = { Authorization: `token ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' };
  const call = async (path, opt) => {
    const r = await fetch(GITHUB_API + `/repos/${OWNER}/${REPO}` + path, Object.assign({ headers: gh }, opt || {}));
    if (!r.ok) throw new Error(`GitHub ${r.status}: ` + (await r.text()).slice(0, 200));
    return r.json();
  };

  try {
    const ref = await call(`/git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const commit = await call(`/git/commits/${head}`);
    const tree = await call(`/git/trees/${commit.tree.sha}?recursive=1`);
    const paths = tree.tree.filter(t => t.type === 'blob').map(t => t.path);
    const mdDir = `content/catalogo/${p.marca}/`;
    const mediaOf = slug => paths.filter(x =>
      x.startsWith(`images/catalogo/${p.marca}/${slug}.`) || (p.marca === 'feria' && x.startsWith(`documentos/feria/${slug}.`)));

    if (p.accion === 'listar') {
      const items = [];
      for (const x of paths) {
        if (!x.startsWith(mdDir) || !x.endsWith('.md')) continue;
        const slug = x.slice(mdDir.length, -3);
        if (!SLUG.test(slug)) continue;
        const it = { slug, tipo: slug.split('-')[0], ts: Number(slug.split('-')[1]), media: mediaOf(slug)[0] || null };
        if (it.tipo === 'nota') {
          try {
            const f = await call(`/contents/${x}?ref=${head}`);
            it.texto = Buffer.from(f.content, 'base64').toString('utf8').replace(/^---[\s\S]*?---\s*/, '').trim().slice(0, 300);
          } catch (e) { it.texto = ''; }
        }
        items.push(it);
      }
      items.sort((a, b) => b.ts - a.ts);
      return json(200, { ok: true, items });
    }

    if (p.accion === 'borrar') {
      const slugs = (Array.isArray(p.slugs) ? p.slugs : []).filter(s => SLUG.test(s)).slice(0, 50);
      if (!slugs.length) return json(400, { error: 'Nada que borrar' });
      const borrar = [];
      for (const s of slugs) {
        const md = `${mdDir}${s}.md`;
        if (paths.includes(md)) borrar.push(md);
        borrar.push(...mediaOf(s));
      }
      if (!borrar.length) return json(404, { error: 'No se encontró el archivo (puede que ya esté borrado)' });
      const nt = await call('/git/trees', { method: 'POST', body: JSON.stringify({
        base_tree: commit.tree.sha, tree: borrar.map(path => ({ path, mode: '100644', type: 'blob', sha: null })) }) });
      const nc = await call('/git/commits', { method: 'POST', body: JSON.stringify({
        message: `Borrado de ${slugs.length} archivo(s) de ${p.marca} vía panel de fotos`, tree: nt.sha, parents: [head] }) });
      await call(`/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: nc.sha }) });
      return json(200, { ok: true, borrados: slugs.length });
    }
    return json(400, { error: 'Acción no válida' });
  } catch (e) {
    return json(500, { error: e.message });
  }
};
