# MCS Representaciones — Notas del proyecto web

Documentación técnica para dar continuidad al desarrollo, sin depender de la memoria de ninguna IA ni de una conversación concreta. Si empiezas un chat nuevo con Claude, pégale este archivo o dile "lee NOTES.md del repo" y podrá retomarlo desde cero.

## Infraestructura

- **Código fuente:** `index.html` en la raíz del repo. Es una app React autocontenida (sin build step) que carga React vía CDN y compila JSX en el navegador. Todo el sitio vive en ese único archivo.
- **GitHub:** https://github.com/larami555-cmyk/mcsrepresentaciones-web (rama `main`)
- **Hosting:** Netlify, conectado al repo de GitHub con auto-deploy en cada push a `main`. Tarda 1-2 minutos en publicar.
- **Dominio:** mcsrepresentaciones.es (comprado en IONOS, DNS apuntando a Netlify)
- **Visitor access de Netlify debe estar en "Public"** — si aparece "Private" con candado 🔒 el sitio da error 401.

## Flujo de trabajo para hacer cambios

1. Editar `index.html` (localmente o pedírselo a Claude)
2. Verificar sintaxis del JS antes de publicar: extraer el `<script>` inline y correr `node --check archivo.js`
3. Si el cambio afecta a layout/tamaños, probar visualmente con Playwright (Chromium headless) en dos resoluciones antes de publicar: escritorio 1440px y móvil 390px. Esto evita sorpresas — un cambio de CSS puede verse bien en el código y romperse en el navegador real.
4. `git add -A && git commit -m "..." && git push`
5. Esperar 1-2 min y comprobar en mcsrepresentaciones.es

## ⚠️ Lección crítica de CSS (nos ha mordido dos veces)

Este HTML usa un **bundle de Tailwind precompilado/purgado**, no Tailwind compilándose en vivo. Eso significa que **las clases con valores arbitrarios tipo `h-[260px]`, `w-[190px]`, `lg:w-24` NO funcionan** si esa clase exacta no estaba ya en el bundle original — el navegador simplemente la ignora y el elemento no tiene esa altura/anchura real, aunque en el código "parezca" correcto.

Síntomas de este bug: algo que debería tener tamaño fijo (logo, caja de foto) se ve con tamaño variable/inconsistente entre elementos, o se desborda y tapa otras cosas al hacer scroll.

**Solución siempre que se necesite un tamaño específico nuevo:** crear una clase CSS propia dentro del `<style>` inline del `<head>`, no usar corchetes de Tailwind. Ejemplo ya usado en el código:

```css
.mcs-logo{width:44px;height:44px}
@media (min-width:1024px){.mcs-logo{width:58px;height:58px}}
.mcs-photo-box{height:260px}
```

Casos ya resueltos así: `.mcs-logo`, `.mcs-brandname`, `.mcs-brandsub`, `.mcs-photo-box`, `.mcs-novedad-img`, `.mcs-img-contain`.

**Ojo:** no es solo cuestión de valores arbitrarios con corchetes — clases *core* de Tailwind que simplemente no se usaban en ningún otro sitio del diseño original tampoco están en el bundle. Ejemplo real: `object-contain` no estaba (aunque `object-cover` sí, por usarse en las fotos de marca), y el navegador la ignoraba silenciosamente cayendo al `object-fit` por defecto (`fill`, deformando la imagen) sin ningún error visible. Si una clase Tailwind no se ve reflejada en el render aunque el className esté bien escrito, comprobar con `grep -c "nombre-clase{" index.html` si existe en el bundle antes de asumir que el código está mal.

## Historial de bugs importantes ya resueltos

- **Página en blanco en producción:** variable `tl` declarada por Claude colisionó con una función interna del bundle minificado también llamada `tl()`. Lección: antes de introducir un nombre de variable nuevo, comprobar con `grep -o '\bNOMBRE\b' index.html` que no existe ya.
- **Traducción automática de Chrome rompía nombres de marca** ("Mayor"→"Alcalde"): el `<html>` tenía `lang="en"`. Fix: `lang="es"` + `<meta name="google" content="notranslate">`.
- **Logo del header tapaba el contenido al hacer scroll:** el logo medía 190px pero el header solo 72px de alto, con `overflow-visible`. Fix: logo reducido a 58px (cabe dentro del header) y quitado el overflow-visible.
- **Fotos de marca de tamaño visual inconsistente:** el contenedor usaba `h-[260px]` (clase arbitraria no compilada, ver lección de arriba). Fix: `.mcs-photo-box{height:260px}`.

## Cambios recientes (11-14 agosto 2026)

- Instagram corregido a `@mcsrepresentaciones` (antes tenía una "s" de más)
- Más espacio entre el texto y los iconos sociales en el bloque "Síguenos"
- **Eliminada por completo** la sección negra "Área Profesional / Catálogos y tarifas actualizadas siempre a mano" (y su enlace "Catálogos" del menú de navegación, ya no tenía destino)
- "WhatsApp Business" (footer) y "Agendar visita" ahora abren WhatsApp (619 620 363) con mensaje prellenado, antes no hacían nada
- Enlace de Facebook corregido de formato con espacio (`MCarmen%20Sánchez.792`, inválido) a formato con puntos (`MCarmen.Sanchez.792`) — **pendiente de que MCarmen confirme si abre bien**, si no, pedirle que copie el enlace directamente desde "Copiar enlace al perfil" en Facebook
- Añadido icono de la app (favicon + manifest.json PWA) usando el logo `icon.png` que envió MCarmen — ahora al instalar el sitio como app en móvil/escritorio usa ese icono en vez de uno genérico. Archivos: `images/icon-32/180/192/512.png`, `manifest.json`
- Quitado el estilo "destacado" (borde dorado) de la tarjeta de Essenzia Dormire — las 6 tarjetas de marca ahora son visualmente idénticas (`featured:!1` en las 6)
- Generado QR de la web con el logo MCS incrustado en el centro, verificado que escanea correctamente a mcsrepresentaciones.es (entregado como PNG, no vive en el repo)

