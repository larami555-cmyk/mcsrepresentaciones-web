#!/usr/bin/env python3
"""Genera las páginas de marca (treku-galicia.html, etc.) a partir de los datos de abajo.

Uso:  python3 scripts/build_brand_pages.py     (desde la raíz del repo)

- Los textos están aquí, en castellano (es) y gallego (gl). Para cambiar un texto,
  editarlo aquí y volver a ejecutar el script; no editar los .html a mano.
- Las fotos de cada página son las 6 más recientes de content/catalogo/<carpeta>/.
- Solo se usan datos que ya figuran en la web. No añadir datos de fabricantes sin confirmar.
"""
import glob, html, json, os, re, struct, urllib.parse

SITE = "https://mcsrepresentaciones.es"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WA = "https://wa.me/34619620363?text="


def img_size(path):
    """Ancho y alto de un JPG/PNG/WebP sin dependencias externas."""
    with open(path, "rb") as f:
        d = f.read()
    if d[:8] == b"\x89PNG\r\n\x1a\n":
        return struct.unpack(">II", d[16:24])
    if d[:4] == b"RIFF" and d[8:12] == b"WEBP":
        if d[12:16] == b"VP8X":
            return (int.from_bytes(d[24:27], "little") + 1, int.from_bytes(d[27:30], "little") + 1)
        if d[12:16] == b"VP8 ":
            w, h = struct.unpack("<HH", d[26:30])
            return (w & 0x3FFF, h & 0x3FFF)
        if d[12:16] == b"VP8L":
            b = int.from_bytes(d[21:25], "little")
            return ((b & 0x3FFF) + 1, ((b >> 14) & 0x3FFF) + 1)
    i = 2
    while i < len(d):  # JPEG
        if d[i] != 0xFF:
            i += 1
            continue
        m = d[i + 1]
        if m in (0xC0, 0xC1, 0xC2):
            h, w = struct.unpack(">HH", d[i + 5:i + 9])
            return (w, h)
        i += 2 + struct.unpack(">H", d[i + 2:i + 4])[0]
    return (0, 0)


