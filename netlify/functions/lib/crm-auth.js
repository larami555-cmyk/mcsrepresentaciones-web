// Autenticación del CRM: contraseña única guardada en la variable de entorno CRM_PASSWORD (Netlify).
// El login devuelve un token firmado (HMAC) con caducidad; las demás funciones lo exigen en la cabecera x-crm-token.
const crypto = require('crypto');

const TTL_MS = 12 * 60 * 60 * 1000; // la sesión dura 12 horas
const MIN_LEN = 10;

function secret() { return process.env.CRM_PASSWORD || ''; }
function configured() { return secret().length >= MIN_LEN; }

function sha(x) { return crypto.createHash('sha256').update(String(x)).digest(); }
function sign(exp) { return crypto.createHmac('sha256', secret()).update(String(exp)).digest('hex'); }

function checkPassword(candidate) {
  if (!configured()) return false;
  return crypto.timingSafeEqual(sha(candidate || ''), sha(secret()));
}

function makeToken() {
  const exp = Date.now() + TTL_MS;
  return { token: exp + '.' + sign(exp), expires: exp };
}

function verifyToken(token) {
  if (!configured() || !token) return false;
  const parts = String(token).split('.');
  if (parts.length !== 2) return false;
  const [exp, sig] = parts;
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// true si la petición trae un token válido
function authorize(event) {
  const h = (event && event.headers) || {};
  return verifyToken(h['x-crm-token'] || h['X-CRM-Token']);
}

module.exports = { configured, checkPassword, makeToken, verifyToken, authorize, MIN_LEN };
