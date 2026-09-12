# Tarifas Mayor (Calculadora de Tarifas) — Notas técnicas y de recuperación de datos

Documentación específica de `tarifas-mayor.html`, para dar continuidad al trabajo sin
depender de la memoria de ninguna conversación concreta. Si empiezas un chat nuevo,
pégale este archivo a Claude (o dile "lee NOTES_TARIFAS_MAYOR.md del repo").

Es una app de una sola página en JavaScript vanilla (sin frameworks). Vive entera en
`tarifas-mayor.html`, publicada en https://mcsrepresentaciones.es/tarifas-mayor.html
(mismo repo, mismo Netlify que el resto del sitio — ver `NOTES.md` para infraestructura
general, credenciales de GitHub/Netlify, flujo de publicación, etc).

## Qué hace la app

Calculadora de tarifas de Tapizados Mayor: el usuario elige un modelo (o busca libre, o
usa el buscador rápido por categoría+medida), filtra por tipo/cabezal/cheslong/medida, y
ve el precio en puntos y en euros de cada artículo (el valor del punto es editable y se
guarda en el dispositivo).

## Estructura de datos: `PRODUCTOS`

Un único array JS embebido en el HTML (dentro de un `<script>`, variable `const
PRODUCTOS=[...]`). Cada producto:

```json
{
  "id": 67325,
  "titulo": "TRIANA SOFA CAMA 160X200 (228CM) Tela",
  "coleccion": "SOFÁS CAMA",
  "subcol": "TRIANA (mecanismo italiano - colchón 15cm)",
  "puntos": {"O": 745, "A": 770, "B": 795, "C": 820, "D": 845},
  "puntosExpress": 595   // opcional, ver más abajo
}
```

- **`id`**: los productos originales (del PDF `MAYOR_CAT_ESP_2026_A.pdf` que dio pie a
  crear la app) usan IDs de 5 dígitos (50000-70999 aprox, vienen de un sistema externo).
  Los productos que hemos añadido nosotros a mano en esta conversación usan IDs propios
  a partir de **90001** en adelante, para no colisionar nunca con IDs reales. Antes de
  añadir productos nuevos, comprobar el ID máximo en uso:
  `node -e "...Math.max(...PRODUCTOS.map(p=>p.id))..."`.
- **`coleccion`**: `"VANGUARDIA"` (relax/deslizante/fijo), `"SOFÁS CAMA"`, o `"AUXILIAR"`
  (cojines, butacas, pouffs sueltos).
- **`subcol`**: identifica el modelo. El nombre visible en la app es `subcol` con el
  sufijo entre paréntesis quitado (regex `/\s*\(.*\)$/`). Por eso todos los subcol de un
  mismo modelo llevan un sufijo distinto entre paréntesis aunque se muestren igual (p.ej.
  `"GIO (relax cardio y fijos)"` y `"GIO (mecanismo italiano - colchón 18cm)"` son DOS
  modelos distintos que ambos se muestran como "GIO" — uno es relax, el otro es cama. Se
  distinguen por categoría, ver más abajo).
- **`puntos`**: tarifa normal, series S/0 (`"O"`), S/A, S/B, S/C, S/D. No todas las series
  existen siempre para todos los artículos (algunos empiezan en S/A porque esa medida no
  tiene precio en la serie S/0 — ver ejemplo Gio 160cm en la tarifa Express).
- **`puntosExpress`**: precio fijo de promoción, **solo válido con las 8 telas de la
  promo Mayor Express 2026** (Oackland C/3, C/6, C/7, C/8, Loto C/02, C/16, C/03, C/17).
  Con cualquier otra tela o medida, se aplica la tarifa normal (`puntos`). Se muestra en
  el modal del artículo con un aviso destacado (`#modalExpress`). Lista de telas en la
  constante `TELAS_EXPRESS` del JS.

## Colección AURUM (fijos de alta gama, catálogo `AURUM_ESP.pdf`)

Añadida el 10-sep-2026. Es una colección de sofás fijos (Amelie, Colette, Nadine,
Sophie) con estructura modular (sofás base, sofá+chaiselongue, módulos 1 brazo,
central, central doble, chaiselongue suelta, rincón, terminal, pouff). Encaja en
el mismo `PRODUCTOS` y usa el mismo motor de filtros/buscador que el resto, con
estas diferencias respecto al resto del catálogo:

