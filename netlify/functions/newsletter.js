// Alta en la newsletter con doble confirmación (Brevo).
// Variables de entorno en Netlify: BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID
const { getStore } = require('@netlify/blobs');

const SITE = 'https://mcsrepresentaciones.es';
const MAX_PER_IP_HOUR = 5;      // intentos por IP y hora
const MAX_PER_DAY = 300;        // intentos totales al día (evita el uso abusivo del envío de confirmaciones)

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}

// Límite de intentos con Netlify Blobs. Si Blobs falla, no se bloquea el alta.
async function rateLimit(ip) {
  try {
    const store = getStore({ name: 'newsletter-limits', siteID: '0b92cef2-4cc9-4f80-b0da-4dcb41ee07b4', token: process.env.BLOBS_ACCESS_TOKEN });
    const now = Date.now();
    const hourKey = 'ip-' + String(ip || 'x').replace(/[^0-9a-fA-F:.]/g, '').slice(0, 45) + '-' + Math.floor(now / 3600000);
    const dayKey = 'day-' + Math.floor(now / 86400000);
    const [h, d] = await Promise.all([store.get(hourKey, { type: 'json' }), store.get(dayKey, { type: 'json' })]);
    const hc = (h && h.n) || 0, dc = (d && d.n) || 0;
    if (hc >= MAX_PER_IP_HOUR || dc >= MAX_PER_DAY) return false;
    await Promise.all([store.setJSON(hourKey, { n: hc + 1 }), store.setJSON(dayKey, { n: dc + 1 })]);
    return true;
  } catch (e) {
    console.error('rateLimit:', e.message);
    return true;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Método no permitido' });

  const key = process.env.BREVO_API_KEY, list = Number(process.env.BREVO_LIST_ID), tpl = Number(process.env.BREVO_DOI_TEMPLATE_ID);
  if (!key || !list || !tpl) return json(500, { error: 'Newsletter sin configurar' });

  let b = {};
  try { b = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { error: 'JSON inválido' }); }

  const email = String(b.email || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return json(400, { error: 'Correo no válido' });
  if (b.consent !== true) return json(400, { error: 'Falta el consentimiento' });

  // Envío demasiado rápido: probablemente un robot. Se responde "ok" sin hacer nada.
  if (Number(b.elapsed) < 2500) return json(200, { ok: true });

  const headers = event.headers || {};
  const ip = headers['x-nf-client-connection-ip'] || (headers['x-forwarded-for'] || '').split(',')[0].trim();
  if (!(await rateLimit(ip))) return json(429, { error: 'Demasiados intentos' });

  try {
    const r = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email, includeListIds: [list], templateId: tpl, redirectionUrl: SITE + '/suscripcion-confirmada.html' })
    });
    if (r.status === 201 || r.status === 204 || r.ok) return json(200, { ok: true });
    console.error('Brevo', r.status, (await r.text()).slice(0, 300));
    return json(502, { error: 'No se pudo completar la suscripción' });
  } catch (e) {
    console.error('Brevo fetch:', e.message);
    return json(502, { error: 'No se pudo completar la suscripción' });
  }
};
