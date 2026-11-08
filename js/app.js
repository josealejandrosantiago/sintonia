// Interfaz principal: pestañas, dial de categorías, filas, detalle, búsqueda y ajustes.
import { h, icono, duracion, tiempo, fechaCorta, aviso, abrirCapa, cerrarCapa, portada, perezoso } from './ui.js';
import { Alm } from './almacen.js';
import * as F from './fuentes.js';
import * as Rep from './reproductor.js';
import { PLATAFORMAS, CON_CARTEL } from './curaduria.js';

const vista = document.getElementById('vista');
const raizDial = document.getElementById('dial');
const barra = document.getElementById('barra');
const estado = { pestana: 'inicio', cat: 'todo', q: '' };

const CATEGORIAS = [
  ['todo', 'Todo'], ['peliculas', 'Películas'], ['series', 'Series'], ['documentales', 'Documentales'],
  ['musica', 'Música'], ['podcast', 'Podcast'], ['videos', 'Videos'],
];

const esCurado = (k, conEspanol) => (c) => c.k === k && (conEspanol === undefined || Boolean(c.e) === conEspanol);
const unaPagina = (fn) => (p) => (p > 1 ? Promise.resolve([]) : Promise.resolve(fn()));
const PELICULAS_EN_ESPANOL = unaPagina(() => F.curados(esCurado('pelicula', true)));
const PELICULAS_SELECCION = unaPagina(() => F.curados(esCurado('pelicula', false)));
const DOCS_EN_ESPANOL = async (p) => {
  const propios = p === 1 ? F.curados(esCurado('documental', true)) : [];
  const otros = await F.peertube({ texto: 'documental', tipo: 'documental', minimo: 600, pagina: p }).catch(() => []);
  return [...propios, ...otros];
};

const genero = (t, materia) => ({ t, forma: 'poster', carga: (p) => F.peliculas({ materia, pagina: p }) });
const fila = (t, forma, carga) => ({ t, forma, carga });
const musica = (t, texto) => fila(t, 'cuadro', (p) => F.musica({ texto, pagina: p }));
const tema = (t, texto) => fila(t, 'cuadro', (p) => F.podcasts({ texto, pagina: p }));
const videoTema = (t, texto) => fila(t, 'ancho', (p) => F.peertube({ texto, pagina: p }));

const EMISORAS_CO = fila('Emisoras de Colombia', 'cuadro logo', (p) => F.radios({ pais: 'CO', pagina: p }));
const SERIES = fila('Series clásicas', 'poster', (p) => F.series({ pagina: p }));
const NASA_ESPACIO = fila('Espacio y ciencia', 'ancho', (p) => F.nasa({ texto: 'mission explained', pagina: p }));
const POPULARES = fila('Podcast populares en Colombia', 'cuadro', (p) => F.podcastsPopulares({ pagina: p }));