## ⚠️ Lección: iconos de "Añadir a pantalla de inicio" (PWA) — usar archivos reales, no incrustados

Si una página suelta (ej. `tarifas-mayor.html`, `tarifas-kingsofa.html`) necesita favicon/apple-touch-icon/manifest para poder instalarse como app en el móvil con su propio icono, **usar siempre archivos reales** (`images/icon-X.png`, `manifest-X.json`, enlazados con rutas relativas tipo `./images/...`), **nunca** incrustarlos como `data:image/png;base64,...` o `data:application/manifest+json;base64,...` dentro del propio HTML.

Motivo: un manifest con `"start_url": "."` incrustado como data-URI no tiene una "ubicación" real desde la que resolver la ruta relativa, así que el navegador cae al dominio raíz al instalar — parece que la app instalada "no hace nada" o abre la portada en vez de la página correcta. Con archivo real y `"start_url": "./nombre-pagina.html"` esto no pasa.

Caso ya resuelto así: `tarifas-mayor.html` (manifest-mayor.json + images/icon-mayor-*.png), `tarifas-kingsofa.html` (manifest-kingsofa.json + images/icon-kingsofa-*.png).

## Pendiente

- Confirmar que el enlace de Facebook corregido (`facebook.com/MCarmen.Sanchez.792`) abre correctamente. Si no, pedirle a MCarmen que copie el enlace directo desde su perfil de Facebook ("Copiar enlace al perfil").
- Los 3 enlaces duplicados de mcsCatalogos (ver detalle abajo), pendientes de que MCarmen confirme los correctos desde su app IONOS.

## Estructura de datos dentro del código

- **`ql` (array):** las 6 marcas (Treku, Baixmoduls, Tobisa, Essenzia Dormire, Tapizados Mayor, KingSofá). Cada una tiene `id, name, logo, photo, web, zoom, pos, year, desc, tag, estancia, featured`. `zoom` y `pos` controlan el encuadre de la foto de portada (algunas fotos son tomas de habitación completa y necesitan más zoom para verse a un tamaño similar a las demás).
- **`mcsCatalogos` (array):** catálogos PDF públicos descargables por marca, se muestran al pulsar "Ver catálogo" en cada tarjeta. Campos: `marca, nombre, url`.
- **`mcsTarifas` (array):** tarifas privadas por marca (área profesional), se filtran por el selector de marca. Campos: `marca, nombre, url`. **KingSofá y Essenzia Dormire NO tienen tarifa** (confirmado, no es un error).

## Área Profesional / Modal Documentos (16 agosto 2026)

Nueva función: el botón "Área Profesional" (header desktop y menú móvil) abre un modal con pestaña "Documentos". Dentro hay un selector de las 6 marcas y, para la marca seleccionada, se listan sus documentos (instrucciones, fichas técnicas, enlaces...). Si una marca no tiene documentos aún, se muestra el mensaje "Todavía no hay documentos para esta marca. Vuelve pronto."

- **Array de datos:** `mcsDocumentos`, definido justo antes de `function Su()`. Campos: `id, marca, tipo, titulo, desc, videoUrl (opcional), videoPass (opcional)`. `marca` debe coincidir exactamente con `s.name` de `ql` (ej. "TREKU", "BAIXMODULS", "TAPIZADOS MAYOR", "KINGSOFÁ").
- **Estado:** `dO`/`dS` (abierto/cerrado del modal) y `dB`/`dSB` (marca seleccionada, por defecto "TREKU"), declarados en el `useState` inicial de `Su()`.
- **Para añadir un documento nuevo:** añadir un objeto más al array `mcsDocumentos` con la marca correspondiente. No hace falta tocar nada más del render, la lista se filtra automáticamente por marca.
- **⚠️ Otro caso del bug de CSS del bundle precompilado:** clases Tailwind como `fixed`, `inset-0`, `overflow-y-auto`, `overflow-x-auto`, `gap-1.5` NO estaban en el bundle y el modal no se posicionaba ni bloqueaba el scroll. Solución: se crearon clases CSS propias `.mcs-modal-overlay`, `.mcs-modal-box`, `.mcs-modal-tabs` en el `<style>` inline (mismo patrón que `.mcs-logo` etc.). Antes de usar cualquier clase Tailwind nueva en este proyecto, comprobar con `grep -o '\.NOMBRE-CLASE{' index.html` que existe en el bundle.
- Primer documento cargado: TREKU · "Configurador DecoTreku" (instrucciones de uso, enlace al vídeo tutorial de Vimeo y contraseña).



Tres pares de catálogos apuntan al mismo enlace de IONOS por error de origen (vienen así del Excel/app de gestión de MCarmen), pendientes de que ella confirme los enlaces correctos:
1. "Telas 2026" (Essenzia) y "Ares-Denver" (KingSofá) → mismo link `KM6M0pZqc`
2. "Catálogo General" (Essenzia) y "Paneles Decorativos" (Baixmoduls) → mismo link `W1ZsSYN4X`
3. "Arko 360" y "Armarios" (ambos Baixmoduls) → mismo link `E6QFtLEn3`

