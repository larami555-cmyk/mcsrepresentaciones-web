const { configured, checkPassword, makeToken, MIN_LEN } = require('./lib/crm-auth');

function jsonResponse(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Método no permitido' });
  if (!configured()) {
    return jsonResponse(500, { error: `Falta configurar CRM_PASSWORD en Netlify (mínimo ${MIN_LEN} caracteres)` });
  }
  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'JSON inválido' }); }

  if (!checkPassword(body.password)) {
    await sleep(1200); // frena los intentos por fuerza bruta
    return jsonResponse(401, { error: 'Contraseña incorrecta' });
  }
  const { token, expires } = makeToken();
  return jsonResponse(200, { token, expires });
};