const SECCIONES = {
  todo: [
    fila('Películas seleccionadas', 'poster', PELICULAS_SELECCION),
    fila('En español o con subtítulos', 'poster', PELICULAS_EN_ESPANOL),
    SERIES,
    fila('Documentales en español', 'ancho', DOCS_EN_ESPANOL),
    EMISORAS_CO,
    POPULARES,
    musica('Música latina libre', 'latin'),
    videoTema('Videos de ciencia', 'ciencia'),
  ],
  peliculas: [
    fila('Selección Sintonía', 'poster', PELICULAS_SELECCION),
    fila('En español o con subtítulos', 'poster', PELICULAS_EN_ESPANOL),
    fila('Las más vistas', 'poster', (p) => F.peliculas({ pagina: p })),
    genero('Comedia', 'comedy OR comedia'),
    genero('Terror', 'horror OR terror'),
    genero('Cine negro', 'noir'),
    genero('Western', 'western'),
    genero('Ciencia ficción', '"science fiction" OR sci-fi'),
    genero('Drama', 'drama'),
    genero('Aventura', 'action OR adventure'),
    genero('Cine mudo', 'silent'),
    fila('Animación clásica', 'poster', (p) => F.animacion({ pagina: p })),
  ],
  series: [SERIES, fila('Animación clásica', 'poster', (p) => F.animacion({ pagina: p }))],
  documentales: [
    fila('Documentales en español', 'ancho', DOCS_EN_ESPANOL),
    fila('Selección documental', 'poster', unaPagina(() => F.curados(esCurado('documental', false)))),
    NASA_ESPACIO,
    fila('Marte', 'ancho', (p) => F.nasa({ texto: 'Mars rover', pagina: p })),
    fila('Planeta Tierra', 'ancho', (p) => F.nasa({ texto: 'Earth climate', pagina: p })),
    fila('Clásicos del documental', 'poster', (p) => F.documentales({ pagina: p })),
    fila('Archivo histórico', 'ancho', (p) => F.archivoPrelinger({ pagina: p })),
  ],
  musica: [
    EMISORAS_CO,
    fila('Salsa las 24 horas', 'cuadro logo', (p) => F.radios({ etiqueta: 'salsa', pagina: p })),
    musica('Latina', 'latin'),
    musica('Cumbia', 'cumbia'),
    musica('Rock', 'rock'),
    musica('Electrónica', 'electronic'),
    musica('Jazz', 'jazz'),
    musica('Clásica', 'classical'),
    musica('Hip-hop', 'hip hop'),
    musica('Acústica', 'acoustic'),
    fila('Álbumes con licencia libre', 'cuadro', (p) => F.albumes({ pagina: p })),
    fila('Conciertos en vivo', 'cuadro', (p) => F.conciertos({ pagina: p })),
  ],
  podcast: [
    POPULARES,
    tema('Historia', 'historia'),
    tema('Ciencia', 'ciencia'),
    tema('Noticias de Colombia', 'noticias colombia'),
    tema('Tecnología', 'tecnologia'),
    tema('Negocios', 'negocios'),
    tema('Familia y bienestar', 'familia'),
    tema('Salud', 'salud'),
    tema('Humor', 'humor'),
    tema('Deportes', 'deportes colombia'),
  ],
  videos: [
    videoTema('Ciencia', 'ciencia'),
    videoTema('Tecnología', 'tecnología'),
    videoTema('Educación', 'educación'),
    videoTema('Música', 'música'),
    videoTema('Cultura', 'cultura'),
    fila('Animación abierta', 'poster', unaPagina(() => F.curados((c) => /Blender/.test(c.d)))),
    fila('Cortos de la NASA', 'ancho', (p) => F.nasa({ texto: 'short video', tipo: 'video', pagina: p })),
    fila('Archivo histórico', 'ancho', (p) => F.archivoPrelinger({ pagina: p })),
  ],
};

// ─── Tarjetas y filas ──────────────────────────────────────────────────────
const metaDe = (i) => [i.autor && i.tipo !== 'pelicula' ? i.autor : '', i.anio].filter(Boolean).join(' · ');

function abrirTitulo(item, fila_) {
  if (item.ref?.directo) Rep.tocarFila(item, fila_ || [item]);
  else abrirDetalle(item);
}

function tarjeta(item, forma, fila_) {
  return h('button', { class: 'tarjeta', onclick: () => abrirTitulo(item, fila_) },
    portada(item, forma),
    h('span', { class: 'tarjeta-titulo' }, item.titulo),
    h('span', { class: 'tarjeta-meta' }, metaDe(item) || item.fuente));
}

const esqueleto = (forma) => Array.from({ length: 6 }, () => h('div', { class: 'tarjeta' }, h('div', { class: `portada ${forma} vacia` })));

function crearFila(def) {
  const pista = h('div', { class: 'fila-pista' }, esqueleto(def.forma));
  const verTodo = h('button', { class: 'fila-ver', hidden: true, onclick: () => abrirListado(def) }, 'Ver todo');
  const seccion = h('section', { class: 'fila' }, h('header', { class: 'fila-cabeza' }, h('h2', {}, def.t), verTodo), pista);

  async function cargar() {
    try {
      const items = await def.carga(1);
      if (!items.length) { seccion.remove(); return; }
      pista.replaceChildren(...items.slice(0, 24).map((i) => tarjeta(i, def.forma, items)));
      verTodo.hidden = items.length < 6;
    } catch {
      pista.replaceChildren(h('button', { class: 'fila-error', onclick: () => { pista.replaceChildren(...esqueleto(def.forma)); cargar(); } }, 'No se pudo cargar esta fila. Tocar para reintentar.'));
    }
  }
  perezoso(seccion, cargar);
  return seccion;
}

