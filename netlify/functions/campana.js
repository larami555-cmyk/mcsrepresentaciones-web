// Crea y envía campañas de Brevo desde el móvil (enviar-campana.html).
// Usa FOTOS_PASSWORD (misma clave que el panel de fotos), BREVO_API_KEY y BREVO_LIST_ID.
const crypto = require('crypto');
const SITE = 'https://mcsrepresentaciones.es';
const CAMPANAS = {
  'feria-dia1': {
    name: 'Feria día 1 - Hábitat Valencia 2026',
    subject: 'Primer día en Feria Hábitat Valencia 2026 ¡Acompáñame!',
    previewText: 'Treku y Essenzia Dormire ya te esperan. Te cuento dónde encontrarnos.',
    file: '/email/feria-dia1.html'
  }
};
const SENDER = { name: 'MCS Representaciones', email: 'mcsrepresentaciones@gmail.com' };
const sha = s => crypto.createHash('sha256').update(String(s)).digest();
const json = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });

async function brevo(path, method, key, body) {
  const r = await fetch('https://api.brevo.com/v3' + path, {
    method, headers: { 'api-key': key, 'accept': 'application/json', 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const t = await r.text(); let d = {}; try { d = t ? JSON.parse(t) : {}; } catch (e) { d = { message: t }; }
  if (!r.ok) throw new Error(d.message || ('Brevo ' + r.status));
  return d;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });
  let p; try { p = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'Petición no válida' }); }
  const expected = process.env.FOTOS_PASSWORD || '';
  if (!expected || !crypto.timingSafeEqual(sha(p.password || ''), sha(expected))) {
    await new Promise(r => setTimeout(r, 1200));
    return json(401, { error: 'Contraseña incorrecta' });
  }
  const c = CAMPANAS[p.campana];
  if (!c) return json(400, { error: 'Campaña desconocida' });
  const key = process.env.BREVO_API_KEY, list = Number(process.env.BREVO_LIST_ID);
  if (!key || !list) return json(500, { error: 'Falta configuración de Brevo' });

  try {
    // ¿Ya existe? (evita duplicados y dobles envíos)
    const all = await brevo('/emailCampaigns?type=classic&limit=100&sort=desc', 'GET', key);
    const prev = (all.campaigns || []).find(x => x.name === c.name);
    if (prev && prev.status !== 'draft') return json(200, { ok: true, id: prev.id, status: prev.status, enviada: true });

    if (p.accion === 'estado') return json(200, { ok: true, id: prev ? prev.id : null, status: prev ? 'draft' : null });

    let id = prev && prev.id;
    if (!id) {
      const html = await (await fetch(SITE + c.file + '?v=' + Date.now())).text();
      if (!html.includes('</html>')) throw new Error('No se pudo leer el diseño del correo');
      const r = await brevo('/emailCampaigns', 'POST', key, {
        name: c.name, subject: c.subject, previewText: c.previewText, sender: SENDER,
        htmlContent: html, recipients: { listIds: [list] }
      });
      id = r.id;
    }
    if (p.accion === 'enviar') {
      await brevo(`/emailCampaigns/${id}/sendNow`, 'POST', key);
      return json(200, { ok: true, id, status: 'sent', enviada: true });
    }
    if (p.accion === 'prueba') {
      const to = String(p.emailPrueba || '').trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(400, { error: 'Correo de prueba no válido' });
      await brevo(`/emailCampaigns/${id}/sendTest`, 'POST', key, { emailTo: [to] });
      return json(200, { ok: true, id, status: 'draft', prueba: to });
    }
    return json(200, { ok: true, id, status: 'draft' });
  } catch (e) {
    return json(502, { error: e.message || 'Error con Brevo' });
  }
};
