const GITHUB_API = 'https://api.github.com';
const OWNER = 'larami555-cmyk';
const REPO = 'mcsrepresentaciones-web';
const BRANCH = 'main';

const MARCAS_VALIDAS = ['treku', 'baixmoduls', 'tobisa', 'kingsofa', 'tapizadosmayor', 'essenzia'];

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Método no permitido' });
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse(500, { error: 'Falta configurar GITHUB_TOKEN en Netlify' });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return jsonResponse(400, { error: 'JSON inválido' });
  }

  const { password, marca, files } = payload;

  if (!process.env.FOTOS_PASSWORD || password !== process.env.FOTOS_PASSWORD) {
    return jsonResponse(401, { error: 'Contraseña incorrecta' });
  }

  if (!marca || !MARCAS_VALIDAS.includes(marca)) {
    return jsonResponse(400, { error: 'Marca no válida' });
  }

  if (!Array.isArray(files) || files.length === 0) {
    return jsonResponse(400, { error: 'No se han recibido fotografías' });
  }

  const ghHeaders = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };

  try {
    // 1. SHA actual de la rama
    const refRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`, { headers: ghHeaders });
    if (!refRes.ok) throw new Error('No se pudo leer la rama: ' + (await refRes.text()));
    const refData = await refRes.json();
    const latestCommitSha = refData.object.sha;

    // 2. Árbol base del último commit
    const commitRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/commits/${latestCommitSha}`, { headers: ghHeaders });
    if (!commitRes.ok) throw new Error('No se pudo leer el commit base');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Un blob de imagen + un blob de ficha (.md) por cada foto
    const treeItems = [];
    const timestamp = Date.now();

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg';
      const baseName = `foto-${timestamp}-${i}`;
      const imgPath = `images/catalogo/${marca}/${baseName}.${safeExt}`;
      const mdPath = `content/catalogo/${marca}/${baseName}.md`;

      const imgBlobRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({ content: f.base64, encoding: 'base64' })
      });
      if (!imgBlobRes.ok) throw new Error(`Error subiendo ${f.name}: ` + (await imgBlobRes.text()));
      const imgBlob = await imgBlobRes.json();

      const mdContent = `---\nimagen: "/${imgPath}"\nslug: "${baseName}"\n---\n`;
      const mdBlobRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/blobs`, {
        method: 'POST',
        headers: ghHeaders,
        body: JSON.stringify({ content: Buffer.from(mdContent).toString('base64'), encoding: 'base64' })
      });
      if (!mdBlobRes.ok) throw new Error(`Error creando ficha de ${f.name}`);
      const mdBlob = await mdBlobRes.json();

      treeItems.push({ path: imgPath, mode: '100644', type: 'blob', sha: imgBlob.sha });
      treeItems.push({ path: mdPath, mode: '100644', type: 'blob', sha: mdBlob.sha });
    }

    // 4. Árbol nuevo
    const treeRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/trees`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({ base_tree: baseTreeSha, tree: treeItems })
    });
    if (!treeRes.ok) throw new Error('Error creando árbol: ' + (await treeRes.text()));
    const treeData = await treeRes.json();

    // 5. Commit único
    const newCommitRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/commits`, {
      method: 'POST',
      headers: ghHeaders,
      body: JSON.stringify({
        message: `Subida de ${files.length} foto(s) a ${marca} vía panel de fotos`,
        tree: treeData.sha,
        parents: [latestCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Error creando commit: ' + (await newCommitRes.text()));
    const newCommitData = await newCommitRes.json();

    // 6. Mover la rama al nuevo commit (esto dispara UN solo despliegue en Netlify)
    const updateRefRes = await fetch(`${GITHUB_API}/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      method: 'PATCH',
      headers: ghHeaders,
      body: JSON.stringify({ sha: newCommitData.sha })
    });
    if (!updateRefRes.ok) throw new Error('Error actualizando la rama: ' + (await updateRefRes.text()));

    return jsonResponse(200, { ok: true, subidas: files.length });
  } catch (err) {
    return jsonResponse(500, { error: err.message });
  }
};