function cabezaCapa(titulo, extra) {
  return h('header', { class: 'capa-cabeza' },
    h('button', { class: 'redondo', 'aria-label': 'Volver', onclick: cerrarCapa }, icono('atras')),
    h('h2', {}, titulo), extra);
}

function abrirListado(def) {
  const rejilla = h('div', { class: `rejilla ${def.forma.split(' ')[0]}` });
  const final = h('div', { class: 'centinela' });
  const raiz = h('div', { class: 'capa', tabIndex: -1, role: 'dialog', 'aria-label': def.t }, cabezaCapa(def.t), rejilla, final);
  const vistos = new Set();
  const todos = [];
  let pagina = 0;
  let ocupado = false;
  let terminado = false;

  async function mas() {
    if (ocupado || terminado) return;
    ocupado = true;
    pagina += 1;
    try {
      const nuevos = (await def.carga(pagina)).filter((i) => !vistos.has(i.id) && vistos.add(i.id));
      if (!nuevos.length) terminado = true;
      todos.push(...nuevos);
      rejilla.append(...nuevos.map((i) => tarjeta(i, def.forma, todos)));
    } catch {
      terminado = true;
      aviso('No se pudo cargar más contenido.');
    }
    ocupado = false;
    if (terminado) { obs.disconnect(); final.remove(); }
  }
  const obs = new IntersectionObserver((v) => v.some((x) => x.isIntersecting) && mas(), { root: raiz, rootMargin: '600px' });
  abrirCapa(raiz, () => obs.disconnect());
  obs.observe(final);
}

// ─── Detalle ───────────────────────────────────────────────────────────────
function botonLista(item) {
  const b = h('button', { class: 'accion-sec' });
  const pintar = () => {
    const f = Alm.esFav(item.id);
    b.replaceChildren(icono(f ? 'listo' : 'agregar'), f ? 'En Mi lista' : 'Mi lista');
    b.setAttribute('aria-pressed', String(f));
  };
  b.addEventListener('click', () => { Alm.alternarFav(item); pintar(); });
  pintar();
  return b;
}

const NOMBRE_TIPO = { pelicula: 'Película', serie: 'Serie', documental: 'Documental', musica: 'Música', podcast: 'Podcast', video: 'Video', radio: 'Emisora' };