## Imágenes

Todas en `/images/` dentro del repo: logos de marca (`logo-*.png/jpeg`), fotos de producto (`foto-*.jpg/webp`), logo MCS, foto de perfil de MCarmen.

## Credenciales

El token de GitHub para hacer push **no se guarda en este archivo por seguridad**. MCarmen lo tiene guardado aparte; si Claude necesita hacer push y no lo tiene en el contexto de la conversación, hay que pedírselo.

## Fix Blobs (18 agosto 2026)
Se añadió NETLIFY_BLOBS_TOKEN (personal access token) como variable de entorno, y las funciones `crm-clientes.js`/`crm-investigar.js` pasan `siteID` + `token` explícitos a `getStore()` para evitar el `MissingBlobsEnvironmentError` que Netlify Blobs presentaba al no inyectar el contexto automáticamente en producción.

## Resumen gran sesión (24 agosto 2026) — Traducción bilingüe, Quién soy, argumentarios de venta

### 1. Web 100% bilingüe CASTELLANO / GALEGO
- Selector visible en el header (desktop y menú móvil), botones "Castellano" / "Galego", el idioma elegido se guarda en `localStorage` (`mcsLang`) y persiste entre visitas.
- **Diccionario central:** `var mcsI18n={es:{...},gl:{...}}`, declarado justo antes de `function Su()`. Contiene todos los textos fijos del sitio (nav, hero, marcas, servicios, novedades, footer, "Quién soy"). Dentro del componente: `const tx=mcsI18n[lg]` y se usa `tx.nombreCampo` en vez de texto literal en todo el JSX.
- **Contenido dinámico bilingüe:** los arrays de datos (`ql` marcas, `mcsNovedades`, `mcsDocumentos`) llevan campos `xxxGl` en paralelo a los `xxx` en castellano (ej. `desc`/`descGl`, `titulo`/`tituloGl`, `linkUrl`/`linkUrlGl`). Patrón de fallback usado en todo el código: `lg==="gl"?(x.campoGl||x.campo):x.campo` — si falta la traducción gallega, cae automáticamente a la versión en castellano sin romper nada.
- **Para añadir contenido nuevo (marca, novedad, documento):** siempre rellenar el campo en castellano; el `Gl` es opcional (recomendado, pero el sitio no se rompe si falta).
- **Ojo con `state.desc` con saltos de línea:** si un campo de texto necesita varias líneas (ej. listas numeradas), usar la secuencia `\n` (dos caracteres, backslash+n) dentro del string, NUNCA un salto de línea real dentro de las comillas — un salto de línea real rompe la sintaxis JS con "Invalid or unexpected token". Para que el `\n` se vea como salto de línea real en pantalla, el `<p>` que renderiza ese campo lleva `style:{whiteSpace:"pre-line"}` en vez de depender de clases Tailwind.

### 2. Nueva sección "Quién soy"
- Pestaña de menú "Quién soy" (antes de Marcas), sección `id="quien-soy"` con foto de MCarmen (`images/mcarmen-quiensoy.jpg`, formato 4:5, sustituida por versión en alta resolución el 24/08) + biografía en 4 párrafos + tarjeta con nombre/cargo superpuesta en la esquina de la foto.
- Textos en `tx.quienSoyTitulo`, `tx.quienSoyEyebrow`, `tx.quienSoyP1-P4` (ES y GL).
- La pestaña "Inicio" que se añadió en un primer momento se quitó del menú (a petición de MCarmen, para dejar más aire al logo); se mantiene en su lugar un **botón flotante fijo** (ver punto 4).

### 3. Documentos por marca — Argumentario de venta (PDF) por solicitud
- 6 PDFs "Argumentario de venta" (uno por marca, en `documentos/argumentario-{marca}-es.pdf` y `-gl.pdf`), generados a partir de las hojas que MCarmen fue pasando (imagen → PDF de una página con Pillow). **Tobisa en gallego** fue corregido tras un primer envío duplicado en castellano.
- **Importante:** estos documentos NUNCA se descargan directamente. El botón dice "Solicitar por WhatsApp" y abre `wa.me/34619620363` con un mensaje prellenado (distinto en ES/GL) pidiendo el argumentario de esa marca. Esto es así a propósito — MCarmen quiere control sobre quién recibe este contenido.
- Se probó primero añadir una ficha gratuita "Cinco razones para recomendar esta marca" (visible sin pedir nada) pero **se eliminó** (24 agosto) porque ese contenido ya está dentro del argumentario que hay que solicitar — tenerlo también gratis anulaba el sentido del "por solicitud". Si en el futuro se pide algo similar, recordar este criterio.
- El modal de Documentos ahora también soporta traducir `tipo`/`titulo`/`desc`/`linkUrl`/`linkLabel` con el mismo patrón `xxxGl` de fallback.

### 4. Botones flotantes fijos (arriba a la derecha, bajo el header)
- WhatsApp (verde, `wa.me/34619620363`) y debajo un botón "Inicio" (negro, icono de casa, `href="#inicio"`, el `id="inicio"` vive en la sección hero). Clases `.mcs-wa-float` / `.mcs-home-float`, con variante más pequeña en móvil vía `@media (max-width:1023px)`.

### 5. Mapa interactivo de Galicia
- SVG de las 4 provincias insertado inline vía `dangerouslySetInnerHTML` dentro de `p("div",{className:"mcs-galicia-map"...})`, **colocado en la misma fila que el texto "+230 tiendas..."** (no debajo, a petición de MCarmen). Clases del hover en el `<style>` inline: `.mcs-galicia-map path.mcs-province`.
- **Segunda versión (24 agosto):** se sustituyó el SVG por uno con una capa adicional `path.mcs-outline` (contorno negro fijo de toda Galicia) para que la silueta se vea siempre, no solo al hacer hover.

