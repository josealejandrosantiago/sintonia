// Catálogo: un adaptador por fuente, todos entregan el mismo formato de título.
//
// Regla legal de video en Internet Archive: su etiqueta de licencia no basta (hay obras
// protegidas mal marcadas), así que se exige dominio público con año hasta 1977 y se
// descartan los títulos con marcas de copia. Creative Commons en video: solo curaduría.
import { CURADOS, CON_CARTEL } from './curaduria.js';
import { Alm } from './almacen.js';

const memoria = new Map();

async function json(url, { tiempo = 15000 } = {}) {
  if (memoria.has(url)) return memoria.get(url);
  const ctrl = new AbortController();
  const tm = setTimeout(() => ctrl.abort(), tiempo);
  try {
    const r = await fetch(url, { signal: ctrl.signal, referrerPolicy: 'no-referrer' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const v = await r.json();
    memoria.set(url, v);
    return v;
  } finally {
    clearTimeout(tm);
  }
}

export function urlSegura(u) {
  if (!u) return '';
  let s = String(u).trim();
  if (s.startsWith('//')) s = `https:${s}`;
  s = s.replace(/^http:\/\//i, 'https://');
  return /^https:\/\//i.test(s) ? s : '';
}

export function textoPlano(html) {
  if (!html) return '';
  const previo = String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n');
  const doc = new DOMParser().parseFromString(previo, 'text/html');
  return (doc.body.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n\s*\n\s*\n+/g, '\n\n').trim();
}

const primero = (v) => (Array.isArray(v) ? v[0] : v) || '';
const limpiarConsulta = (t) => String(t).replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').replace(/\s+/g, ' ').trim();

function segundosDe(v) {
  if (v == null) return 0;
  const s = String(v);
  if (s.includes(':')) return s.split(':').reduce((acc, p) => acc * 60 + Number(p || 0), 0);
  return Number(s) || 0;
}

const NOMBRES_CC = { pd: 'Dominio público', by: 'CC BY', 'by-sa': 'CC BY-SA', 'by-nd': 'CC BY-ND', 'by-nc': 'CC BY-NC', 'by-nc-sa': 'CC BY-NC-SA', 'by-nc-nd': 'CC BY-NC-ND' };

function licenciaDe(url) {
  const u = String(url || '');
  if (/publicdomain/i.test(u)) return { nombre: 'Dominio público', url: urlSegura(u) };
  const m = u.match(/licenses\/([a-z-]+)/i);
  if (m && NOMBRES_CC[m[1].toLowerCase()]) return { nombre: NOMBRES_CC[m[1].toLowerCase()], url: urlSegura(u) };
  return null;
}

const urlCC = (l) => (l === 'pd' ? 'https://creativecommons.org/publicdomain/mark/1.0/deed.es' : `https://creativecommons.org/licenses/${l}/4.0/deed.es`);

// ─── Internet Archive ──────────────────────────────────────────────────────
const SIN_ADULTOS = ' AND NOT title:(sex OR sexo OR sexual OR erotic OR erotica OR porno OR porn OR xxx OR nude OR orgy OR striptease OR burlesque OR commercial OR commercials OR advertising OR trailer) AND NOT subject:(sex OR erotic OR erotica OR porn OR pornography OR adult OR xxx OR sexploitation OR nudity OR nudes OR striptease OR burlesque OR stag)';
const VETADO = /porn|sexu|\bsex\b|\bsexo\b|erot|xxx|orgy|org[ií]a|desnud|\bnude|striptease|burlesque|fetish|d[oó]mina\b|bdsm|hentai|trailer/i;
const COPIA = /\b(1080p|720p|480p|2160p|4k|blu-?ray|bdrip|brrip|dvdrip|webrip|x26[45]|hevc|full\s*movie|pel[ií]cula\s+completa|doblad[ao]|remux)\b|\bHD\b/i;

const PUBLICO = 'licenseurl:*publicdomain* AND year:[1900 TO 1977]';
const CREATIVE = 'licenseurl:*creativecommons*';
const CAMPOS = ['identifier', 'title', 'year', 'creator', 'licenseurl', 'downloads'];

async function iaBuscar(q, { pagina = 1, filas = 30, orden = 'downloads desc' } = {}) {
  const p = new URLSearchParams();
  p.set('q', `(${q})${SIN_ADULTOS}`);
  CAMPOS.forEach((c) => p.append('fl[]', c));
  p.append('sort[]', orden);
  p.set('rows', filas);
  p.set('page', pagina);
  p.set('output', 'json');
  const url = `https://archive.org/advancedsearch.php?${p}`;
  // La fuente rechaza a veces consultas simultáneas: el reintento usa otra dirección para evitar la respuesta guardada.
  let d = null;
  for (const u of [url, `${url}&reintento=1`]) {
    d = await json(u).catch(() => null);
    if (d?.response) break;
    memoria.delete(u);
    d = null;
    await new Promise((r) => setTimeout(r, 900));
  }
  if (!d) throw new Error('La fuente no respondió la consulta');
  return d.response.docs.filter((x) => !VETADO.test(x.title || ''));
}

const iaImagen = (id) => `https://archive.org/services/img/${encodeURIComponent(id)}`;

function deIA(doc, tipo) {
  return {
    id: `ia:${doc.identifier}`,
    tipo,
    fuente: 'Internet Archive',
    titulo: textoPlano(doc.title) || doc.identifier,
    anio: doc.year ? String(doc.year) : '',
    autor: textoPlano(primero(doc.creator)),
    imagen: iaImagen(doc.identifier),
    licencia: licenciaDe(doc.licenseurl),
    enlace: `https://archive.org/details/${doc.identifier}`,
    ref: { ia: doc.identifier },
  };
}

function deCurado(c) {
  return {
    id: `ia:${c.i}`,
    tipo: c.k,
    fuente: 'Internet Archive',
    titulo: c.t,
    anio: c.a,
    autor: c.d,
    imagen: CON_CARTEL.has(c.i) ? `carteles/${encodeURIComponent(c.i)}.jpg` : iaImagen(c.i),
    sinopsis: c.s,
    idioma: c.e ? 'En español o con subtítulos' : '',
    licencia: { nombre: NOMBRES_CC[c.l], url: urlCC(c.l) },
    enlace: `https://archive.org/details/${c.i}`,
    ref: { ia: c.i },
  };
}

const textoIA = (texto) => (texto ? ` AND title:(${limpiarConsulta(texto).split(' ').join(' AND ')})` : '');
const sinCopias = (lista) => lista.filter((x) => !COPIA.test(x.title || ''));

export const curados = (filtro) => CURADOS.filter(filtro).map(deCurado);

export async function peliculas({ materia, texto, pagina = 1 } = {}) {
  const m = materia ? ` AND subject:(${materia})` : '';
  const docs = await iaBuscar(`collection:feature_films AND mediatype:movies AND ${PUBLICO}${m}${textoIA(texto)}`, { pagina });
  return sinCopias(docs).map((d) => deIA(d, 'pelicula'));
}

export async function animacion({ pagina = 1 } = {}) {
  const docs = await iaBuscar(`collection:classic_cartoons AND mediatype:movies AND ${PUBLICO}`, { pagina });
  return sinCopias(docs).map((d) => deIA(d, 'pelicula'));
}

export async function documentales({ texto, pagina = 1 } = {}) {
  const docs = await iaBuscar(`collection:feature_films AND mediatype:movies AND ${PUBLICO} AND subject:(documentary OR documental OR documentaries)${textoIA(texto)}`, { pagina });
  return sinCopias(docs).map((d) => deIA(d, 'documental'));
}

export async function archivoPrelinger({ texto, pagina = 1 } = {}) {
  const docs = await iaBuscar(`collection:prelinger AND mediatype:movies${textoIA(texto)}`, { pagina });
  return docs.map((d) => ({ ...deIA(d, 'video'), licencia: licenciaDe(d.licenseurl) || { nombre: 'Dominio público', url: urlCC('pd') } }));
}

// Series: los episodios sueltos del archivo se agrupan por el nombre del programa.
const SERIES_CURADAS = /sherlock holmes|bonanza|lone ranger/;

function nombreSerie(titulo) {
  const t = textoPlano(titulo).replace(/^['"‘’“”]+/, '').replace(/['"‘’“”]{2}/g, '');
  const m = t.match(/^(.{3,50}?)\s*(?:\s[-–—]\s|:\s|\s+S\d+\s*E\d+|\s+Episode\b)/i);
  return m ? m[1].replace(/['"‘’“”]+$/g, '').trim() : null;
}

export async function series({ texto, pagina = 1 } = {}) {
  if (pagina > 1) return [];
  const docs = sinCopias(await iaBuscar(`collection:classic_tv AND mediatype:movies AND ${PUBLICO}${textoIA(texto)}`, { filas: 400 }));
  const grupos = new Map();
  for (const d of docs) {
    const nombre = nombreSerie(d.title);
    if (!nombre) continue;
    const clave = nombre.toLowerCase();
    if (!texto && SERIES_CURADAS.test(clave)) continue; // ya están en la selección con todos sus episodios
    if (!grupos.has(clave)) grupos.set(clave, { nombre, docs: [], descargas: 0 });
    const g = grupos.get(clave);
    g.docs.push(d);
    g.descargas += Number(d.downloads) || 0;
  }
  const agrupadas = [...grupos.values()]
    .filter((g) => g.docs.length >= 2)
    .sort((a, b) => b.descargas - a.descargas)
    .map((g) => {
      const base = g.docs[0];
      const anios = g.docs.map((d) => Number(d.year)).filter(Boolean);
      return {
        id: `serie:${g.nombre.toLowerCase()}`,
        tipo: 'serie',
        fuente: 'Internet Archive',
        titulo: g.nombre,
        anio: anios.length ? String(Math.min(...anios)) : '',
        autor: `${g.docs.length} episodios`,
        imagen: iaImagen(base.identifier),
        licencia: licenciaDe(base.licenseurl),
        enlace: `https://archive.org/search?query=${encodeURIComponent(`"${g.nombre}" AND collection:classic_tv`)}`,
        ref: {
          episodios: g.docs
            .map((d) => ({ ia: d.identifier, titulo: textoPlano(d.title).replace(new RegExp(`^['"‘’“”]*${g.nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"‘’“”]*\\s*[-–—:]*\\s*`, 'i'), '') || textoPlano(d.title), anio: d.year }))
            .sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true })),
        },
      };
    });
  if (texto) return agrupadas;
  return [...curados((c) => c.k === 'serie'), ...agrupadas];
}

const OMITIR_VIDEO = /(^|\/)(VIDEO_TS|VTS_\d)|sample|trailer/i;
const PRIORIDAD_VIDEO = ['h.264', 'h.264 IA', 'MPEG4', '512Kb MPEG4', 'HiRes MPEG4', 'h.264 HD'];
const PRIORIDAD_VIDEO_AHORRO = ['512Kb MPEG4', 'h.264 IA', 'h.264', 'MPEG4', 'HiRes MPEG4', 'h.264 HD'];
const baseDe = (n) => n.replace(/\.[a-z0-9]+$/i, '').replace(/\.ia$/i, '').replace(/_(512kb|64kb|vbr|ipod)$/i, '');
const urlIA = (id, nombre) => `https://archive.org/download/${encodeURIComponent(id)}/${nombre.split('/').map(encodeURIComponent).join('/')}`;

function bonitoDeArchivo(nombre) {
  return baseDe(nombre.split('/').pop())
    .replace(/[_.]+/g, ' ')
    .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g, '$1 $2')
    .replace(/([a-z]{3})the(?= [A-Z])/g, '$1 the')
    .replace(/\bs(\d{1,2})\s*e(\d{1,3})\b\s*/i, 'T$1 · E$2 · ')
    .replace(/\s*·\s*$/, '')
    .trim();
}

function pistasDeVideo(id, archivos, tituloItem, ahorro) {
  const prio = ahorro ? PRIORIDAD_VIDEO_AHORRO : PRIORIDAD_VIDEO;
  const validos = archivos.filter((f) => /\.mp4$/i.test(f.name) && prio.includes(f.format) && !OMITIR_VIDEO.test(f.name));
  const grupos = new Map();
  for (const f of validos) {
    const b = baseDe(f.name);
    if (!grupos.has(b)) grupos.set(b, []);
    grupos.get(b).push(f);
  }
  let lista = [...grupos.entries()].map(([b, fs]) => {
    fs.sort((x, y) => prio.indexOf(x.format) - prio.indexOf(y.format));
    return { b, fs, dur: segundosDe(fs[0].length), titulo: fs[0].title };
  });
  // Varias versiones de la misma obra (720p, 1080p, DVD…): se deja una sola.
  if (lista.length > 1 && lista.every((p) => Math.abs(p.dur - lista[0].dur) <= 3)) {
    lista.sort((x, y) => prio.indexOf(x.fs[0].format) - prio.indexOf(y.fs[0].format) || Number(y.fs[0].height || 0) - Number(x.fs[0].height || 0));
    lista = [lista[0]];
  }
  lista.sort((x, y) => x.b.localeCompare(y.b, 'es', { numeric: true }));
  return lista.map((p) => ({
    titulo: lista.length === 1 ? tituloItem : (p.titulo || bonitoDeArchivo(p.b)),
    urls: p.fs.map((f) => urlIA(id, f.name)),
    dur: p.dur,
    medio: 'video',
  }));
}

function pistasDeAudio(id, archivos, ahorro) {
  const mp3 = archivos.filter((f) => /\.mp3$/i.test(f.name));
  const grupos = new Map();
  for (const f of mp3) {
    const b = baseDe(f.name);
    if (!grupos.has(b)) grupos.set(b, []);
    grupos.get(b).push(f);
  }
  const lista = [...grupos.entries()].map(([b, fs]) => {
    const peso = (f) => (/_64kb/i.test(f.name) ? (ahorro ? 0 : 2) : (ahorro ? 1 : 0)) + (/vbr/i.test(f.format || '') ? 0 : 0.5);
    fs.sort((x, y) => peso(x) - peso(y));
    return { b, fs, pista: parseInt(fs[0].track, 10) || 0, titulo: fs.find((f) => f.title)?.title, dur: segundosDe(fs[0].length) };
  });
  lista.sort((x, y) => (x.pista && y.pista ? x.pista - y.pista : x.b.localeCompare(y.b, 'es', { numeric: true })));
  return lista.map((p) => ({ titulo: p.titulo || bonitoDeArchivo(p.b), urls: p.fs.map((f) => urlIA(id, f.name)), dur: p.dur, medio: 'audio' }));
}

async function detalleIA(item, ahorro) {
  const d = await json(`https://archive.org/metadata/${encodeURIComponent(item.ref.ia)}`);
  if (!d.metadata) throw new Error('El título ya no está disponible en la fuente');
  const m = d.metadata;
  const archivos = d.files || [];
  const pistas = item.ref.audio
    ? pistasDeAudio(item.ref.ia, archivos, ahorro)
    : pistasDeVideo(item.ref.ia, archivos, item.titulo, ahorro);
  return {
    descripcion: item.sinopsis || textoPlano(primero(m.description)),
    autor: item.autor || textoPlano(primero(m.creator)),
    pistas,
  };
}

// ─── Música ────────────────────────────────────────────────────────────────
function deOpenverse(x) {
  return {
    id: `ov:${x.id}`,
    tipo: 'musica',
    fuente: x.source === 'jamendo' ? 'Jamendo' : (x.source === 'ccmixter' ? 'ccMixter' : 'Openverse'),
    titulo: textoPlano(x.title),
    autor: textoPlano(x.creator),
    imagen: urlSegura(x.thumbnail),
    dur: (x.duration || 0) / 1000,
    licencia: { nombre: x.license === 'pdm' || x.license === 'cc0' ? 'Dominio público' : `CC ${String(x.license).toUpperCase()}`, url: urlSegura(x.license_url) },
    enlace: urlSegura(x.foreign_landing_url),
    ref: { directo: urlSegura(x.url) },
  };
}

export async function musica({ texto, pagina = 1 } = {}) {
  const p = new URLSearchParams({ q: texto, page_size: '20', page: String(pagina), category: 'music', source: 'jamendo,ccmixter', license_type: 'all-cc' });
  const d = await json(`https://api.openverse.org/v1/audio/?${p}`);
  return d.results.map(deOpenverse).filter((x) => x.ref.directo && x.dur >= 45 && x.dur <= 900);
}

export async function albumes({ materia, texto, pagina = 1 } = {}) {
  const m = materia ? ` AND subject:(${materia})` : '';
  const docs = await iaBuscar(`collection:netlabels AND mediatype:audio AND ${CREATIVE}${m}${textoIA(texto)}`, { pagina });
  return docs.map((d) => ({ ...deIA(d, 'musica'), ref: { ia: d.identifier, audio: true } }));
}

export async function conciertos({ texto, pagina = 1 } = {}) {
  const docs = await iaBuscar(`collection:etree AND mediatype:etree${textoIA(texto)}`, { pagina });
  return docs.map((d) => ({
    ...deIA(d, 'musica'),
    imagen: '',
    licencia: { nombre: 'Grabación autorizada por el artista', url: 'https://archive.org/details/etree' },
    ref: { ia: d.identifier, audio: true },
  }));
}

// ─── Radio ─────────────────────────────────────────────────────────────────
const SERVIDORES_RADIO = ['de1', 'de2', 'all'];

async function radioPedir(consulta) {
  let error;
  for (const s of SERVIDORES_RADIO) {
    try {
      return await json(`https://${s}.api.radio-browser.info/json/stations/search?${consulta}`, { tiempo: 8000 });
    } catch (e) {
      error = e;
    }
  }
  throw error;
}

function deRadio(x) {
  const crudo = textoPlano(x.name);
  const ciudad = crudo.match(/\(([^)]+)\)/)?.[1] || '';
  const titulo = crudo.split(/\s*\(|\s+[-–|]\s+|,/)[0].trim() || crudo;
  return {
    id: `rb:${x.stationuuid}`,
    tipo: 'radio',
    fuente: 'Radio Browser',
    titulo,
    autor: ciudad.length < 28 ? ciudad : '',
    imagen: urlSegura(x.favicon),
    licencia: { nombre: 'Señal pública de la emisora', url: '' },
    enlace: urlSegura(x.homepage),
    ref: { directo: urlSegura(x.url_resolved), vivo: true },
  };
}

function depurarRadios(lista) {
  const vistos = new Set();
  return lista
    .filter((x) => !x.hls && /^https:/i.test(x.url_resolved || ''))
    .map(deRadio)
    .filter((x) => {
      const k = `${x.titulo}|${x.autor}`.toLowerCase();
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    });
}

export async function radios({ pais, etiqueta, texto, pagina = 1 } = {}) {
  const p = new URLSearchParams({ limit: '30', offset: String((pagina - 1) * 30), order: 'clickcount', reverse: 'true', hidebroken: 'true', is_https: 'true' });
  if (pais) p.set('countrycode', pais);
  if (etiqueta) p.set('tag', etiqueta);
  if (texto) p.set('name', texto);
  return depurarRadios(await radioPedir(p));
}

// ─── Podcast ───────────────────────────────────────────────────────────────
function dePodcast(id, titulo, autor, imagen) {
  return {
    id: `pod:${id}`,
    tipo: 'podcast',
    fuente: 'Directorio de Apple Podcasts',
    titulo: textoPlano(titulo),
    autor: textoPlano(autor),
    imagen: urlSegura(imagen),
    licencia: { nombre: 'Distribución abierta del autor', url: '' },
    enlace: `https://podcasts.apple.com/co/podcast/id${id}`,
    ref: { pod: id },
  };
}

export async function podcasts({ texto, pagina = 1 } = {}) {
  if (pagina > 1) return [];
  const p = new URLSearchParams({ media: 'podcast', term: texto, country: 'CO', limit: '30' });
  const d = await json(`https://itunes.apple.com/search?${p}`);
  return d.results.filter((x) => x.collectionId).map((x) => dePodcast(x.collectionId, x.collectionName, x.artistName, x.artworkUrl600));
}

export async function podcastsPopulares({ pagina = 1 } = {}) {
  if (pagina > 1) return [];
  const d = await json('https://itunes.apple.com/co/rss/toppodcasts/limit=30/json');
  return (d.feed?.entry || []).map((e) => dePodcast(e.id.attributes['im:id'], e['im:name'].label, e['im:artist']?.label, e['im:image']?.at(-1)?.label?.replace(/\/\d+x\d+bb/, '/400x400bb')));
}

async function detallePodcast(item) {
  const p = new URLSearchParams({ id: item.ref.pod, entity: 'podcastEpisode', limit: '80', country: 'CO' });
  const d = await json(`https://itunes.apple.com/lookup?${p}`);
  const episodios = d.results.filter((x) => x.episodeUrl && x.episodeContentType !== 'video');
  if (!episodios.length) throw new Error('El podcast no publica episodios reproducibles');
  return {
    descripcion: '',
    autor: item.autor,
    pistas: episodios.map((x) => ({
      titulo: textoPlano(x.trackName),
      urls: [urlSegura(x.episodeUrl)],
      dur: (x.trackTimeMillis || 0) / 1000,
      fecha: x.releaseDate,
      resumen: textoPlano(x.description).slice(0, 220),
      medio: 'audio',
    })),
  };
}

// ─── NASA ──────────────────────────────────────────────────────────────────
function deNasa(x, tipo) {
  const m = x.data[0];
  const imagen = x.links?.find((l) => l.rel === 'preview')?.href;
  return {
    id: `nasa:${m.nasa_id}`,
    tipo,
    fuente: 'NASA',
    titulo: textoPlano(m.title),
    anio: (m.date_created || '').slice(0, 4),
    autor: 'NASA',
    imagen: urlSegura(imagen ? encodeURI(imagen) : ''),
    sinopsis: textoPlano(m.description),
    licencia: { nombre: 'Dominio público (NASA)', url: 'https://www.nasa.gov/nasa-brand-center/images-and-media/' },
    enlace: `https://images.nasa.gov/details/${encodeURIComponent(m.nasa_id)}`,
    ref: { nasa: urlSegura(x.href) },
  };
}

export async function nasa({ texto, tipo = 'documental', pagina = 1 } = {}) {
  const p = new URLSearchParams({ q: texto, media_type: 'video', page_size: '24', page: String(pagina) });
  const d = await json(`https://images-api.nasa.gov/search?${p}`);
  return d.collection.items.filter((x) => x.data?.[0]).map((x) => deNasa(x, tipo));
}

async function detalleNasa(item, ahorro) {
  const lista = await json(item.ref.nasa);
  const mp4 = lista.filter((u) => /\.mp4$/i.test(u)).map((u) => encodeURI(urlSegura(u)));
  const orden = ahorro ? ['~mobile', '~small', '~preview', '~medium', '~large', '~orig'] : ['~medium', '~mobile', '~large', '~small', '~orig', '~preview'];
  const puntaje = (u) => {
    const i = orden.findIndex((o) => u.includes(`${o}.mp4`));
    return i < 0 ? 99 : i;
  };
  mp4.sort((a, b) => puntaje(a) - puntaje(b));
  if (!mp4.length) throw new Error('Video sin archivo reproducible');
  return { descripcion: item.sinopsis, autor: 'NASA', pistas: [{ titulo: item.titulo, urls: mp4, dur: 0, medio: 'video' }] };
}

// ─── PeerTube (video abierto y federado) ───────────────────────────────────
const INSTANCIAS_NO_INCRUSTABLES = new Set(['tubedu.org', 'tv.cuates.net']); // caída o bloquea el visor externo
const LICENCIAS_PT = { 1: 'CC BY', 2: 'CC BY-SA', 3: 'CC BY-ND', 4: 'CC BY-NC', 5: 'CC BY-NC-SA', 6: 'CC BY-NC-ND', 7: 'Dominio público' };

function dePeerTube(x, tipo) {
  const host = new URL(x.url).hostname;
  return {
    id: `pt:${host}:${x.uuid}`,
    tipo,
    fuente: `PeerTube · ${host}`,
    titulo: textoPlano(x.name),
    autor: textoPlano(x.channel?.displayName || ''),
    imagen: urlSegura(x.thumbnailUrl),
    dur: x.duration,
    licencia: { nombre: LICENCIAS_PT[x.licence?.id] || 'Licencia abierta', url: '' },
    enlace: urlSegura(x.url),
    ref: { pt: { host, uuid: x.uuid, embed: urlSegura(x.embedUrl) } },
  };
}

export async function peertube({ texto, tipo = 'video', minimo = 120, pagina = 1 } = {}) {
  const p = new URLSearchParams({ search: texto, count: '24', start: String((pagina - 1) * 24), nsfw: 'false', sort: '-views', isLive: 'false', durationMin: String(minimo), languageOneOf: 'es' });
  for (let i = 1; i <= 7; i += 1) p.append('licenceOneOf', i);
  const d = await json(`https://sepiasearch.org/api/v1/search/videos?${p}`);
  return d.data
    .filter((x) => !VETADO.test(x.name || '') && !INSTANCIAS_NO_INCRUSTABLES.has(new URL(x.url).hostname))
    .map((x) => dePeerTube(x, tipo));
}

async function detallePeerTube(item, ahorro) {
  const { host, uuid, embed } = item.ref.pt;
  try {
    const v = await json(`https://${host}/api/v1/videos/${uuid}`, { tiempo: 9000 });
    // Solo los archivos progresivos sirven en <video>; los segmentados los reproduce el visor oficial de PeerTube.
    const archivos = (v.files || []).filter((f) => f.resolution?.id > 0 && f.fileUrl);
    const meta = ahorro ? 360 : 720;
    archivos.sort((a, b) => Math.abs(a.resolution.id - meta) - Math.abs(b.resolution.id - meta));
    const descripcion = textoPlano(v.description);
    if (!archivos.length) return { descripcion, autor: item.autor, embed, pistas: [] };
    return { descripcion, autor: item.autor, embed, pistas: [{ titulo: item.titulo, urls: archivos.map((f) => urlSegura(f.fileUrl)), dur: v.duration, medio: 'video' }] };
  } catch {
    return { descripcion: '', autor: item.autor, embed, pistas: [] };
  }
}

// ─── Detalle común ─────────────────────────────────────────────────────────
function detalleSerie(item) {
  return {
    descripcion: item.sinopsis || 'Episodios de la colección de televisión clásica en dominio público.',
    autor: item.autor,
    pistas: item.ref.episodios.map((e) => ({ titulo: e.titulo, ia: e.ia, medio: 'video', urls: null, dur: 0 })),
  };
}

const detalles = new Map();

export async function detalle(item) {
  const ahorro = Alm.ajuste('ahorro');
  const clave = `${item.id}|${ahorro}`;
  if (!detalles.has(clave)) {
    const r = item.ref;
    const p = r.episodios ? Promise.resolve(detalleSerie(item))
      : r.ia ? detalleIA(item, ahorro)
        : r.pod ? detallePodcast(item)
          : r.nasa ? detalleNasa(item, ahorro)
            : r.pt ? detallePeerTube(item, ahorro)
              : Promise.reject(new Error('Título sin detalle'));
    detalles.set(clave, p);
    p.catch(() => detalles.delete(clave));
  }
  return detalles.get(clave);
}

// Los episodios agrupados resuelven su archivo solo cuando se van a reproducir.
export async function asegurar(pista) {
  if (pista.urls) return pista;
  const d = await json(`https://archive.org/metadata/${encodeURIComponent(pista.ia)}`);
  const [primera] = pistasDeVideo(pista.ia, d.files || [], pista.titulo, Alm.ajuste('ahorro'));
  if (!primera) throw new Error('Episodio sin archivo reproducible');
  pista.urls = primera.urls;
  pista.dur = primera.dur;
  return pista;
}