- **`coleccion`**: siempre `"AURUM"`. Esto le da su propia pestaña de categoría
  (`"Aurum"`, añadida a `CATEGORIA_ORDER` y a la función que calcula
  `p._categoria`) en vez de caer en Relax/Fijo/Sofá cama por defecto.
- **`subcol`**: `"<MODELO> (aurum fijo)"` (AMELIE, COLETTE, NADINE, SOPHIE).
- **Series de precio distintas**: AURUM va de **S/A a S/E** (no tiene S/O). Por
  eso `SERIE_ORDER` se amplió a `['O','A','B','C','D','E']`; los productos del
  resto del catálogo simplemente no tienen la clave `E` y esa fila no se pinta.
- **Sin `puntosExpress`** (no aplica a esta colección) y **sin `_cabezal`** (no
  hay variantes con cabezal motorizado/manual, por lo que ese filtro no aparece
  para estos modelos).
- **Cheslong**: solo existe la variante "fija" (no hay rinconera ni arcón en
  AURUM), y solo cuenta como "con cheslong" cuando el título combina cuerpo +
  chaiselongue con "+" (mismo criterio que el resto del catálogo).
- **IDs**: rango propio **91001–91091** (91 artículos: 20 Amelie + 18 Colette +
  26 Nadine + 27 Sophie), para no colisionar con los IDs de fábrica ni con los
  90001+ ya usados en otras adiciones manuales.
- **Medida total**: los sofás base y sillones llevan la medida total como
  primer número del título (antes de "ASIENTOS"), así el cálculo automático de
  `_medidaTotal` la coge bien sin necesidad de paréntesis. Las composiciones
  sofá+chaiselongue sí llevan el total explícito entre paréntesis al final
  (igual que en el resto del catálogo), porque ahí no se puede inferir sumando.
- Los precios están tomados directamente de las tablas de tarifa por módulo
  (páginas 28–31 de `AURUM_ESP.pdf`), no de las composiciones de ejemplo del
  catálogo fotográfico (esas solo muestran combinaciones de tela/medida a
  título ilustrativo, no son artículos individuales facturables).

## Convención "(XXXCM)" en el título — medida TOTAL

Cuando un título lleva un número entre paréntesis seguido de CM, ese número es **la
medida total/final de la pieza** (el largo real que ocupa en la habitación), a
diferencia de otros números sueltos en el título que pueden ser el ancho del asiento,
del colchón, del mecanismo, de un módulo suelto, etc. Ejemplo:
`"CITY SOFA CON 2RELAX MOTORIZADOS 87CMS (226CM) Tela"` → asiento 87cm, pero el sofá
completo mide 226cm.

Esta convención la hemos ido añadiendo nosotros a mano, producto a producto, sacando los
números de las fichas técnicas de los PDF originales (nunca inventados — cuando no
teníamos el dato verificado, no se ha puesto ningún paréntesis). **No todos los
productos tienen esta medida total todavía** — ver sección "Qué falta" más abajo.

Dos campos calculados en tiempo de ejecución (recorriendo el título) leen estos números:

- **`p._medidas`**: TODOS los números seguidos de "CM" en el título (incluye el/los
  asiento(s) Y el total si lo hay). Se usa para el filtro "MEDIDA ASIENTO" dentro de un
  modelo — ahí interesa ver todas las medidas posibles, asiento y total mezclados, tal
  como las pide el usuario final.
- **`p._medidaTotal`**: un único número — el de dentro del ÚLTIMO paréntesis `(XXXCM)`
  si existe; si no, el mayor de los dos números en un patrón `NNNxNNN` (p.ej. sofás cama
  "140X200" → 200); si tampoco, el primer número con CM. Se usa **solo** en el buscador
  rápido por medida (pestañas de categoría), porque ahí lo que importa es si la pieza
  cabe en la habitación, no el ancho del mecanismo/asiento.

Si en el futuro se añade un producto nuevo, **siempre poner la medida total real entre
paréntesis al final del título** (antes de "Tela"), formato `(XXXCM)`, para que ambos
campos se calculen bien solos.