### 6. Otros ajustes de esta sesión
- Avatares del hero (`+230 tiendas...`) sustituidos por fotos reales: retrato de un cliente + 2 fachadas de tienda (antes eran fotos aleatorias de pravatar.cc).
- Header: subtítulo ampliado a "Mobiliario · Tapicería · Descanso" + línea "Solo para profesionales en Galicia" (antes solo decía "Mobiliario").
- Barra negra final: "Mobiliario" → "Producto Nacional Premium", texto en blanco y `font-semibold` (antes gris tenue, poco legible), altura aumentada de 40px a 56px (`.mcs-footer-bar`).
- Sección Servicios: la tarjeta "Síguenos" pasó a llamarse "Material para publicar en tu tienda" (mismos iconos de redes sociales debajo), y se añadió una 6ª tarjeta "Recursos para Distribuidores" cuyo botón "Herramientas de Venta" abre el modal Área Profesional.

### ⚠️ Bugs de esta sesión para recordar
- **Saltos de línea reales dentro de strings JS** (ver punto 1) rompen la sintaxis — usar siempre `\n` escapado.
- **Al insertar varios objetos seguidos en un array con un script Python**, comprobar que no falte la coma `,` entre `}` y `{` del siguiente objeto — un `"}{id:"` sin coma de por medio es sintácticamente inválido y da un error de "Unexpected token" difícil de localizar a simple vista. Revisar siempre con `grep -c '"}{id:"' index.html` tras una inserción masiva.
- **Colores/clases Tailwind inventados sin comprobar el bundle:** se usó `text-[#D8D2C5]` para la barra negra y no existía en el bundle precompilado (quedó sin aplicar). Siempre comprobar con `grep -c '\.text-\\\[\\#RRGGBB\\\]{' index.html` (con las barras invertidas exactas) antes de dar por hecho que un color arbitrario está disponible; si no lo está, usar uno de los ya confirmados en el proyecto (`text-white`, `text-[#8A7F74]`, `text-[#C5A880]`, etc.) o crear una clase CSS propia.



## ⚠️ Regla fija: TODO texto visible en Castellano y Galego (siempre)

Cualquier texto nuevo que vea el visitante debe existir en las dos lenguas, sin excepciones:
- Textos fijos → `mcsI18n.es` y `mcsI18n.gl` (nunca literales en el JSX).
- Datos (`mcsNovedades`, `mcsDocumentos`, marcas) → campo en castellano + campo `Gl` (`titulo`/`tituloGl`, `desc`/`descGl`, `fecha`/`fechaGl`, `tipo`/`tipoGl`, `linkLabel`/`linkLabelGl`, `link`/`linkGl`).
- Imágenes con texto dentro NO son traducibles: usar portada nativa (`cover:1` en `mcsNovedades`) o una imagen por idioma.
- Páginas sueltas (ej. `guia-tejidos-naturales.html`): atributos `data-gl` + script que lee `localStorage.mcsLang`.

## Novedades: formato unificado

Todas las tarjetas llevan etiqueta superior (`fecha`), título en Playfair y descripción. Los artículos usan la portada nativa `.mcs-cover` (mismo degradado y tipografía que las páginas de artículo), no capturas.

## Textos legales y fuentes locales (20 septiembre 2026)

- Nuevas páginas: `aviso-legal.html` (art. 10 LSSI-CE) y `privacidad.html` (RGPD/LOPDGDD + sección de cookies). Enlazadas en el pie de `index.html` (clase `.mcs-legal-links`) y en el sitemap.
- Aviso RGPD de primera capa bajo los botones del formulario de contacto (ES/GL).
- Google Fonts eliminado: las tipografías (Inter 300–600, Playfair Display 400–700, subset latin) están en `fonts/` con `fonts/fonts.css`. Así no hay conexión a terceros y no hace falta banner de cookies. `crm/index.html` (interno, noindex) sigue usando Google Fonts (Fraunces).
- Si se añade Analytics, píxeles, mapas o vídeos incrustados, hay que crear política de cookies y banner de consentimiento antes de cargarlos.
- Titular: MCarmen Sanchez Recarey, NIF 32775127N, Paseo Templarios, Cambre, 15679 A Coruña (sin número de portal; añadirlo si procede).

## Formulario, cookies/analítica y enlaces (20 septiembre 2026)