function abrirDetalle(item, reanudarEn) {
  const cuerpo = h('div', { class: 'detalle-cuerpo' }, h('div', { class: 'cargando' }, h('i'), h('i'), h('i')));
  const fondo = h('div', { class: 'detalle-fondo' });
  if (item.imagen) fondo.style.backgroundImage = `url("${encodeURI(decodeURI(item.imagen)).replace(/"/g, '%22')}")`;
  const raiz = h('div', { class: 'capa detalle', tabIndex: -1, role: 'dialog', 'aria-label': item.titulo },
    fondo,
    h('button', { class: 'redondo detalle-volver', 'aria-label': 'Volver', onclick: cerrarCapa }, icono('atras')),
    h('div', { class: 'detalle-cabeza' },
      portada(item, item.tipo === 'podcast' || item.tipo === 'musica' ? 'cuadro' : 'poster'),
      h('div', {},
        h('span', { class: 'rotulo' }, NOMBRE_TIPO[item.tipo] || ''),
        h('h1', {}, item.titulo),
        h('p', { class: 'detalle-autor' }, [item.autor, item.anio].filter(Boolean).join(' · ')))),
    cuerpo);
  abrirCapa(raiz);

  async function cargar() {
    try {
      pintar(await F.detalle(item));
    } catch (e) {
      cuerpo.replaceChildren(
        h('p', { class: 'detalle-error' }, `No fue posible cargar este título. ${e.message || ''}`),
        h('div', { class: 'acciones' },
          h('button', { class: 'accion', onclick: () => { cuerpo.replaceChildren(h('div', { class: 'cargando' }, h('i'), h('i'), h('i'))); cargar(); } }, 'Reintentar'),
          item.enlace ? h('a', { class: 'accion-sec', href: item.enlace, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir en la fuente') : ''),
      );
    }
  }

  function pintar(det) {
    if (reanudarEn != null) {
      Rep.reproducir(item, det, reanudarEn);
      reanudarEn = null;
    }
    const reproducible = det.pistas.length > 0 || det.embed;
    const prog = det.pistas.map((_, i) => Alm.progreso(item, i)).find(Boolean);
    const idxInicio = prog ? prog.idx : 0;
    const durTotal = det.pistas.length === 1 ? det.pistas[0].dur || item.dur : item.dur;
    const texto = h('p', { class: 'detalle-sinopsis' }, item.sinopsis || det.descripcion || '');
    if (!(item.sinopsis || det.descripcion)) texto.remove();

    cuerpo.replaceChildren(
      h('div', { class: 'detalle-datos' },
        durTotal ? h('span', {}, duracion(durTotal)) : null,
        det.pistas.length > 1 ? h('span', {}, `${det.pistas.length.toLocaleString('es-CO')} ${item.tipo === 'musica' ? 'pistas' : 'episodios'}`) : null,
        item.idioma ? h('span', {}, item.idioma) : null),
      reproducible
        ? h('div', { class: 'acciones' },
          h('button', { class: 'accion', onclick: () => Rep.reproducir(item, det, idxInicio) },
            icono('play'), prog ? `Continuar desde ${tiempo(prog.t)}` : 'Reproducir'),
          botonLista(item))
        : h('p', { class: 'detalle-error' }, 'La fuente no ofrece un archivo reproducible para este título.'),
      texto,
      h('div', { class: 'detalle-legal' },
        h('span', { class: 'sello' }, item.licencia?.nombre || 'Licencia abierta'),
        h('span', {}, item.fuente),
        item.enlace ? h('a', { href: item.enlace, target: '_blank', rel: 'noopener noreferrer' }, 'Ver en la fuente', icono('externo')) : null),
      det.pistas.length > 1 ? listaPistas(item, det) : '',
    );
  }
  cargar();
}

function listaPistas(item, det) {
  const LIMITE = 40;
  const lista = h('ol', { class: 'pistas' });
  const nodo = (p, i) => {
    const prog = Alm.progreso(item, i);
    return h('li', {},
      h('button', { class: 'pista', onclick: () => Rep.reproducir(item, det, i) },
        h('span', { class: 'pista-n' }, String(i + 1)),
        h('span', { class: 'pista-textos' },
          h('strong', {}, p.titulo),
          h('small', {}, [p.fecha ? fechaCorta(p.fecha) : '', p.dur ? duracion(p.dur) : ''].filter(Boolean).join(' · ')),
          prog?.d ? h('span', { class: 'pista-avance' }, h('i', { style: `width:${Math.min(100, (prog.t / prog.d) * 100)}%` })) : null),
        icono('play', 'pista-play')));
  };
  lista.append(...det.pistas.slice(0, LIMITE).map(nodo));
  const mas = det.pistas.length > LIMITE
    ? h('button', { class: 'accion-sec ancha', onclick: (e) => { lista.append(...det.pistas.slice(LIMITE).map((p, i) => nodo(p, i + LIMITE))); e.currentTarget.remove(); } }, `Mostrar los ${(det.pistas.length - LIMITE).toLocaleString('es-CO')} restantes`)
    : null;
  return h('section', { class: 'detalle-pistas' }, h('h3', {}, item.tipo === 'musica' ? 'Pistas' : 'Episodios'), lista, mas);
}

// ─── Destacado del día ─────────────────────────────────────────────────────
function destacado(cat) {
  const filtro = cat === 'documentales' ? (c) => c.k === 'documental' : cat === 'peliculas' ? (c) => c.k === 'pelicula' : cat === 'todo' ? (c) => c.k === 'pelicula' && c.a > '1920' : null;
  if (!filtro) return null;
  const lista = F.curados((c) => filtro(c) && CON_CARTEL.has(c.i));
  const hoy = new Date();
  const dia = Math.floor((hoy - new Date(hoy.getFullYear(), 0, 0)) / 86400000);
  const item = lista[dia % lista.length];

  return h('section', { class: 'aire' },
    h('div', { class: 'aire-fondo', style: `background-image:url("${item.imagen}")` }),
    h('div', { class: 'aire-cuerpo' },
      h('span', { class: 'aire-rotulo' }, h('i'), 'Hoy al aire'),
      h('h1', {}, item.titulo),
      h('p', { class: 'aire-autor' }, `${item.autor} · ${item.anio}`),
      h('p', { class: 'aire-sinopsis' }, item.sinopsis)),
    portada(item, 'poster aire-poster'),
    h('div', { class: 'acciones' },
      h('button', { class: 'accion', onclick: () => abrirDetalle(item) }, icono('play'), 'Ver ahora'),
      botonLista(item)));
}

function filaContinuar() {
  const lista = Alm.continuar();
  if (!lista.length) return null;
  return h('section', { class: 'fila' },
    h('header', { class: 'fila-cabeza' }, h('h2', {}, 'Continuar')),
    h('div', { class: 'fila-pista' }, lista.slice(0, 15).map((p) => h('button', { class: 'tarjeta', onclick: () => abrirDetalle(p.item, p.idx) },
      h('div', { class: 'con-avance' }, portada(p.item, 'ancho'), h('span', { class: 'tarjeta-avance' }, h('i', { style: `width:${p.d ? (p.t / p.d) * 100 : 0}%` }))),
      h('span', { class: 'tarjeta-titulo' }, p.item.titulo),
      h('span', { class: 'tarjeta-meta' }, p.d ? `Quedan ${duracion(p.d - p.t)}` : '')))));
}

// ─── Dial de categorías ────────────────────────────────────────────────────
function crearDial() {
  const marcas = CATEGORIAS.map(([id, nombre]) => h('button', { class: 'dial-marca', role: 'tab', 'data-cat': id, onclick: () => centrar(id, true) }, nombre));
  const regla = h('div', { class: 'dial-regla', role: 'tablist', 'aria-label': 'Categorías' }, marcas);
  const pista = h('div', { class: 'dial-pista' }, regla);
  const raiz = h('div', { class: 'dial' }, pista, h('div', { class: 'dial-aguja' }));
  const suave = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  function marcar(id) {
    marcas.forEach((m) => m.setAttribute('aria-selected', String(m.dataset.cat === id)));
  }
  function centrar(id, activar) {
    marcar(id);
    const m = marcas.find((x) => x.dataset.cat === id);
    pista.scrollTo({ left: m.offsetLeft - (pista.clientWidth - m.offsetWidth) / 2, behavior: activar ? suave() : 'auto' });
    if (activar) cambiarCategoria(id);
  }
  let tm;
  pista.addEventListener('scroll', () => {
    clearTimeout(tm);
    tm = setTimeout(() => {
      const centro = pista.scrollLeft + pista.clientWidth / 2;
      const cercana = marcas.reduce((a, b) => (Math.abs(a.offsetLeft + a.offsetWidth / 2 - centro) < Math.abs(b.offsetLeft + b.offsetWidth / 2 - centro) ? a : b));
      if (cercana.dataset.cat !== estado.cat) { marcar(cercana.dataset.cat); cambiarCategoria(cercana.dataset.cat); }
    }, 140);
  }, { passive: true });

  raizDial.replaceChildren(raiz);
  requestAnimationFrame(() => centrar(estado.cat, false));
}

function cambiarCategoria(id) {
  if (estado.cat === id) return;
  estado.cat = id;
  window.scrollTo({ top: 0 });
  pintarInicio();
}

// ─── Vistas ────────────────────────────────────────────────────────────────
function avisoInstalar() {
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  if (instalada || Alm.avisoInstalar) return null;
  const el = h('div', { class: 'instalar' },
    h('button', { class: 'instalar-texto', onclick: () => irA('mas') }, h('strong', {}, 'Instala Sintonía en tu celular'), h('small', {}, 'Ábrela como una app, sin tienda y sin costo.')),
    h('button', { class: 'redondo', 'aria-label': 'Ocultar aviso', onclick: () => { Alm.ocultarAvisoInstalar(); el.remove(); } }, icono('cerrar')));
  return el;
}

function pintarInicio() {
  const defs = SECCIONES[estado.cat];
  vista.replaceChildren(
    estado.cat === 'todo' ? avisoInstalar() || '' : '',
    destacado(estado.cat) || '',
    estado.cat === 'todo' ? filaContinuar() || '' : '',
    ...defs.map(crearFila),
  );
}

const SUGERENCIAS = ['Chaplin', 'Salsa', 'Historia de Colombia', 'Marte', 'Western', 'Ciencia'];

function pintarBuscar() {
  const resultados = h('div', { class: 'resultados' });
  let tm;
  const ejecutar = (valor) => {
    estado.q = valor;
    const t = valor.trim();
    if (t.length < 2) {
      resultados.replaceChildren(h('div', { class: 'sugerencias' },
        h('p', {}, 'Busca en películas, series, documentales, música, emisoras, podcast y videos.'),
        h('div', { class: 'pastillas' }, SUGERENCIAS.map((s) => h('button', { class: 'pastilla', onclick: () => { campo.value = s; ejecutar(s); } }, s)))));
      return;
    }
    const defs = [
      fila('Películas', 'poster', (p) => F.peliculas({ texto: t, pagina: p })),
      fila('Series', 'poster', (p) => F.series({ texto: t, pagina: p })),
      fila('Documentales', 'poster', (p) => F.documentales({ texto: t, pagina: p })),
      fila('Documentales de la NASA', 'ancho', (p) => F.nasa({ texto: t, pagina: p })),
      fila('Música', 'cuadro', (p) => F.musica({ texto: t, pagina: p })),
      fila('Álbumes', 'cuadro', (p) => F.albumes({ texto: t, pagina: p })),
      fila('Emisoras', 'cuadro logo', (p) => F.radios({ texto: t, pagina: p })),
      fila('Podcast', 'cuadro', (p) => F.podcasts({ texto: t, pagina: p })),
      fila('Videos', 'ancho', (p) => F.peertube({ texto: t, pagina: p })),
      fila('Archivo histórico', 'ancho', (p) => F.archivoPrelinger({ texto: t, pagina: p })),
    ];
    resultados.replaceChildren(...defs.map(crearFila));
  };
  const campo = h('input', {
    type: 'search', class: 'buscador', placeholder: 'Título, artista o tema', value: estado.q, enterKeyHint: 'search', autocomplete: 'off', 'aria-label': 'Buscar',
    oninput: (e) => { clearTimeout(tm); const v = e.target.value; tm = setTimeout(() => ejecutar(v), 450); },
    onkeydown: (e) => { if (e.key === 'Enter') { clearTimeout(tm); ejecutar(e.target.value); e.target.blur(); } },
  });
  vista.replaceChildren(h('div', { class: 'pagina' }, h('h1', { class: 'pagina-titulo' }, 'Buscar'), h('div', { class: 'buscador-marco' }, icono('buscar'), campo)), resultados);
  ejecutar(estado.q);
}

function pintarLista() {
  const favs = Alm.favoritos();
  const continuar = filaContinuar();
  vista.replaceChildren(
    h('div', { class: 'pagina' }, h('h1', { class: 'pagina-titulo' }, 'Mi lista')),
    continuar || '',
    favs.length
      ? h('section', { class: 'fila' },
        h('header', { class: 'fila-cabeza' }, h('h2', {}, 'Guardados')),
        h('div', { class: 'rejilla cuadro con-margen' }, favs.map((i) => tarjeta(i, i.tipo === 'radio' ? 'cuadro logo' : 'cuadro', favs))))
      : h('div', { class: 'vacio' }, h('h2', {}, 'Tu lista está vacía'), h('p', {}, 'Guarda películas, series, álbumes, emisoras o podcast y aparecerán aquí.'),
        h('button', { class: 'accion', onclick: () => irA('inicio') }, 'Explorar el catálogo')),
  );
}

let eventoInstalar = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); eventoInstalar = e; });

