const { getStore } = require('@netlify/blobs');

function jsonResponse(statusCode, obj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  };
}

const SYSTEM_PROMPT = `Eres un agente de inteligencia comercial B2B especializado en el sector mueble, tapicería y descanso en España (Galicia).
Investigas en internet la empresa que te indica el usuario y devuelves EXCLUSIVAMENTE un objeto JSON válido, sin texto antes ni después, sin bloques de código markdown.

MCS Representaciones distribuye estos fabricantes: Treku, Baixmoduls, Tobisa, Essenzia Dormire, Tapizados Mayor, KingSofá.
- Treku y Baixmoduls: mueble de salón/comedor/dormitorio de diseño, gama media-alta.
- Tobisa y Tapizados Mayor: tapicería, sofás.
- Essenzia Dormire y KingSofá: descanso (colchones, canapés, sofás cama).

Investiga la empresa cliente: qué vende, marcas que ya distribuye, gama y estilo, si tiene interiorismo/proyectos, noticias recientes. Después evalúa el encaje con cada fabricante MCS.

Devuelve JSON con este esquema exacto (usa "" o [] si no encuentras dato, nunca inventes):
{
  "nombre_correcto": "",
  "direccion": "",
  "telefono": "",
  "email": "",
  "web": "",
  "redes": "",
  "tipo_producto": "",
  "categorias": [],
  "marcas_detectadas": [],
  "productos_detectados": [],
  "servicios": [],
  "novedades": "",
  "potencial": {"muebles":"Alto|Medio|Bajo|Nulo","tapiceria":"Alto|Medio|Bajo|Nulo","descanso":"Alto|Medio|Bajo|Nulo","interiorismo":"Alto|Medio|Bajo|Nulo"},
  "fabricantes_mcs_adecuados": [],
  "prioridad": "Alta|Media|Baja",
  "resumen": "2-3 frases resumiendo la oportunidad comercial",
  "fuentes": [{"titulo":"","url":""}]
}
Sé conciso. Máximo 6 elementos por lista.`;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Método no soportado' });

  let body = {};
  try { body = JSON.parse(event.body || '{}'); } catch (e) { return jsonResponse(400, { error: 'JSON inválido' }); }

  const { id } = body;
  // Sin contraseña de acceso: uso estrictamente personal, a petición de MCarmen.
  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonResponse(500, { error: 'Falta configurar ANTHROPIC_API_KEY en Netlify (Site settings → Environment variables)' });
  }

  const store = getStore({
    name: 'crm-data',
    siteID: '0b92cef2-4cc9-4f80-b0da-4dcb41ee07b4',
    token: process.env.BLOBS_ACCESS_TOKEN
  });
  let clientes = (await store.get('clientes', { type: 'json' })) || [];
  const idx = clientes.findIndex(x => x.id === id);
  if (idx === -1) return jsonResponse(404, { error: 'Cliente no encontrado' });
  const c = clientes[idx];

  const userPrompt = `Investiga esta empresa cliente potencial:
Nombre: ${c.nombre}
Localidad: ${c.localidad}
${c.web ? 'Web conocida: ' + c.web : ''}
${c.direccion ? 'Dirección conocida: ' + c.direccion : ''}

Busca en internet información real y actual. Devuelve solo el JSON.`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message || 'Error de la API de Anthropic');

    const textBlocks = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
    const start = textBlocks.indexOf('{');
    const end = textBlocks.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) throw new Error('El agente no devolvió un JSON válido');
    let result;
    try {
      result = JSON.parse(textBlocks.slice(start, end + 1));
    } catch (parseErr) {
      throw new Error('La respuesta del agente se cortó a medias. Vuelve a pulsar "Investigar cliente", suele funcionar al reintentar.');
    }

    if (result.nombre_correcto) c.nombre = result.nombre_correcto;
    if (result.direccion) c.direccion = result.direccion;
    if (result.telefono) c.telefono = result.telefono;
    if (result.email) c.email = result.email;
    if (result.web) c.web = result.web;
    if (result.redes) c.redes = result.redes;
    if (result.tipo_producto) c.tipoProducto = result.tipo_producto;
    if (Array.isArray(result.categorias)) c.categorias = result.categorias;
    if (Array.isArray(result.marcas_detectadas)) c.marcasDetectadas = result.marcas_detectadas;
    if (Array.isArray(result.productos_detectados)) c.productosDetectados = result.productos_detectados;
    if (Array.isArray(result.servicios)) c.servicios = result.servicios;
    if (result.novedades) c.novedades = result.novedades;
    if (result.potencial) c.potencial = Object.assign({ muebles: '', tapiceria: '', descanso: '', interiorismo: '' }, result.potencial);
    if (Array.isArray(result.fabricantes_mcs_adecuados)) c.fabricantesMCS = result.fabricantes_mcs_adecuados;
    if (result.prioridad) c.prioridad = result.prioridad;
    c.potencialGlobal = result.prioridad || c.potencialGlobal;
    c.historial = c.historial || [];
    c.historial.push({
      fecha: new Date().toISOString(),
      resumen: result.resumen || '',
      fuentes: Array.isArray(result.fuentes) ? result.fuentes.filter(f => f && f.url) : []
    });

    clientes[idx] = c;
    await store.setJSON('clientes', clientes);

    return jsonResponse(200, { cliente: c });
  } catch (err) {
    return jsonResponse(500, { error: err.message || 'Error investigando el cliente' });
  }
};