- **Formulario de contacto** ahora envía por **Netlify Forms** (`form-name=contacto`, POST a `/`). Hay un `<form name="contacto" data-netlify="true" hidden>` estático justo tras `<div id="root">` para que Netlify lo detecte; no borrarlo. Antispam: campo trampa `bot-field` (input `#f-bot`, fuera de pantalla) + filtro de Netlify. Campo nuevo obligatorio `Email o teléfono` (`#f-contacto`) y casilla de consentimiento. Estado del envío en `mcsFS`/`mcsFC` (dentro de `Su`). Avisos por email: Netlify → Forms → notifications (configurados por MCarmen).
- **Analítica:** `cookies.js` (cargado en el `<head>` de todas las páginas públicas). Pegar el ID GA4 en `var GA_ID = ""` (formato `G-XXXXXXXXXX`). Con GA_ID vacío no hay banner ni carga nada. Google Analytics solo se carga tras pulsar "Aceptar"; "Rechazar" y "Aceptar" tienen el mismo peso visual. El consentimiento se guarda 12 meses en localStorage (`mcsCookieConsent`). Enlace "Configurar cookies" en el pie (solo si hay GA_ID). Política de privacidad actualizada (sección 7 = cookies).
- **Enlaces:** `scripts/check_links.py` + `.github/workflows/check-links.yml` (cada lunes; si hay enlaces rotos falla y GitHub avisa por email). Probar en local sin red: `python3 scripts/check_links.py --internal-only`.
- Corregida una `}` suelta al final del `<body>` (un `</style>` duplicado).
- Artículo "El mueble entra en una nueva era regulatoria": ya alojado en `normativa-mueble.html` (ES/GL con `data-gl`, mismo patrón que la guía de tejidos). La tarjeta de Novedades enlaza a esa página. El PDF del sitio externo se sustituye por el botón "Imprimir o guardar como PDF" (`window.print()`). Contenido normativo aportado por MCarmen (Septiembre 2026): revisar cada trimestre.

## CRM protegido con contraseña (20 septiembre 2026)

- Variable de entorno obligatoria en Netlify: **`CRM_PASSWORD`** (mínimo 10 caracteres; mejor una frase larga). Sin ella, el CRM queda cerrado (falla cerrado) y `crm-login` devuelve "Falta configurar CRM_PASSWORD". Ámbitos: todos, incluidas Functions. Tras crearla o cambiarla, hay que redesplegar.
- Flujo: `crm/index.html` muestra la pantalla de acceso → `POST /.netlify/functions/crm-login` con la contraseña → devuelve un token firmado (HMAC, caduca a las 12 h) que el navegador guarda en `sessionStorage` (se borra al cerrar la pestaña) y envía en la cabecera `x-crm-token`.
- Código: `netlify/functions/lib/crm-auth.js` (helper), `crm-login.js` (nuevo), y `crm-clientes.js` / `crm-investigar.js` exigen `authorize(event)` y devuelven 401 si no hay token válido. Cambiar `CRM_PASSWORD` invalida todas las sesiones abiertas.
- El login espera 1,2 s en cada fallo para frenar la fuerza bruta. Usar una contraseña larga.
- `subir-fotos` ya tenía su propia contraseña (`FOTOS_PASSWORD`).

## Newsletter con Brevo (20 septiembre 2026)

- Formulario en la portada (bloque `#newsletter`, columna derecha del pie, ES/GL): correo + casilla propia de comunicaciones comerciales + información básica. Envía a `netlify/functions/newsletter.js`.
- La función llama a Brevo `POST /v3/contacts/doubleOptinConfirmation` (doble confirmación). Tras confirmar, Brevo redirige a `suscripcion-confirmada.html` (noindex).
- Variables de entorno en Netlify: `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_DOI_TEMPLATE_ID`. Sin ellas responde "Newsletter sin configurar".
- Antiabuso: tiempo mínimo de 2,5 s desde que se carga la página, límite de 5 intentos por IP y hora y 300 al día (Netlify Blobs, almacén `newsletter-limits`).
- Política de privacidad, registro de tratamientos (Excel) y NOTES actualizados. El remitente de los correos debe ser una dirección del dominio propio con SPF/DKIM/DMARC configurados en Brevo.

## Aviso de nuevas suscripciones (21 septiembre 2026)

- `newsletter.js` envía un correo a `mcsrepresentaciones@gmail.com` (desde `novedades@mcsrepresentaciones.es`, vía la API transaccional de Brevo `/v3/smtp/email`) cada vez que Brevo acepta una solicitud de suscripción. Es un aviso de la *solicitud*, no de la confirmación: la persona aparece en la lista `Newsletter web` solo cuando confirma.
- Nunca hace fallar el alta: si el aviso falla, solo se registra en el log. Tope de 20 avisos al día (almacén Blobs `newsletter-limits`, clave `alerts-<día>`).
- La validación del correo es estricta (solo ASCII, sin `<>` ni espacios), en servidor y en el formulario.

## CRM sin contraseña (23 septiembre 2026)

- Por decisión de la titular, `crm/index.html` ya no pide contraseña: `crm-clientes.js` y `crm-investigar.js` no exigen token. Se quitó el botón "Salir". `crm-login.js` y `lib/crm-auth.js` siguen en el repo por si se quiere volver a activar (basta con restaurar `authorize(event)` y la comprobación de `crmToken()` en `attemptLoad`).
- Protección de coste: `crm-investigar.js` tiene un tope de **20 investigaciones al día** (almacén Blobs `crm-limits`, clave `inv-AAAA-MM-DD`). Al superarlo devuelve 429 con mensaje.


## Feria Hábitat València 2026 (28 sept – 1 oct)
- Banner horizontal bajo las tarjetas de Novedades (`index.html`, clase `.mcs-feria-banner`). Se muestra solo a partir del **27/09/2026 23:00** (hora de Madrid). Para verlo antes: `/?feria`.
- Página: `feria-habitat-2026.html` (ES/GL). La galería lee `content/catalogo/feria/*.md` (campo `imagen` o `video`), lo más reciente primero, con visor a pantalla completa.
- Vídeos también en todas las marcas (catálogo los muestra con reproductor). El catálogo lee las fichas .md desde la propia web, no desde jsDelivr (evita hasta 12 h de caché).
- Subida desde el móvil: panel `subir-fotos` → destino **★ FERIA HÁBITAT 2026**. Admite fotos y vídeos (máx. 4 MB cada vídeo, por el límite de 6 MB de las funciones de Netlify). Vídeos grandes: reenviarlos por WhatsApp para que se compriman.
- Comentarios/reseñas: campo de texto en el panel (destino Feria), se guardan como `content/catalogo/feria/nota-*.md` (texto en el cuerpo). Documentos PDF (máx. 4 MB) en `documentos/feria/`, ficha `doc-*.md` con `documento` y `nombre`. La página lee los .md desde la propia web (no jsDelivr) para evitar caché.
- Para retirar el banner tras la feria: borrar el bloque `(Date.now()>=Date.parse("2026-09-28...` en `index.html`.