## Categorías (pestañas Relax / Deslizante / Fijo / Sofá cama)

Cálculo (`p._categoria`), por prioridad:

```js
p.coleccion === 'AUXILIAR' ? 'Auxiliar'
: (p.coleccion === 'SOFÁS CAMA' || /mecanismo|colchón/i.test(subcol)) ? 'Sofá cama'
: /deslizante/i.test(subcol) ? 'Deslizante'
: subcol === 'MARTINA (fijo)' ? 'Fijo'
: 'Relax'
```

No hace falta mantener una lista a mano: cualquier `subcol` nuevo que contenga
"deslizante" o "mecanismo"/"colchón" cae solo en su categoría correcta.

## Tabla de modelos actual (fecha: esta sesión)

| Categoría | Modelo (subcol) | Nº artículos | Estado medida total |
|---|---|---|---|
| Relax | AKUA (relax cardio y fijos) | 74 | Parcial (bases sí, algunos combos no verificados) |
| Relax | GIO (relax cardio y fijos) | 75 | Completo |
| Relax | STELA/ESTELA (relax cardio y fijos) | 78 | Completo (ver nota subcol "STELA" más abajo) |
| Relax | TESLA (relax y fijos) | 52 | Completo |
| Relax | TRIANA (relax y fijos) | 53 | Completo |
| Relax | TICO (relax y fijos) | 37 | Completo |
| Relax | CITY (relax y fijos) | 57 | Completo |
| Deslizante | SENSE, MAGNUM, NOA, Nina, POLO, POLO CARRO, TOMMY, LOTUS (deslizante de bandeja) | 45-75 c/u | Ya traían medida total en origen, no se ha tocado |
| Fijo | MARTINA (fijo) | 20 | Completo |
| Sofá cama | GIO (mecanismo...18cm) | 2 | Completo — nuevo, del catálogo Express+Camas |
| Sofá cama | AMORE Y PARIS (mecanismo...16cm) | 4 | Completo |
| Sofá cama | TRIANA (mecanismo...15cm) | 3 | Completo |
| Sofá cama | LOTUS 5 MAX (mecanismo...15cm) | 3 | Completo — nuevo |
| Sofá cama | LYRA (mecanismo...15cm) | 2 | Completo — nuevo |
| Sofá cama | KIMI (mecanismo...15cm) | 2 | Completo — nuevo |
| Sofá cama | MAGNUM (mecanismo...15cm) | 8 | Completo — nuevo |
| Sofá cama | CHANNEL (mecanismo...12cm) | 2 | Completo |
| Sofá cama | MARTINA (mecanismo...12cm) | 10 | Completo |
| Sofá cama | FENDY (mecanismo...12cm) | 4 | Completo (total asumido igual con/sin cabezales) |
| Sofá cama | TOPO (mecanismo...12cm) | 3 | Completo — separado de "TOPO,PETIT Y GEO" |
| Sofá cama | GEO (mecanismo...12cm) | 3 | Completo — separado de "TOPO,PETIT Y GEO" |
| Sofá cama | PETIT (mecanismo...12cm) | 3 | Completo — nuevo, no existía ningún artículo antes |
| Sofá cama | LOTUS (mecanismo...15cm) | 9 | Sin verificar (solo se quitó la variante chaiselongue, descatalogada) |
| Sofá cama | BIANCA (mecanismo...15cm) | 4 | **Sin verificar** |
| Sofá cama | VEGA Y VIGO (mecanismo...12cm) | 2 | **Sin verificar** |
| Aurum | AMELIE (aurum fijo) | 20 | Completo — nuevo, catálogo AURUM_ESP.pdf |
| Aurum | COLETTE (aurum fijo) | 18 | Completo — nuevo |
| Aurum | NADINE (aurum fijo) | 26 | Completo — nuevo |
| Aurum | SOPHIE (aurum fijo) | 27 | Completo — nuevo |
| Auxiliar | AUXILIAR (cojines, butacas, pouffs) | 24 | No aplica medida total (se usa el ancho/alto de la pieza tal cual) |

