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

Casos ya resueltos así: `.mcs-logo`, `.mcs-brandname`, `.mcs-brandsub`, `.mcs-photo-box`.

## Historial de bugs importantes ya resueltos

- **Página en blanco en producción:** variable `tl` declarada por Claude colisionó con una función interna del bundle minificado también llamada `tl()`. Lección: antes de introducir un nombre de variable nuevo, comprobar con `grep -o '\bNOMBRE\b' index.html` que no existe ya.
- **Traducción automática de Chrome rompía nombres de marca** ("Mayor"→"Alcalde"): el `<html>` tenía `lang="en"`. Fix: `lang="es"` + `<meta name="google" content="notranslate">`.
- **Logo del header tapaba el contenido al hacer scroll:** el logo medía 190px pero el header solo 72px de alto, con `overflow-visible`. Fix: logo reducido a 58px (cabe dentro del header) y quitado el overflow-visible.
- **Fotos de marca de tamaño visual inconsistente:** el contenedor usaba `h-[260px]` (clase arbitraria no compilada, ver lección de arriba). Fix: `.mcs-photo-box{height:260px}`.

## Estructura de datos dentro del código

- **`ql` (array):** las 6 marcas (Treku, Baixmoduls, Tobisa, Essenzia Dormire, Tapizados Mayor, KingSofá). Cada una tiene `id, name, logo, photo, web, zoom, pos, year, desc, tag, estancia, featured`. `zoom` y `pos` controlan el encuadre de la foto de portada (algunas fotos son tomas de habitación completa y necesitan más zoom para verse a un tamaño similar a las demás).
- **`mcsCatalogos` (array):** catálogos PDF públicos descargables por marca, se muestran al pulsar "Ver catálogo" en cada tarjeta. Campos: `marca, nombre, url`.
- **`mcsTarifas` (array):** tarifas privadas por marca (área profesional), se filtran por el selector de marca. Campos: `marca, nombre, url`. **KingSofá y Essenzia Dormire NO tienen tarifa** (confirmado, no es un error).

## ⚠️ Pendiente — enlaces duplicados en mcsCatalogos

Tres pares de catálogos apuntan al mismo enlace de IONOS por error de origen (vienen así del Excel/app de gestión de MCarmen), pendientes de que ella confirme los enlaces correctos:
1. "Telas 2026" (Essenzia) y "Ares-Denver" (KingSofá) → mismo link `KM6M0pZqc`
2. "Catálogo General" (Essenzia) y "Paneles Decorativos" (Baixmoduls) → mismo link `W1ZsSYN4X`
3. "Arko 360" y "Armarios" (ambos Baixmoduls) → mismo link `E6QFtLEn3`

## Imágenes

Todas en `/images/` dentro del repo: logos de marca (`logo-*.png/jpeg`), fotos de producto (`foto-*.jpg/webp`), logo MCS, foto de perfil de MCarmen.

## Credenciales

El token de GitHub para hacer push **no se guarda en este archivo por seguridad**. MCarmen lo tiene guardado aparte; si Claude necesita hacer push y no lo tiene en el contexto de la conversación, hay que pedírselo.