## Página de suscripción (24 septiembre 2026)
- `suscribirse.html` (también `/suscribirse` y `/suscribete`): enlace directo para compartir con clientes. Mismo alta que el bloque `#newsletter` (función `newsletter.js`, doble confirmación Brevo). ES/GL con botones; `?lang=gl` abre en gallego.
- Logo: todas las páginas sueltas usan `images/logo-mcs-h.png` (recorte sin tocar de `logo-mcs.png`, el logotipo oficial e inalterable). Nunca sustituirlo por texto "MCS".
- `suscribirse-feria.html` (`/suscribirse-feria`): versión solo Feria Valencia 2026 para la invitación. Misma lista de Brevo; envía `origen:"feria"` y el aviso a MCarmen lo indica en el asunto.

## Mejoras SEO tras auditoría (15 noviembre 2026)

Primera tanda de la auditoría SEO (rama `seo/mejoras-auditoria`):
- **Portada:** H1 nuevo con actividad y zona (`mcsI18n.es/gl` → `h1a/h1b/h1c`); el lema anterior pasa a subtítulo (`tx.lema`, clase propia `.mcs-lema`). JSON-LD ampliado a `ProfessionalService` (Cambre, A Coruña; `areaServed` por provincias; `brand`) + `WebSite`. Alt en fotos de marca y novedades, `loading:"lazy"` bajo el pliegue y `width/height` en logo, hero y foto de MCarmen.
- **`og:locale:alternate` retirado** de todas las páginas: no existe una URL en gallego que lo respalde. Volver a ponerlo solo si se publica `/gl/` con hreflang.
- **`notranslate` se mantiene** a propósito (evita "Mayor"→"Alcalde"), aunque la auditoría proponía quitarlo.
- **Catálogo:** URL única `/catalogo.html` (`/catalogo` redirige con 301 en `_redirects`), title y description nuevos, H1 + introducción ES/GL, alt descriptivo por marca.
- **Artículos** (normativa, tejidos, SweetBedding, feria, balance): el logo enlaza a la portada, bloque "También te puede interesar" (`.mcs-rel`, ES/GL) antes de `</main>`, JSON-LD `Article` + `BreadcrumbList`, títulos más descriptivos. Al crear un artículo nuevo: copiar ese bloque y añadir el artículo a los demás. `balance-feria-habitat-2026.html` usa ya el logo oficial, las fuentes locales y Open Graph.
- **robots.txt** ya no enumera rutas internas (era público y además impedía a Google leer el `noindex`). Las páginas internas llevan `X-Robots-Tag: noindex, nofollow` desde `netlify.toml`. Al añadir una página interna nueva: añadir su bloque `[[headers]]` ahí, no en robots.txt.
- **sitemap.xml:** solo páginas con intención de búsqueda (fuera suscripciones y textos legales).
- `scripts/check_links.py`: `/` ya no cuenta como enlace roto.
- **SweetBedding es la 7.ª marca** (decisión de MCarmen, 15/11/2026): añadida a `ql`, descripciones, schema, "Quién soy", "7 marcas — 1 sola interlocutora", servicios y pie. Va sin logotipo (`logo:""`) hasta que MCarmen envíe el archivo; la tarjeta muestra solo el nombre. No tiene fotos en el catálogo ni tarifa.
- La rejilla de marcas ya no deja celdas grises si el número de marcas no es múltiplo de 3 (regla `#marcas .grid.lg\:grid-cols-3` en el `<style>`).
- **Taekwondo retirado del dominio** (decisión de MCarmen): borrados `monitor-taekwondo-dashboard.html`, `manifest-tkd.json`, `images/icon-tkd-*` y la redirección `/tkd`. Sigue en el historial de git si hiciera falta recuperarlo.
- Tarjetas de marca: foto y botones alineados abajo (tarjeta en `flex` columna, `.mcs-photo-box{margin-top:auto}`), así todas las fotos de una fila quedan a la misma altura aunque el texto de arriba ocupe distinto.
- `sameAs` usa el enlace de Google Maps de la ficha que dio MCarmen (`maps.app.goo.gl/P6wNBATUDheDEgZy9`).
- **Pendiente (segunda tanda):** HTML estático/prerender de portada y catálogo, páginas por marca y categoría, versión `/gl/`, logotipo de SweetBedding.

## Páginas de marca (15 noviembre 2026)