**Modelos eliminados por descatalogación** (según aviso de fábrica, sesión de
5-sep-2026): KENZO, KIARA, INKA, COCÓ, ELI/KUORE/PREMIUM (subcol combinado), y la
variante LOTUS CHAISELONGUE (se mantuvo LOTUS cama normal). Si fábrica los vuelve a dar
de alta, están descritos con todo detalle en el historial de git (commit
`e946b82` y conversación de esa fecha) por si hay que recuperarlos.

**Nota subcol "STELA" vs "ESTELA":** el subcol real en los datos es `"STELA (relax
cardio y fijos)"` (con typo, sin la E inicial), pero el modelo real de fábrica se llama
**ESTELA** (cabezales motorizados elevables y reclinables + relax "cardio"). No se ha
corregido el subcol para no romper el histórico de facetas guardadas; si se quiere
arreglar el nombre visible, cambiar el `subcol` de todos sus productos y verificar que
no rompe nada más.

## Filtro "con/sin cheslong" en el buscador rápido

El buscador rápido por medida (home) tiene 3 chips: Todos / Con cheslong / Sin cheslong.

- `p._chaiseComposicionAsientos`: true solo si el título tiene "CHAI" Y un "+" (sofá con
  asientos combinado con la pieza de chaise). Los módulos de chaise SUELTOS (auxiliares,
  sin "+" en el título, ej. "GIO MODULO CHAISE.RINCONERA...", "STELA MOD.CHAISELONGUE...")
  no cuentan como "con cheslong" porque no son un sofá completo.
- `_medidaTotal` **nunca** se calcula combinando el ancho del asiento con el ancho de la
  cheslong a mano: si no hay `(XXXCM)` verificado en el título Y la pieza es una
  composición con chaise, `_medidaTotal` se deja en `null` (no aparece en el buscador por
  medida) en vez de mostrar un número inventado.

## `_medidaTotal`: qué formatos de paréntesis reconoce

El regex acepta `(226CM)`, `(226 CM.)` y también pares `(370 x 225 CM.)` (composiciones en
L con módulo rincón + terminal: ahí se usa el mayor de los dos números, el lado largo).
Esto se descubrió porque el modelo **TOMMY** usa el formato "370 CM." (con espacio y
punto) en vez de "370CM", y el regex antiguo no lo reconocía.

## Qué falta / pendiente de verificar

- **BIANCA y VEGA** (sofá cama): no se ha tocado su medida total porque no ha
  aparecido su ficha técnica en ningún documento revisado hasta ahora.
- **VIGO** (sofá cama + chaiselongue 160cm): sin ficha técnica con el total verificado.
- **LOTUS (mecanismo...15cm)**: sus composiciones con chaiselongue (80X160/80X185/
  160X70/185X70) siguen sin medida total verificada; no aparece en el catálogo
  `MAYOR_CAT_ESP_2026_A.pdf` revisado.
- **AKUA SOFA 2FIIJOS 62CMS + CHAISE. FIJA 165CM** (nótese el typo "FIIJOS" en el título
  real): no coincide con el patrón de detección por typo; sigue sin medida total aunque
  el resto de la familia AKUA sí la tiene (249CM, mismo valor que sus hermanos de 62cm).
- **POLO 2PL + CHAISELONGUE FIJA 170CMS**: la tabla del catálogo solo da totales para
  3,5PL/3PL/2,5PL + chaise; el combo 2PL + chaise no aparece con total en la tabla.
- El resto de familias con cheslong (AKUA, TICO, SENSE, MAGNUM, NINA, NOA, POLO 3,5/3/2,5PL)
  ya tienen medida total verificada, sacada de `MAYOR_CAT_ESP_2026_A.pdf` (tablas de
  composición con el total entre paréntesis).

## Modelos discontinuados eliminados del catálogo (septiembre 2026)

- **LOTUS (deslizante de bandeja)**: la versión sofá/relax de LOTUS (con o sin
  chaiselongue, módulos sueltos, sillones, etc. — 56 artículos) se ha eliminado. LOTUS
  ahora **solo se fabrica como sofá cama** (subcol `LOTUS (mecanismo italiano - colchón
  15cm)` y `LOTUS 5 MAX (mecanismo italiano - colchón 15cm)`), que sí se mantiene.
- **BIANCA** (sofá cama, subcol `BIANCA (mecanismo original italiano - colchón 15cm)`):
  modelo eliminado, 4 artículos borrados.