BRANDS = [
    dict(
        slug="treku-galicia",
        fit=("Mobiliario contemporáneo personalizable, con especial protagonismo de aparadores, muebles de televisión y estanterías de colecciones como Aura, Lauki y Bost. Encaja en tiendas de diseño y estudios de interiorismo que buscan piezas con identidad y distintas posibilidades de composición.",
             "Mobiliario contemporáneo personalizable, con especial protagonismo de aparadores, mobles de televisión e andeis de coleccións como Aura, Lauki e Bost. Encaixa en tendas de deseño e estudios de interiorismo que buscan pezas con identidade e distintas posibilidades de composición."), id="treku", folder="treku", name="Treku", photo="images/foto-treku.jpg",
        logo="images/logo-treku.png", web="https://www.treku.com",
        cat=("mueble de diseño contemporáneo", "moble de deseño contemporáneo"),
        tag=("Diseño de autor · Zarautz, 1947", "Deseño de autor · Zarautz, 1947"),
        intro=("Soy la agente comercial de Treku para las tiendas de muebles de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de Treku para as tendas de mobles da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("Treku fabrica mueble contemporáneo en Zarautz desde 1947 y exporta a más de 50 países. Son piezas de autor en chapa natural, con acabados muy cuidados: la calidad y el diseño ante todo.",
            "Treku fabrica moble contemporáneo en Zarautz desde 1947 e exporta a máis de 50 países. Son pezas de autor en chapa natural, con acabados moi coidados: a calidade e o deseño ante todo."),
        p2=("Trabajo con los catálogos Living, Night, Systems y Contract, las colecciones Bidea, Lur y Tarte y las novedades News 27. Hay tarifa de hogar y tarifa de contract.",
            "Traballo cos catálogos Living, Night, Systems e Contract, as coleccións Bidea, Lur e Tarte e as novidades News 27. Hai tarifa de fogar e tarifa de contract."),
        p3=("Las tiendas distribuidoras tienen además el configurador online DecoTreku: sirve para generar presupuestos, enviar pedidos y guardar proyectos con los precios de tu tarifa. En <a href=\"/feria-habitat-2026.html\">Feria Hábitat València 2026</a> estuve con sus novedades.",
            "As tendas distribuidoras teñen ademais o configurador en liña DecoTreku: serve para xerar orzamentos, enviar pedidos e gardar proxectos cos prezos da túa tarifa. Na <a href=\"/feria-habitat-2026.html\">Feira Hábitat València 2026</a> estiven coas súas novidades."),
    ),
    dict(
        slug="baixmoduls-galicia",
        fit=("Salones modernos, muebles de televisión, dormitorios de matrimonio y armarios, con variedad de medidas y acabados. Encaja en tiendas de muebles que trabajan por proyectos y necesitan coordinar varias estancias con una estética actual.",
             "Salóns modernos, mobles de televisión, dormitorios de matrimonio e armarios, con variedade de medidas e acabados. Encaixa en tendas de mobles que traballan por proxectos e precisan coordinar varias estancias cunha estética actual."), id="baixmoduls", folder="baixmoduls", name="Baixmoduls", photo="images/foto-baixmoduls.jpg",
        logo="images/logo-baixmoduls.jpeg", web="https://www.baixmoduls.com",
        cat=("mueble modular", "moble modular"),
        tag=("Mueble funcional · Barcelona", "Moble funcional · Barcelona"),
        intro=("Soy la agente comercial de Baixmoduls para las tiendas de muebles de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de Baixmoduls para as tendas de mobles da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("Baixmoduls es un fabricante de mueble modular de Barcelona: grandes soluciones adaptadas a cualquier espacio, para salón, dormitorio y armarios.",
            "Baixmoduls é un fabricante de moble modular de Barcelona: grandes solucións adaptadas a calquera espazo, para salón, dormitorio e armarios."),
        p2=("Sus programas son Arko y Arko 360, ADN, Dormitorios, Armarios y Paneles Decorativos, cada uno con su catálogo y su tarifa.",
            "Os seus programas son Arko e Arko 360, ADN, Dormitorios, Armarios e Paneis Decorativos, cada un co seu catálogo e a súa tarifa."),
        p3=("De Arko 360 hay un dosier con 13 composiciones de módulos TV para enseñar en tienda, y la marca tiene una web de recursos con renders, fichas técnicas y materiales de apoyo a la venta.",
            "De Arko 360 hai un dossier con 13 composicións de módulos TV para ensinar na tenda, e a marca ten unha web de recursos con renders, fichas técnicas e materiais de apoio á venda."),
    ),
    dict(
        slug="tobisa-galicia",
        fit=("Mobiliario a medida y personalizado, con propuestas de dormitorios juveniles, armarios y vestidores. Encaja en tiendas que ofrecen asesoramiento y soluciones para aprovechar el espacio, además de estudios de decoración e interiorismo.",
             "Mobiliario á medida e personalizado, con propostas de dormitorios xuvenís, armarios e vestidores. Encaixa en tendas que ofrecen asesoramento e solucións para aproveitar o espazo, ademais de estudios de decoración e interiorismo."), id="tobisa", folder="tobisa", name="Tobisa", photo="images/foto-tobisa.jpg",
        logo="images/logo-tobisa.jpeg", web="https://www.tobisamuebles.com",
        cat=("mueble juvenil y a medida", "moble xuvenil e á medida"),
        tag=("A medida · La Sénia, 1999", "Á medida · La Sénia, 1999"),
        intro=("Soy la agente comercial de Tobisa para las tiendas de muebles de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de Tobisa para as tendas de mobles da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("Tobisa fabrica en La Sénia desde 1999 mueble a medida para salón, dormitorio y vestidor. Su lema: crecimiento sin límites, calidad sin concesiones.",
            "Tobisa fabrica en La Sénia desde 1999 moble á medida para salón, dormitorio e vestidor. O seu lema: crecemento sen límites, calidade sen concesións."),
        p2=("Trabajo con el Catálogo General, el de Armarios y el catálogo OTA, y con una carta de acabados amplia —Ranurado, Lux, Equal y Delinea— con frentes y tiradores a elegir.",
            "Traballo co Catálogo Xeral, o de Armarios e o catálogo OTA, e cunha carta de acabados ampla —Ranurado, Lux, Equal e Delinea— con frontes e tiradores a escoller."),
        p3=("Es la marca para el dormitorio juvenil y el proyecto a medida: dormitorio, salón, lo que se te ocurra. Proyectos que fidelizan al cliente de tu tienda.",
            "É a marca para o dormitorio xuvenil e o proxecto á medida: dormitorio, salón, o que se che ocorra. Proxectos que fidelizan o cliente da túa tenda."),
    ),
    dict(
        slug="essenzia-dormire-galicia",
        fit=("Colchones y sistemas de descanso, con propuestas de muelles ensacados, espumaciones y diferentes niveles de firmeza. Encaja en colchonerías y tiendas de muebles con sección de descanso que quieren ofrecer una elección asesorada según las preferencias del cliente.",
             "Colchóns e sistemas de descanso, con propostas de molas ensacadas, espumacións e diferentes niveis de firmeza. Encaixa en colchoarías e tendas de mobles con sección de descanso que queren ofrecer unha elección asesorada segundo as preferencias do cliente."), id="essenzia", folder="essenzia", name="Essenzia Dormire", photo="images/foto-essenzia.jpg",
        logo="images/logo-essenzia.jpeg", web="https://www.essenziadormire.es",
        cat=("colchones y descanso", "colchóns e descanso"),
        tag=("Descanso premium · Murcia", "Descanso premium · Murcia"),
        intro=("Soy la agente comercial de Essenzia Dormire para las tiendas de muebles y de descanso de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de Essenzia Dormire para as tendas de mobles e de descanso da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("Essenzia Dormire es un fabricante de descanso de Murcia: tecnología de descanso premium certificada.",
            "Essenzia Dormire é un fabricante de descanso de Murcia: tecnoloxía de descanso premium certificada."),
        p2=("Trabajo con el Catálogo General, el catálogo Magnifique, el modelo Springcool 2.0 y la carta de Telas 2026.",
            "Traballo co Catálogo Xeral, o catálogo Magnifique, o modelo Springcool 2.0 e a carta de Teas 2026."),
        p3=("En <a href=\"/feria-habitat-2026.html\">Feria Hábitat València 2026</a> estuve con sus novedades; en esa página tienes fotos y vídeos del stand. Y si un cliente te pregunta por las arrugas de una funda, te servirá la <a href=\"/guia-tejidos-naturales.html\">guía de tejidos naturales</a>.",
            "Na <a href=\"/feria-habitat-2026.html\">Feira Hábitat València 2026</a> estiven coas súas novidades; nesa páxina tes fotos e vídeos do stand. E se un cliente che pregunta polas engurras dunha funda, serviráche a <a href=\"/guia-tejidos-naturales.html\">guía de tecidos naturais</a>."),
    ),
    dict(
        slug="sweetbedding-galicia",
        fit=("Colchones de núcleos perfilados y muelles ensacados, junto con complementos de descanso. Encaja en colchonerías que buscan diferenciar su oferta y explicar al cliente las características de los materiales y del soporte.",
             "Colchóns de núcleos perfilados e molas ensacadas, xunto con complementos de descanso. Encaixa en colchoarías que buscan diferenciar a súa oferta e explicarlle ao cliente as características dos materiais e do soporte."), id="sweetbedding", folder=None, catalogs=True, name="SweetBedding", photo="images/novedad-sweetbedding.jpg",
        logo="images/logo-sweetbedding.png", web="https://sweetbedding.es",
        cat=("colchones y descanso", "colchóns e descanso"),
        tag=("Descanso · Fabricación suiza", "Descanso · Fabricación suíza"),
        intro=("Soy la agente comercial de SweetBedding para las tiendas de muebles y de descanso de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de SweetBedding para as tendas de mobles e de descanso da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("SweetBedding es una marca de descanso de fabricación suiza: colchones artesanales de diseño anatómico en tres colecciones, más somieres y almohadas.",
            "SweetBedding é unha marca de descanso de fabricación suíza: colchóns artesanais de deseño anatómico en tres coleccións, máis somieres e almofadas."),
        p2=("Los colchones van de 80 a 200 cm de ancho, en largos de 190 y 200 cm. El programa se completa con somieres articulados de motor silencioso, bases tapizadas y almohadas.",
            "Os colchóns van de 80 a 200 cm de ancho, en longos de 190 e 200 cm. O programa complétase con somieres articulados de motor silencioso, bases tapizadas e almofadas."),
        p3=("Las tres colecciones, modelo a modelo, están en la <a href=\"/novedad-sweetbedding.html\">ficha de SweetBedding</a>.",
            "As tres coleccións, modelo a modelo, están na <a href=\"/novedad-sweetbedding.html\">ficha de SweetBedding</a>."),
    ),
    dict(
        slug="tapizados-mayor-galicia",
        fit=("Sofás cama, sofás relax y composiciones modulares que combinan diseño, comodidad y funcionalidad. Encaja en tiendas especializadas en sofás y comercios de mobiliario que necesitan resolver tanto el uso diario del salón como una cama adicional.",
             "Sofás cama, sofás relax e composicións modulares que combinan deseño, comodidade e funcionalidade. Encaixa en tendas especializadas en sofás e comercios de mobiliario que precisan resolver tanto o uso diario do salón como unha cama adicional."), id="mayor", folder="tapizadosmayor", name="Tapizados Mayor", photo="images/foto-mayor.jpg",
        logo="images/logo-mayor.jpeg", web="https://www.mayortapizados.com",
        cat=("sofás y tapicería", "sofás e tapicería"),
        tag=("Tapicería · Yecla", "Tapicería · Yecla"),
        intro=("Soy la agente comercial de Tapizados Mayor para las tiendas de muebles y de sofás de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de Tapizados Mayor para as tendas de mobles e de sofás da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("Tapizados Mayor es un fabricante de tapicería de Yecla: sofás relax, deslizantes al suelo y sofás cama italianos.",
            "Tapizados Mayor é un fabricante de tapicería de Yecla: sofás relax, deslizantes ao chan e sofás cama italianos."),
        p2=("Trabajo con el Catálogo General, el catálogo Aurum, el de Sofás Cama, la carta de Telas 2026 y el programa Mayor Express 2026.",
            "Traballo co Catálogo Xeral, o catálogo Aurum, o de Sofás Cama, a carta de Teas 2026 e o programa Mayor Express 2026."),
        p3=("Para la línea Aurum hay una guía de mantenimiento que puedes entregar al cliente final con el sofá.",
            "Para a liña Aurum hai unha guía de mantemento que podes entregar ao cliente final co sofá."),
    ),
    dict(
        slug="kingsofa-galicia",
        fit=("Sofás relax eléctricos, deslizantes y sillones relax, con propuestas que incorporan el sistema KingSofá Cardio System. Encaja en tiendas de tapicería y mobiliario que centran la venta en la prueba del producto, el confort y las distintas opciones de mecanismo.",
             "Sofás relax eléctricos, deslizantes e butacas relax, con propostas que incorporan o sistema KingSofá Cardio System. Encaixa en tendas de tapicería e mobiliario que centran a venda na proba do produto, o confort e as distintas opcións de mecanismo."), id="kingsofa", folder="kingsofa", name="KingSofá", photo="images/foto-kingsofa.webp",
        logo="images/logo-kingsofa.jpeg", web="https://www.kingsofayecla.com",
        cat=("sofás contemporáneos", "sofás contemporáneos"),
        tag=("Sofá contemporáneo · Yecla", "Sofá contemporáneo · Yecla"),
        intro=("Soy la agente comercial de KingSofá para las tiendas de muebles y de sofás de A Coruña, Lugo, Ourense y Pontevedra.",
               "Son a axente comercial de KingSofá para as tendas de mobles e de sofás da Coruña, Lugo, Ourense e Pontevedra."),
        p1=("KingSofá es un fabricante de tapicería de Yecla: sofá joven y actual, de diseño accesible y con estructura de alto rendimiento.",
            "KingSofá é un fabricante de tapicería de Yecla: sofá novo e actual, de deseño accesible e con estrutura de alto rendemento."),
        p2=("Trabajo con los modelos Venus, Heaven, Viena, Munich, Ares-Denver, Golden, Eden, Ankara, Nature, Atenea y Perseo, además de las butacas y de su carta de telas.",
            "Traballo cos modelos Venus, Heaven, Viena, Munich, Ares-Denver, Golden, Eden, Ankara, Nature, Atenea e Perseo, ademais das butacas e da súa carta de teas."),
        p3=("También tienes los catálogos de carro —pata alta y al suelo— y la documentación del sistema Cardio System.",
            "Tamén tes os catálogos de carro —pata alta e ao chan— e a documentación do sistema Cardio System."),
    ),
]

CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',sans-serif;background:#FAF8F5;color:#121212;line-height:1.5}
h1,h2,.serif{font-family:'Playfair Display',serif}
.wrap{max-width:860px;margin:0 auto;padding:0 24px}
header{background:linear-gradient(135deg,#F2ECE1 0%,#EAD9C8 60%,#E3C9AE 100%);padding:36px 0 56px}
.header-top{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-bottom:28px;border-bottom:1px solid rgba(18,18,18,0.12);margin-bottom:40px}
.logo{display:inline-block;font-size:0;line-height:0;border-radius:2px;overflow:hidden;text-decoration:none}
.logo img{display:block;height:84px;width:auto}
.crumbs{font-size:12px;letter-spacing:.04em;color:#5A534D}
.crumbs a{color:#5A534D;text-decoration:none}
.crumbs a:hover{text-decoration:underline}
.eyebrow{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C1633D;font-weight:600;margin-bottom:18px}
h1{font-size:42px;line-height:1.1;font-weight:600;margin-bottom:20px}
h1 em{font-style:italic;color:#C1633D;font-weight:500}
.intro{font-size:17px;color:#3d362e;max-width:600px}
main{padding:48px 0 40px}
.hero{display:block;width:100%;height:auto;max-height:520px;object-fit:cover;border-radius:2px;margin-bottom:40px}
.section{padding:28px 0;border-bottom:1px solid #EDE8E0}
.section h2{font-size:24px;font-weight:500;margin-bottom:12px}
.section p{font-size:15.5px;line-height:1.65;color:#5A534D;max-width:680px;margin-bottom:12px}
.section p:last-child{margin-bottom:0}
.section a{color:#C1633D}
.section a.btn{color:#121212}
.section a.btn.dark{color:#fff}
.brandlogo{display:block;height:34px;width:auto;margin-bottom:14px}
.gal{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}
.gal img{display:block;width:100%;height:190px;object-fit:cover;background:#f1efe9;border-radius:2px}
.links{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.btn{display:inline-block;padding:13px 22px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;text-decoration:none;border:1px solid #121212;color:#121212;background:transparent}
.btn.dark{background:#121212;color:#fff}
.cta{background:#181410;color:#EDE8E0;padding:32px 36px;margin-top:36px;border-radius:2px}
.cta .eyebrow{color:#D9A56B;margin-bottom:12px}
.cta p{font-size:15.5px;line-height:1.65;color:#EDE8E0;max-width:600px;margin-bottom:20px}
.cta .btn{background:#D9A56B;border-color:#D9A56B;color:#181410}
.others{margin:44px 0 0;padding-top:28px;border-top:1px solid #EDE8E0}
.others-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8A8178;margin-bottom:14px}
.others ul{list-style:none;display:flex;flex-wrap:wrap;gap:8px 10px}
.others a{display:inline-block;padding:8px 14px;border:1px solid #EDE8E0;background:#fff;color:#121212;text-decoration:none;font-size:13px}
.others a:hover{border-color:#121212}
.mcs-rel{margin:36px 0 8px;padding:28px 0 0;border-top:1px solid #EDE8E0}
.mcs-rel-t{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#8A8178;margin-bottom:14px}
.mcs-rel ul{list-style:none;margin:0 0 18px;padding:0}
.mcs-rel li{margin:0 0 10px;font-size:16px;line-height:1.4}
.mcs-rel a{color:#C1633D;text-decoration:none;font-weight:500}
.mcs-rel a:hover{text-decoration:underline}
footer{padding:32px 0 56px;border-top:1px solid #EDE8E0;margin-top:24px}
footer p{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8A7F74}
footer a{color:#8A7F74}
@media (max-width:640px){
  h1{font-size:30px}
  .logo img{height:66px}
  .gal{grid-template-columns:repeat(2,1fr)}
  .gal img{height:140px}
  .cta{padding:24px 22px}
}
"""

ARTICLES = [
    ("normativa-mueble.html", "Normativa del mueble 2026-2030: residuos, ecodiseño y químicos", "Normativa do moble 2026-2030: residuos, ecodeseño e químicos"),
    ("guia-tejidos-naturales.html", "Por qué se arrugan los tejidos naturales (lino, algodón, viscosa)", "Por que se engurran os tecidos naturais (liño, algodón, viscosa)"),
    ("feria-habitat-2026.html", "Feria Hábitat València 2026: fotos y vídeos de las novedades", "Feira Hábitat València 2026: fotos e vídeos das novidades"),
]


def e(s):
    return html.escape(s, quote=True)


def bi(tag, es, gl, cls="", raw=False):
    """Elemento bilingüe: castellano visible, gallego en data-gl (lo aplica el script del final)."""
    c = f' class="{cls}"' if cls else ""
    body = es if raw else e(es)
    return f'<{tag}{c} data-gl="{e(gl)}">{body}</{tag}>'


def gallery(b):
    if not b["folder"]:
        return ""
    items = []
    for md in glob.glob(os.path.join(ROOT, "content/catalogo", b["folder"], "*.md")):
        t = open(md, encoding="utf-8").read()
        m = re.search(r'^imagen:\s*"?([^"\n]+)"?', t, flags=re.M)
        ts = re.search(r"-(\d+)-(\d+)\.md$", md)
        if m and os.path.exists(os.path.join(ROOT, m.group(1).lstrip("/"))):
            items.append((int(ts.group(1)) if ts else 0, int(ts.group(2)) if ts else 0, m.group(1)))
    items.sort(reverse=True)
    out = []
    for n, (_, _, src) in enumerate(items[:6], 1):
        w, h = img_size(os.path.join(ROOT, src.lstrip("/")))
        out.append(f'      <img src="{e(src)}" alt="{e(b["name"])}: {e(b["cat"][0])}, foto de catálogo {n}" width="{w}" height="{h}" loading="lazy" decoding="async">')
    if not out:
        return ""
    return '    <div class="gal">\n' + "\n".join(out) + "\n    </div>\n"


def page(b):
    name, (cat_es, cat_gl) = b["name"], b["cat"]
    url = f"{SITE}/{b['slug']}.html"
    title_es = f"{name} en Galicia: {cat_es} para tiendas | MCS Representaciones"
    title_gl = f"{name} en Galicia: {cat_gl} para tendas | MCS Representaciones"
    desc = f"Agente comercial de {name} en Galicia. {cat_es[0].upper() + cat_es[1:]} para tiendas de A Coruña, Lugo, Ourense y Pontevedra: catálogos, tarifas y visita en tu exposición."
    desc_gl = f"Axente comercial de {name} en Galicia. {cat_gl[0].upper() + cat_gl[1:]} para tendas da Coruña, Lugo, Ourense e Pontevedra: catálogos, tarifas e visita na túa exposición."
    pw, ph = img_size(os.path.join(ROOT, b["photo"]))
    wa_es = WA + urllib.parse.quote(f"Hola MCarmen, tengo una tienda en Galicia y me interesa {name}.")
    wa_gl_text = f"Ola MCarmen, teño unha tenda en Galicia e interésame {name}."
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url, "url": url, "name": title_es.split(" | ")[0], "description": desc, "inLanguage": "es",
         "isPartOf": {"@id": SITE + "/#web"}, "about": {"@type": "Brand", "name": name, "url": b["web"]},
         "provider": {"@id": SITE + "/#negocio"}, "primaryImageOfPage": SITE + "/" + b["photo"]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Inicio", "item": SITE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Marcas", "item": SITE + "/#marcas"},
            {"@type": "ListItem", "position": 3, "name": f"{name} en Galicia", "item": url}]}]}
    if b["folder"] or b.get("catalogs"):
        main_btn = f'<a class="btn dark" href="/#marca-{b["id"]}" data-gl="Catálogos de {e(name)}">Catálogos de {e(name)}</a>'
    else:  # marca sin catálogos en la portada: el botón lleva a su ficha
        main_btn = f'<a class="btn dark" href="/novedad-sweetbedding.html" data-gl="Ver as coleccións">Ver las colecciones</a>'
    others = "".join(f'      <li><a href="/{o["slug"]}.html">{e(o["name"])}</a></li>\n' for o in BRANDS if o is not b)
    rel = "".join(f'      <li><a href="/{u}" data-gl="{e(gl)}">{e(es)}</a></li>\n' for u, es, gl in ARTICLES)
    logo = f'    <img class="brandlogo" src="./{b["logo"]}" alt="Logotipo de {e(name)}" loading="lazy">\n' if b["logo"] else ""
    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="google" content="notranslate">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<title>{e(title_es)}</title>
  <script src="./cookies.js"></script>
  <meta name="description" content="{e(desc)}" data-gl-content="{e(desc_gl)}">
  <link rel="canonical" href="{url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="MCS Representaciones">
  <meta property="og:title" content="{e(title_es)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{url}">
  <meta property="og:locale" content="es_ES">
  <meta property="og:image" content="{SITE}/{b['photo']}">
  <meta property="og:image:width" content="{pw}">
  <meta property="og:image:height" content="{ph}">
  <meta property="og:image:alt" content="{e(name)}: {e(cat_es)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{e(title_es)}">
  <meta name="twitter:description" content="{e(desc)}">
  <meta name="twitter:image" content="{SITE}/{b['photo']}">
<link rel="icon" type="image/png" sizes="32x32" href="./images/icon-32.png">
<link rel="stylesheet" href="./fonts/fonts.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>{CSS}</style>
</head>
<body>
<!-- Página generada por scripts/build_brand_pages.py: editar los textos allí, no aquí. -->
<header>
  <div class="wrap">
    <div class="header-top">
      <a class="logo" href="/" aria-label="MCS Representaciones, inicio"><img src="./images/logo-mcs-h.png" alt="MCS Representaciones" width="480" height="201"></a>
      <nav class="crumbs" aria-label="Migas de pan"><a href="/" data-gl="Inicio">Inicio</a> › <a href="/#marcas">Marcas</a> › {e(name)}</nav>
    </div>
    {bi("div", "Marca representada · " + b["tag"][0], "Marca representada · " + b["tag"][1], "eyebrow")}
    <h1 data-gl="{e(name)} en Galicia:&lt;br&gt;&lt;em&gt;{e(cat_gl)}&lt;/em&gt; para tendas">{e(name)} en Galicia:<br><em>{e(cat_es)}</em> para tiendas</h1>
    {bi("p", b["intro"][0], b["intro"][1], "intro")}
  </div>
</header>

<main class="wrap">
  <img class="hero" src="./{b['photo']}" alt="{e(name)}: {e(cat_es)} para tiendas en Galicia" width="{pw}" height="{ph}">

  <section class="section">
{logo}    {bi("h2", f"Qué es {name}", f"Que é {name}")}
    {bi("p", b["p1"][0], b["p1"][1])}
    {bi("p", b["p2"][0], b["p2"][1])}
    {bi("p", b["p3"][0], b["p3"][1], raw=True)}
{gallery(b)}    <div class="links">
      {main_btn}
      <a class="btn" href="{b['web']}" target="_blank" rel="noopener noreferrer" data-gl="Web do fabricante">Web del fabricante</a>
    </div>
  </section>

  <section class="section">
    {bi("h2", f"Qué se vende de {name} y a qué tienda le encaja", f"Que se vende de {name} e a que tenda lle encaixa")}
    {bi("p", b["fit"][0].split(". Encaja")[0] + ".", b["fit"][1].split(". Encaixa")[0] + ".")}
    {bi("p", "Encaja" + b["fit"][0].split(". Encaja")[1], "Encaixa" + b["fit"][1].split(". Encaixa")[1])}
  </section>

  <section class="section">
    {bi("h2", f"Cómo trabajo {name} en Galicia", f"Como traballo {name} en Galicia")}
    {bi("p", f"Me llamo MCarmen Sánchez y soy agente comercial multicartera de mueble, descanso y tapizado. Llevo {name} en las cuatro provincias gallegas y trabajo únicamente con tiendas y profesionales.",
        f"Chámome MCarmen Sánchez e son axente comercial multicarteira de moble, descanso e tapizado. Levo {name} nas catro provincias galegas e traballo unicamente con tendas e profesionais.")}
    {bi("p", f"Trabajo cliente a cliente y en persona: veo tu exposición, comentamos qué hueco tiene {name} en ella y te dejo catálogos y tarifas actualizadas. Si hay una incidencia, tienes un número y una cara.",
        f"Traballo cliente a cliente e en persoa: vexo a túa exposición, comentamos que oco ten {name} nela e déixoche catálogos e tarifas actualizadas. Se hai unha incidencia, tes un número e unha cara.")}
  </section>

  <div class="cta">
    {bi("div", f"¿Quieres {name} en tu tienda?", f"Queres {name} na túa tenda?", "eyebrow")}
    {bi("p", f"Si tienes una tienda en Galicia y te interesa {name}, escríbeme y concertamos una visita para verlo sobre tu exposición.",
        f"Se tes unha tenda en Galicia e che interesa {name}, escríbeme e concertamos unha visita para velo sobre a túa exposición.")}
    <a class="btn" id="wa" href="{wa_es}" target="_blank" rel="noopener noreferrer">WhatsApp · 619 620 363</a>
  </div>

  <nav class="others" aria-label="Otras marcas">
    {bi("div", "Otras marcas que represento en Galicia", "Outras marcas que represento en Galicia", "others-t")}
    <ul>
{others}    </ul>
  </nav>

  <nav class="mcs-rel" aria-label="Más contenidos">
    {bi("div", "También te puede interesar", "Tamén che pode interesar", "mcs-rel-t")}
    <ul>
{rel}    </ul>
  </nav>
</main>

<footer class="wrap">
  <p>MCS Representaciones · Galicia · <a href="/catalogo.html" data-gl="Catálogo de fotos">Catálogo de fotos</a> · <a href="/#contacto">Contacto</a></p>
</footer>

<script>
  // Mismo idioma que el sitio principal (Castellano / Galego)
  try{{
    if(localStorage.getItem("mcsLang")==="gl"){{
      document.documentElement.lang="gl";
      document.title={json.dumps(title_gl, ensure_ascii=False)};
      document.querySelectorAll("[data-gl]").forEach(function(el){{el.innerHTML=el.getAttribute("data-gl")}});
      var wa=document.getElementById("wa");
      if(wa)wa.href="{WA}"+encodeURIComponent({json.dumps(wa_gl_text, ensure_ascii=False)});
    }}
  }}catch(e){{}}
</script>
</body>
</html>
"""


if __name__ == "__main__":
    for b in BRANDS:
        out = os.path.join(ROOT, b["slug"] + ".html")
        open(out, "w", encoding="utf-8").write(page(b))
        print("ok", b["slug"] + ".html")