- 7 páginas estáticas, una por marca: `treku-galicia.html`, `baixmoduls-galicia.html`, `tobisa-galicia.html`, `essenzia-dormire-galicia.html`, `sweetbedding-galicia.html`, `tapizados-mayor-galicia.html`, `kingsofa-galicia.html`. Objetivo: posicionar "marca + Galicia".
- **Se generan con `python3 scripts/build_brand_pages.py`** (sin dependencias). Los textos ES/GL están dentro del script: para cambiarlos, editar el script y volver a ejecutarlo; no tocar los `.html` a mano. La galería toma las 6 fotos más recientes de `content/catalogo/<marca>/`, así que conviene regenerar tras subir fotos nuevas.
- Usan datos que ya estaban en la web (tarjetas de marca, catálogos, documentos) más la sección "Qué se vende y a qué tienda le encaja", con frases aportadas por MCarmen el 15/11/2026 (campo `fit` del script). En SweetBedding se omitió la mención al látex, igual que en la tarjeta de portada.
- Enlazadas desde: el nombre de cada marca en las tarjetas de portada (campo `page` en `ql`, clase `.mcs-brandlink`), la fila "Fichas de marca" del catálogo, entre ellas y el sitemap. Marca nueva: añadirla a `BRANDS` en el script, a `ql` (con `page`), a la fila del catálogo y al sitemap.
- `index.html` lleva al final un script que baja al ancla (`/#marcas`, `/#marca-treku`, `/#contacto`) cuando se llega desde otra página, porque React pinta la sección después de cargar.

## HTML estático al publicar (15 noviembre 2026)

La portada y el catálogo ya no llegan vacíos a quien no ejecuta JavaScript (Google en primera pasada, asistentes de IA).
- **Cómo:** Netlify ejecuta `npm install && node scripts/build-static.mjs` en cada deploy (`netlify.toml`). El script pinta la app React con `jsdom` (sin navegador) y mete el resultado dentro de `<div id="root">`; en `catalogo.html` escribe las tarjetas a partir de `content/catalogo/*/*.md`.
- **Los archivos del repo no cambian:** `index.html` sigue con `<div id="root"></div>` vacío y `catalogo.html` con la rejilla vacía. No pegar nunca el HTML generado en el repo. El script necesita encontrar esos dos huecos vacíos tal cual.
- **Con JavaScript todo funciona igual:** React sustituye el HTML estático al arrancar. El HTML estático lleva la marca `data-static`; los scripts de animación (`initReveal`), de apertura de catálogo por ancla (`tryOpen`) y de ancla esperan a que desaparezca.
- **Catálogo:** con las tarjetas ya escritas, los filtros solo muestran u ocultan (ya no llama a la API de GitHub, que tenía límite de 60 peticiones por hora). Sin el paso de publicación (p. ej. en local) sigue funcionando el método antiguo.
- **Si el paso falla** en producción, la página se publica como antes y el log de Netlify muestra `[static] AVISO`. En las vistas previas de un pull request, el fallo detiene el deploy.
- **Probar en local:** `npm install && node scripts/build-static.mjs --strict`, mirar, y después `git checkout index.html catalogo.html` para no subir el resultado.
- El idioma del HTML estático es castellano; el gallego sigue aplicándose en el navegador.

## Versión en gallego con dirección propia: /gl/ (15 noviembre 2026)

- El mismo paso de publicación (`scripts/build-static.mjs`) genera **`/gl/`**: portada, catálogo, las 7 páginas de marca y los 5 artículos, 14 páginas en total. No existe carpeta `gl/` en el repo; se crea al publicar.
- **De dónde sale el texto:** la portada se pinta con la app en gallego (`mcsI18n.gl`); el resto, de los atributos `data-gl` de cada página. El título gallego sale de la línea `document.title="…"` del script de cada página y la descripción, de `data-gl-content` en `<meta name="description">`. Página nueva con versión gallega: ponerle `data-gl`, esas dos cosas, y añadirla a `GL_PAGES` en el script.
- Cada pareja lleva `hreflang` es/gl recíproco y canonical propio; las direcciones `/gl/` se añaden solas al sitemap publicado.
- `_redirects`: `/gl/* /:splat 200` sirve desde la raíz todo lo que no exista en `/gl/` (imágenes, fuentes, páginas sin traducir), así que las rutas relativas `./images/...` funcionan igual.
- Las páginas `/gl/` fijan `localStorage.mcsLang="gl"` al cargar. En la portada, el botón "Galego" lleva a `/gl/` y "Castellano" vuelve a `/`.
- Logotipo de SweetBedding: `images/logo-sweetbedding.png`, recortado de la portada de su dosier (baja resolución; sustituir si llega un archivo mejor).

## ⚠️ No subir un `index.html` antiguo por "Add files via upload" (15 noviembre 2026)

El 15/11 a las 16:47 se subió a GitHub una copia de `index.html` del día 13 con un bloque de schema pegado a mano. Eso borró de producción todo lo hecho después (H1 nuevo, SweetBedding, alt de imágenes, alineación de tarjetas) y dejó un trozo de código suelto en la cabecera. Se restauró al fusionar el PR 5.
- Antes de editar `index.html` a mano, **descargar siempre la versión actual desde GitHub**; nunca partir de una copia guardada en el ordenador.
- El schema `ProfessionalService` ya está en la cabecera: no hace falta pegarlo otra vez.
- `llms.txt` (raíz): resumen del sitio para asistentes de IA. Actualizarlo si cambian las marcas.

## Pulido tras el informe de SEOptimer (15 noviembre 2026)

- Título de portada: "Agente comercial de muebles en Galicia: MCS Representaciones" (60 caracteres; GL en `GL_INDEX` de `scripts/build-static.mjs`). Descripción ajustada a 160.
- Todas las imágenes de portada llevan `alt` y `width`/`height`. Los logos de marca usan `style:{width:"auto"}` para que las medidas no los deformen.
- Imágenes reducidas sin cambiar de nombre: `mcarmen-foto.webp` (238 → 5 KB, se muestra a 48 px), `foto-kingsofa.webp`, `foto-baixmoduls.jpg`, `foto-tobisa.jpg`, `foto-hero.jpg`, `mcarmen-quiensoy.jpg`, `novedad-essenzia-blue-friday.jpg`. Regla: no subir fotos de más de 1200 px de ancho para la portada.
- `.mcs-brandlink{font-family:inherit}`: sin esto, el nombre de marca enlazado perdía la tipografía Playfair (la regla `*{font-family:Inter}` de la app pisa a los enlaces).
- Avisos de SEOptimer que se dejan como están a propósito: analítica "no detectada" (GA solo carga tras aceptar cookies), píxel de Facebook, perfiles de X/LinkedIn/YouTube. Los estilos en línea y el correo visible se resolvieron el 16/11 (ver "Segunda pasada").