- **VEGA y VIGO** (subcol `VEGA Y VIGO (mecanismo italiano - colchón 12cm)`): modelo
  eliminado, 2 artículos borrados (los únicos que había, ambos titulados VIGO).

Si en el futuro se recupera alguno de estos modelos, hay que volver a añadir sus
productos siguiendo el mismo proceso descrito abajo y el flujo de edición del JSON con Python.

## Cómo añadir/verificar una medida total (proceso seguido en esta sesión)

1. Conseguir la ficha técnica del modelo (PDF o doc de fábrica) con la tabla
   "COMPOSICIÓN / DESCRIPCIÓN" que lleva el total entre paréntesis, o el dibujo técnico
   con las medidas acotadas.
2. Si es un `.docx`: `pandoc -t markdown archivo.docx` para leer texto, y si hace falta
   ver los dibujos, convertir a PDF con LibreOffice
   (`python /mnt/skills/public/docx/scripts/office/soffice.py --headless --convert-to pdf`)
   y renderizar páginas con `pdftoppm -jpeg` para poder mirarlas como imágenes.
3. Localizar en `PRODUCTOS` los artículos de ese modelo (`p.subcol === '...'`) y
   emparejar cada composición del PDF con su producto por ancho de asiento + tipo
   (relax/fijo/sillón/chaise...).
4. Insertar `" (XXXCM)"` justo antes de la palabra final "Tela" del título (regex
   `/\s*Tela\.?\s*$/i`), nunca sobrescribir el título entero, para no perder nada del
   texto original.
5. Verificar sintaxis siempre antes de publicar: extraer los `<script>` con Python/regex
   y correr `node --check archivo.js` sobre cada uno.
6. Nunca inventar una medida total si no está confirmada en una fuente — mejor dejarla
   sin verificar (así queda documentado aquí) que arriesgarse a dar un dato de fábrica
   incorrecto a un comercial.

## Funcionalidades añadidas en esta sesión (5-sep-2026)

- **Botón atrás (móvil y navegador) va al inicio** en vez de cerrar la app: historial de
  navegación con `history.pushState`/`popstate` (estados `home`, `model`, `search`,
  `modal`, `quicksize`). Ver funciones `pushHistory`, `showModelView`, `showSearchView`,
  `showQuickSizeView`, `goHome` y el listener de `popstate`.
- **Filtros cruzados**: dentro de un modelo, elegir un valor de Tipo/Cabezal/Cheslong
  estrecha las opciones de los demás filtros (incluida Medida asiento) a lo que
  realmente existe con esa combinación. Ver `itemsExcept()` dentro de
  `renderFacetsAndList()`.
- **Pestañas de categoría + buscador rápido por medida total** en la pantalla de inicio
  (`#catTabs`, `#quickSize`): cruza TODOS los modelos de una categoría por medida total,
  con operador menos de / igual a / más de.
- **"CHERLON" → "CHESLONG"** corregido en todos los títulos de producto Y en las
  etiquetas de la interfaz (antes "Cheslón").
- **Precio PROMO EXPRESS** (ver arriba, campo `puntosExpress`).

## Fuentes usadas en esta sesión

- `MAYOR_CAT_ESP_2026_A.pdf` — catálogo general (relax, deslizante, fijo). Base de casi
  todos los `PRODUCTOS` originales.
- `MAYOR_EXPRESS_2026.pdf` — promo Express: Gio, Amore, Paris, Triana, Lotus 5 Max,
  Lyra, Kimi, Channel (camas) con precio especial en 8 telas concretas + dibujos con
  medidas totales.
- `MAYOR_CAMAS_2026.docx` — catálogo completo de sofás cama 2026 (24 páginas): Gio,
  Amore, Paris, Magnum, Triana, Lotus 5Max, Lyra, Kimi, Martina, Fendy, Petit, Geo,
  Topo, Channel. Fuente de la medida total verificada para todos estos modelos y de los
  3 modelos nuevos dados de alta (Magnum cama, Petit, y separación Topo/Geo).
- Aviso de WhatsApp (captura de pantalla) — descatalogación de KENZO, KIARA, INKA, COCÓ,
  ELI/KUORE/PREMIUM y LOTUS CHAISELONGUE.