function interruptor(etiqueta, ayuda, clave) {
  const c = h('input', { type: 'checkbox', checked: Alm.ajuste(clave), onchange: (e) => Alm.fijarAjuste(clave, e.target.checked) });
  return h('label', { class: 'ajuste' }, h('span', {}, h('strong', {}, etiqueta), h('small', {}, ayuda)), c, h('i', { class: 'interruptor', 'aria-hidden': 'true' }));
}

function pintarMas() {
  const instalada = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  vista.replaceChildren(h('div', { class: 'pagina' },
    h('h1', { class: 'pagina-titulo' }, 'Más'),

    instalada ? '' : h('section', { class: 'bloque' },
      h('h2', {}, 'Instalar en el celular'),
      eventoInstalar ? h('button', { class: 'accion', onclick: async () => { eventoInstalar.prompt(); await eventoInstalar.userChoice; eventoInstalar = null; pintarMas(); } }, 'Instalar Sintonía') : '',
      h('p', {}, h('strong', {}, 'Android: '), 'en Chrome, abre el menú ⋮ y elige «Instalar aplicación».'),
      h('p', {}, h('strong', {}, 'iPhone: '), 'en Safari, toca Compartir y elige «Agregar a inicio».')),

    h('section', { class: 'bloque' },
      h('h2', {}, 'Ajustes'),
      interruptor('Ahorro de datos', 'Prioriza la versión más liviana de cada video.', 'ahorro'),
      h('button', { class: 'accion-sec ancha', onclick: () => { Alm.borrarHistorial(); aviso('Historial de reproducción eliminado.'); } }, 'Borrar historial de reproducción')),

    h('section', { class: 'bloque' },
      h('h2', {}, 'Más plataformas gratuitas'),
      h('p', {}, 'Servicios legales con catálogo en español. Se abren en tu navegador.'),
      h('ul', { class: 'enlaces' }, PLATAFORMAS.map((p) => h('li', {}, h('a', { href: p.u, target: '_blank', rel: 'noopener noreferrer' }, h('span', {}, h('strong', {}, p.n), h('small', {}, p.d)), icono('externo')))))),

    h('section', { class: 'bloque' },
      h('h2', {}, 'Fuentes y licencias'),
      h('p', {}, 'Sintonía no aloja ningún archivo: reproduce directamente desde cada fuente. Cada título muestra su licencia y un enlace a su origen.'),
      h('dl', { class: 'fuentes' },
        h('dt', {}, 'Internet Archive'), h('dd', {}, 'Cine y televisión en dominio público hasta 1977, álbumes con licencia Creative Commons y conciertos autorizados por los artistas.'),
        h('dt', {}, 'NASA'), h('dd', {}, 'Videos institucionales de dominio público.'),
        h('dt', {}, 'PeerTube'), h('dd', {}, 'Video federado de código abierto. Solo se listan videos con licencia abierta.'),
        h('dt', {}, 'Openverse · Jamendo · ccMixter'), h('dd', {}, 'Música con licencia Creative Commons.'),
        h('dt', {}, 'Radio Browser'), h('dd', {}, 'Directorio abierto de señales públicas de emisoras.'),
        h('dt', {}, 'Directorio de Apple Podcasts'), h('dd', {}, 'Búsqueda de podcast; el audio llega desde el canal público de cada autor.')),
      h('p', { class: 'nota' }, 'Los filtros descartan contenido para adultos y títulos con indicios de copia, pero dependen de los datos que declara cada fuente. Carteles de Wikimedia Commons con licencia libre. Tipografía Bricolage Grotesque con licencia SIL OFL.')),
  ));
}

const PINTORES = { inicio: pintarInicio, buscar: pintarBuscar, lista: pintarLista, mas: pintarMas };
const PESTANAS = [['inicio', 'Inicio', 'inicio'], ['buscar', 'Buscar', 'buscar'], ['lista', 'Mi lista', 'lista'], ['mas', 'Más', 'mas']];

function pintarBarra() {
  barra.replaceChildren(...PESTANAS.map(([id, nombre, ic]) => h('button', {
    class: `barra-boton ${estado.pestana === id ? 'activo' : ''}`,
    'aria-current': estado.pestana === id ? 'page' : null,
    onclick: () => irA(id),
  }, icono(ic), h('span', {}, nombre))));
}

function irA(id) {
  estado.pestana = id;
  document.body.dataset.pestana = id;
  window.scrollTo({ top: 0 });
  pintarBarra();
  PINTORES[id]();
  if (id === 'inicio') requestAnimationFrame(crearDial);
}

Rep.montarMini(document.getElementById('mini'));
irA('inicio');

const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
if ('serviceWorker' in navigator && (!esLocal || location.search.includes('sw'))) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
