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