## Tarjetas de marca alineadas también con la lista de catálogos abierta (15 noviembre 2026)

- Las tarjetas comparten filas con `grid-template-rows:subgrid` (cabecera, texto, enlace, foto, botones, lista). Al desplegar "Ver catálogo" en una tarjeta, las fotos de la fila no se mueven. Navegadores sin subgrid usan la alineación anterior.
- La tarjeta debe tener **6 hijos en ese orden**; si se añade otro elemento, cambiar `grid-row:span 6`.
- Catálogo de SweetBedding: enlace de HiDrive al PDF reducido (`/lnk/e8PVJCkrU`), subido por MCarmen. No se aloja en el repo.

## Novedades sin Feria Hábitat y botón a la página de marca (16 noviembre 2026)

- Retiradas de Novedades (array de novedades en `index.html`) las tarjetas `balance-feria-habitat-2026`, `feria-habitat`, `treku-aura` y `essenzia-buckingham`. El banner "En directo · Feria" queda desactivado (`!1&&` delante). Las páginas `feria-habitat-2026.html` y `balance-feria-habitat-2026.html` se mantienen publicadas y en el sitemap, por decisión de MCarmen.
- Cada tarjeta de marca lleva un botón visible "Ver [MARCA] en Galicia" (`.mcs-brandbtn`, estilos en línea) que enlaza a `s.page`. Va **dentro del mismo `div` que "Web del fabricante"**, para que la tarjeta siga teniendo 6 hijos (regla del subgrid de arriba).
- Los enlaces sin `.html` que se ven en la web publicada los pone Netlify (Pretty URLs), no el código. Los canonical apuntan a `.html`; se deja así.

## Tapizados Mayor: solo Ourense y Pontevedra (16 noviembre 2026)

- MCarmen representa Tapizados Mayor **solo en Ourense y Pontevedra**, no en las cuatro provincias. En `scripts/build_brand_pages.py` la marca lleva `zona=("Ourense y Pontevedra", "Ourense e Pontevedra")`; la plantilla usa ese campo en la descripción, la introducción, "Cómo trabajo…", la llamada final y el texto de WhatsApp. Sin `zona`, la página habla de las cuatro provincias.
- Se mantienen "en Galicia" en el título, el H1 y la dirección (`tapizados-mayor-galicia.html`): las dos provincias son Galicia y cambiar la URL rompería enlaces.

## Segunda pasada sobre el informe de SEOptimer (16 noviembre 2026)

Rama `seo/auditoria-rendimiento`. Solo cambia la portada (`index.html`, y con ella `/gl/`), `cookies.js` y `_redirects`.
- **Texto de los enlaces:** fuera los "Leer más" y "Explorar". Los botones de novedades dicen a dónde llevan (`linkLabel`/`linkLabelGl` en `mcsNovedades`) y los tres de la franja superior son "Ver las marcas" (`explorar` en `mcsI18n`). Novedad nueva: escribir un `linkLabel` que nombre el destino, nunca "Leer más" ni "Ver más".
- **Enlaces de WhatsApp con mensaje:** la dirección larga de `wa.me?text=…` ya no va en la página. Se usa una dirección corta (`/whatsapp-blue-friday`, `/whatsapp-blue-friday-gl`) definida en `_redirects`. Para otra campaña: añadir su línea en `_redirects` y enlazar la dirección corta.
- **Nada bloquea el pintado:** `cookies.js` carga con `defer` (se sigue ejecutando antes que la app, que lee `window.mcsCookiesActive`) y las `@font-face` van dentro de `index.html` con rutas `/fonts/…` en lugar de la hoja `fonts/fonts.css` (que siguen usando las demás páginas). Se precargan Inter 400, Playfair 500 y la foto principal.
- **Correo:** la dirección no aparece escrita en el HTML de la portada. Se ve igual en pantalla, pero el enlace se arma al pasar el ratón, tocar o enfocar (`mcsMail`, atributos `data-u`/`data-d`). También salió del JSON-LD. Las páginas legales y de marca lo mantienen visible (obligación de identificación del titular).
- **Imágenes de portada:** copias WebP ya reducidas en `images/portada/` (1,65 MB → 0,45 MB). Los originales de `images/` no se tocan porque los usan otras páginas, los correos y Open Graph. Foto nueva para la portada: guardar el original en `images/` y la copia WebP (máx. ~960 px de ancho, calidad 76) en `images/portada/`.
- **Sin atributos `style`:** todo pasó a clases en el último `<style>` de la cabecera (prefijo `#root` para que mantengan la prioridad que tenía el atributo). El encuadre de cada foto de marca sigue saliendo de `pos`/`zoom` en `ql`: la app escribe una regla `.mcs-ph-<id>` por marca. No volver a usar `style:{…}` en la app; añadir una clase.
- **Se deja como está:** direcciones terminadas en `.html`. Quitarlas obliga a redirigir todas las páginas ya indexadas y Google no lo premia.
