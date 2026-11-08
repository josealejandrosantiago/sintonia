// Reproductores: visor de video a pantalla completa y audio persistente con pantalla de bloqueo.
import { h, icono, tiempo, aviso, abrirCapa, cerrarCapa, portada } from './ui.js';
import { Alm } from './almacen.js';
import * as F from './fuentes.js';

const audio = document.getElementById('audio');
const VELOCIDADES = [1, 1.25, 1.5, 2];
const MINUTOS_SUENO = [0, 15, 30, 60];

let actual = null; // { item, det, idx, intento }
let velocidad = 1;
let sueno = { i: 0, tm: null, fin: 0 };
let guardadoEn = 0;
const oyentes = new Set();
const avisar = () => oyentes.forEach((f) => f());

const pistaActual = () => actual?.det.pistas[actual.idx];
const itemActual = () => pistaActual()?.item || actual?.item;
const imagenActual = () => pistaActual()?.imagen || itemActual()?.imagen || '';
const autorActual = () => pistaActual()?.autor || itemActual()?.autor || actual?.det.autor || '';
const enVivo = () => Boolean(pistaActual()?.vivo);
const hayAnterior = () => actual && actual.idx > 0;
const haySiguiente = () => actual && actual.idx < actual.det.pistas.length - 1;

// Prueba cada versión del archivo y, al final, una vez más la primera (las fuentes fallan de forma intermitente).
const urlDeRespaldo = (urls, intento) => urls[intento] || (intento === urls.length ? urls[0] : null);

// ─── Audio ─────────────────────────────────────────────────────────────────
export async function tocar(item, det, idx = 0) {
  const pista = det.pistas[idx];
  if (!pista) return;
  try {
    await F.asegurar(pista);
  } catch (e) {
    aviso(e.message);
    return;
  }
  actual = { item, det, idx, intento: 0 };
  const prog = pista.vivo ? null : Alm.progreso(item, idx);
  audio.dataset.inicio = prog?.t && prog.t > 5 ? prog.t : 0;
  audio.src = pista.urls[0];
  audio.playbackRate = pista.vivo ? 1 : velocidad;
  audio.play().catch(() => {});
  actualizarSesion();
  avisar();
}

export function tocarFila(item, fila) {
  const lista = fila.filter((i) => i.ref?.directo);
  const det = {
    autor: '',
    pistas: lista.map((i) => ({ titulo: i.titulo, autor: i.autor, imagen: i.imagen, urls: [i.ref.directo], dur: i.dur, vivo: Boolean(i.ref.vivo), medio: 'audio', item: i })),
  };
  tocar(item, det, Math.max(0, lista.findIndex((i) => i.id === item.id)));
}

const alternar = () => (audio.paused ? audio.play().catch(() => {}) : audio.pause());
const saltar = (s) => { if (!enVivo() && Number.isFinite(audio.duration)) audio.currentTime = Math.min(audio.duration, Math.max(0, audio.currentTime + s)); };
const mover = (d) => { if (actual && actual.det.pistas[actual.idx + d]) tocar(actual.item, actual.det, actual.idx + d); };

function guardarAudio(forzar) {
  const p = pistaActual();
  if (!p || p.vivo || !(audio.duration > 600)) return;
  const ahora = Date.now();
  if (!forzar && ahora - guardadoEn < 5000) return;
  guardadoEn = ahora;
  Alm.guardarProgreso(actual.item, actual.idx, audio.currentTime, audio.duration);
}

audio.addEventListener('loadedmetadata', () => {
  const t = Number(audio.dataset.inicio);
  if (t > 0 && Number.isFinite(audio.duration) && t < audio.duration * 0.95) audio.currentTime = t;
  audio.dataset.inicio = 0;
  actualizarPosicion();
});
audio.addEventListener('timeupdate', () => { guardarAudio(false); actualizarPosicion(); avisarTiempo(); });
audio.addEventListener('play', avisar);
audio.addEventListener('pause', () => { guardarAudio(true); avisar(); });
audio.addEventListener('waiting', avisar);
audio.addEventListener('playing', avisar);
audio.addEventListener('ended', () => {
  guardarAudio(true);
  if (haySiguiente()) mover(1);
  else avisar();
});
audio.addEventListener('error', () => {
  const p = pistaActual();
  if (!p || !audio.getAttribute('src')) return;
  actual.intento += 1;
  const otra = urlDeRespaldo(p.urls, actual.intento);
  if (otra) {
    setTimeout(() => {
      audio.src = otra;
      audio.play().catch(() => {});
    }, 700);
    return;
  }
  aviso(p.vivo ? 'La emisora no responde en este momento.' : 'No fue posible reproducir este audio.');
  avisar();
});

function actualizarSesion() {
  if (!('mediaSession' in navigator)) return;
  const img = imagenActual();
  navigator.mediaSession.metadata = new MediaMetadata({
    title: pistaActual()?.titulo || '',
    artist: autorActual(),
    album: 'Sintonía',
    artwork: img ? [{ src: img, sizes: '512x512' }] : [],
  });
  const s = navigator.mediaSession;
  s.setActionHandler('play', () => audio.play());
  s.setActionHandler('pause', () => audio.pause());
  s.setActionHandler('previoustrack', hayAnterior() ? () => mover(-1) : null);
  s.setActionHandler('nexttrack', haySiguiente() ? () => mover(1) : null);
  s.setActionHandler('seekbackward', enVivo() ? null : () => saltar(-15));
  s.setActionHandler('seekforward', enVivo() ? null : () => saltar(30));
  try {
    s.setActionHandler('seekto', enVivo() ? null : (d) => { audio.currentTime = d.seekTime; });
  } catch { /* no disponible en este navegador */ }
}

function actualizarPosicion() {
  if (!('mediaSession' in navigator) || enVivo() || !Number.isFinite(audio.duration)) return;
  try {
    navigator.mediaSession.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate, position: Math.min(audio.currentTime, audio.duration) });
  } catch { /* posición no válida durante la carga */ }
}

// Oyentes livianos para la barra de tiempo.
const oyentesTiempo = new Set();
const avisarTiempo = () => oyentesTiempo.forEach((f) => f());

function iconoPlay(el) {
  el.replaceChildren(icono(audio.paused ? 'play' : 'pausa'));
  el.setAttribute('aria-label', audio.paused ? 'Reproducir' : 'Pausar');
}

const ecualizador = () => h('span', { class: 'eq', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));

export function montarMini(raiz) {
  function pintar() {
    if (!actual) {
      raiz.replaceChildren();
      document.body.classList.remove('con-mini');
      return;
    }
    document.body.classList.add('con-mini');
    const barra = h('div', { class: 'mini-avance' }, h('i'));
    const play = h('button', { class: 'mini-boton', onclick: (e) => { e.stopPropagation(); alternar(); } });
    iconoPlay(play);
    const cuerpo = h('button', { class: 'mini-cuerpo', onclick: abrirExpandido, 'aria-label': 'Abrir reproductor' },
      portada({ titulo: pistaActual().titulo, imagen: imagenActual() }, 'mini-arte'),
      h('span', { class: 'mini-textos' },
        h('strong', {}, pistaActual().titulo),
        h('small', {}, enVivo() && !audio.paused ? [ecualizador(), 'En vivo'] : autorActual())));
    const raizMini = h('div', { class: 'mini' }, barra, cuerpo,
      haySiguiente() ? h('button', { class: 'mini-boton', 'aria-label': 'Siguiente', onclick: (e) => { e.stopPropagation(); mover(1); } }, icono('siguiente')) : null,
      play);
    raiz.replaceChildren(raizMini);
    actualizarBarra();
  }
  function actualizarBarra() {
    const i = raiz.querySelector('.mini-avance i');
    if (i) i.style.width = enVivo() || !audio.duration ? (enVivo() ? '100%' : '0') : `${(audio.currentTime / audio.duration) * 100}%`;
  }
  oyentes.add(pintar);
  oyentesTiempo.add(actualizarBarra);
}

function programarSueno() {
  clearTimeout(sueno.tm);
  sueno.i = (sueno.i + 1) % MINUTOS_SUENO.length;
  const min = MINUTOS_SUENO[sueno.i];
  if (!min) {
    sueno.fin = 0;
    aviso('Temporizador desactivado.');
  } else {
    sueno.fin = Date.now() + min * 60000;
    sueno.tm = setTimeout(() => { audio.pause(); sueno.i = 0; sueno.fin = 0; avisar(); aviso('Reproducción detenida por el temporizador.'); }, min * 60000);
    aviso(`La reproducción se detendrá en ${min} minutos.`);
  }
  avisar();
}

function abrirExpandido() {
  const raiz = h('div', { class: 'expandido', tabIndex: -1, role: 'dialog', 'aria-label': 'Reproductor de audio' });

  function pintar() {
    if (!actual) return;
    const p = pistaActual();
    const it = itemActual();
    const dur = audio.duration;
    const rango = enVivo() ? null : h('input', { type: 'range', class: 'rango', min: 0, max: Number.isFinite(dur) ? dur : 0, step: 1, value: audio.currentTime || 0, 'aria-label': 'Posición', oninput: (e) => { audio.currentTime = Number(e.target.value); } });
    const tActual = h('span', {}, tiempo(audio.currentTime || 0));
    const tTotal = h('span', {}, tiempo(dur));
    const play = h('button', { class: 'exp-play', onclick: alternar });
    iconoPlay(play);
    const fav = Alm.esFav(it.id);
    const fijo = audio.dataset.fijo;

    raiz.replaceChildren(
      h('header', { class: 'exp-cabeza' },
        h('button', { class: 'redondo', 'aria-label': 'Cerrar', onclick: cerrarCapa }, icono('abajo')),
        h('span', { class: 'rotulo' }, enVivo() ? 'Emisora en vivo' : 'Reproduciendo'),
        h('span', { class: 'hueco' })),
      portada({ titulo: p.titulo, imagen: imagenActual() }, `exp-arte ${enVivo() ? 'logo' : ''}`),
      h('div', { class: 'exp-textos' }, h('h2', {}, p.titulo), h('p', {}, autorActual())),
      enVivo()
        ? h('div', { class: 'exp-vivo' }, audio.paused ? 'En pausa' : [ecualizador(), 'Transmisión en directo'])
        : h('div', { class: 'exp-barra' }, rango, h('div', { class: 'exp-tiempos' }, tActual, tTotal)),
      h('div', { class: 'exp-controles' },
        enVivo() ? null : h('button', { class: 'redondo', 'aria-label': 'Retroceder 15 segundos', onclick: () => saltar(-15) }, icono('atras15'), h('small', {}, '15')),
        h('button', { class: 'redondo', 'aria-label': 'Anterior', disabled: !hayAnterior(), onclick: () => mover(-1) }, icono('anterior')),
        play,
        h('button', { class: 'redondo', 'aria-label': 'Siguiente', disabled: !haySiguiente(), onclick: () => mover(1) }, icono('siguiente')),
        enVivo() ? null : h('button', { class: 'redondo', 'aria-label': 'Adelantar 30 segundos', onclick: () => saltar(30) }, icono('adelante30'), h('small', {}, '30'))),
      h('div', { class: 'exp-extras' },
        enVivo() ? null : h('button', { class: 'pastilla', onclick: () => { velocidad = VELOCIDADES[(VELOCIDADES.indexOf(velocidad) + 1) % VELOCIDADES.length]; audio.playbackRate = velocidad; avisar(); } }, `${String(velocidad).replace('.', ',')}×`),
        h('button', { class: `pastilla ${sueno.fin ? 'activa' : ''}`, onclick: programarSueno }, icono('reloj'), sueno.fin ? `${MINUTOS_SUENO[sueno.i]} min` : 'Temporizador'),
        h('button', { class: `pastilla ${fav ? 'activa' : ''}`, onclick: () => { Alm.alternarFav(it); avisar(); } }, icono(fav ? 'listo' : 'agregar'), 'Mi lista')),
      h('p', { class: 'exp-legal' },
        it.licencia?.nombre ? `${it.licencia.nombre} · ` : '',
        it.fuente,
        it.enlace ? [' · ', h('a', { href: it.enlace, target: '_blank', rel: 'noopener noreferrer' }, 'Ver en la fuente')] : ''),
    );
    raiz.dataset.fijo = fijo || '';

    actualizarTiempos = () => {
      if (rango && document.activeElement !== rango) {
        rango.max = Number.isFinite(audio.duration) ? audio.duration : 0;
        rango.value = audio.currentTime || 0;
      }
      tActual.textContent = tiempo(audio.currentTime || 0);
      tTotal.textContent = tiempo(audio.duration);
    };
  }

  let actualizarTiempos = () => {};
  const pasarTiempo = () => actualizarTiempos();
  pintar();
  oyentes.add(pintar);
  oyentesTiempo.add(pasarTiempo);
  abrirCapa(raiz, () => { oyentes.delete(pintar); oyentesTiempo.delete(pasarTiempo); });
}

// ─── Video ─────────────────────────────────────────────────────────────────
export async function ver(item, det, idx = 0) {
  if (!audio.paused) audio.pause();

  const video = h('video', { controls: true, playsInline: true, autoplay: true, preload: 'metadata', referrerPolicy: 'no-referrer' });
  video.setAttribute('playsinline', '');
  video.setAttribute('controlslist', 'nodownload');
  const titulo = h('strong', { class: 'visor-titulo' });
  const estado = h('div', { class: 'visor-estado', hidden: true });
  const marco = h('div', { class: 'visor-marco' }, video, estado);
  const lista = h('div', { class: 'visor-lista' });
  const raiz = h('div', { class: 'visor', tabIndex: -1, role: 'dialog', 'aria-label': 'Reproductor de video' },
    h('header', { class: 'visor-cabeza' },
      h('button', { class: 'redondo', 'aria-label': 'Cerrar video', onclick: cerrarCapa }, icono('cerrar')),
      titulo),
    marco, lista);

  let actualIdx = idx;
  let intento = 0;
  let guardado = 0;

  function guardar(forzar) {
    const ahora = Date.now();
    if (!video.duration || video.currentTime < 3 || (!forzar && ahora - guardado < 5000)) return;
    guardado = ahora;
    Alm.guardarProgreso(item, actualIdx, video.currentTime, video.duration);
  }

  function fallo() {
    const p = det.pistas[actualIdx];
    const otra = p.urls ? urlDeRespaldo(p.urls, intento + 1) : null;
    if (otra) {
      intento += 1;
      const posicion = video.currentTime;
      setTimeout(() => {
        video.dataset.inicio = posicion > 5 ? posicion : video.dataset.inicio;
        video.src = otra;
        video.play().catch(() => {});
      }, 700);
      return;
    }
    if (det.embed) {
      // Último recurso: el visor oficial de la instancia PeerTube.
      video.replaceWith(crearIncrustado(item, det));
      return;
    }
    estado.hidden = false;
    estado.replaceChildren(
      h('p', {}, 'Este archivo no se puede reproducir en tu dispositivo.'),
      item.enlace ? h('a', { href: item.enlace, target: '_blank', rel: 'noopener noreferrer', class: 'pastilla' }, 'Abrir en la fuente') : '',
    );
  }

  async function cargar(i) {
    guardar(true);
    actualIdx = i;
    intento = 0;
    estado.hidden = true;
    const p = det.pistas[i];
    titulo.textContent = det.pistas.length > 1 ? `${item.titulo} · ${p.titulo}` : p.titulo;
    pintarLista();
    try {
      await F.asegurar(p);
    } catch (e) {
      estado.hidden = false;
      estado.replaceChildren(h('p', {}, e.message));
      return;
    }
    const prog = Alm.progreso(item, i);
    video.src = p.urls[0];
    video.dataset.inicio = prog?.t && prog.t > 5 ? prog.t : 0;
    video.play().catch(() => {});
  }

  function pintarLista() {
    if (det.pistas.length < 2) { lista.replaceChildren(); return; }
    lista.replaceChildren(
      h('h3', {}, 'Episodios'),
      ...det.pistas.map((p, i) => h('button', { class: `visor-ep ${i === actualIdx ? 'activo' : ''}`, onclick: () => cargar(i) },
        h('span', { class: 'visor-ep-n' }, String(i + 1)),
        h('span', {}, p.titulo))),
    );
    lista.querySelector('.activo')?.scrollIntoView({ block: 'nearest' });
  }

  video.addEventListener('loadedmetadata', () => {
    const t = Number(video.dataset.inicio);
    if (t > 0 && t < video.duration * 0.95) video.currentTime = t;
  });
  video.addEventListener('timeupdate', () => guardar(false));
  video.addEventListener('pause', () => guardar(true));
  video.addEventListener('error', fallo);
  video.addEventListener('ended', () => {
    guardar(true);
    if (det.pistas[actualIdx + 1]) cargar(actualIdx + 1);
  });

  abrirCapa(raiz, () => {
    guardar(true);
    video.removeAttribute('src');
    video.load();
    avisar();
  });
  cargar(idx);
}

function crearIncrustado(item, det) {
  return h('iframe', {
    src: det.embed,
    allow: 'autoplay; fullscreen; picture-in-picture',
    sandbox: 'allow-scripts allow-same-origin allow-popups allow-forms',
    title: item.titulo,
  });
}

export function verIncrustado(item, det) {
  if (!audio.paused) audio.pause();
  const raiz = h('div', { class: 'visor', tabIndex: -1, role: 'dialog', 'aria-label': 'Reproductor de video' },
    h('header', { class: 'visor-cabeza' },
      h('button', { class: 'redondo', 'aria-label': 'Cerrar video', onclick: cerrarCapa }, icono('cerrar')),
      h('strong', { class: 'visor-titulo' }, item.titulo)),
    h('div', { class: 'visor-marco' }, crearIncrustado(item, det)),
    item.enlace ? h('div', { class: 'visor-lista' }, h('a', { class: 'pastilla', href: item.enlace, target: '_blank', rel: 'noopener noreferrer' }, 'Abrir en la fuente', icono('externo'))) : null);
  abrirCapa(raiz);
}

export function reproducir(item, det, idx = 0) {
  if (det.embed && !det.pistas.length) return verIncrustado(item, det);
  const p = det.pistas[idx];
  if (!p) { aviso('Este título no tiene archivos reproducibles.'); return undefined; }
  return p.medio === 'video' ? ver(item, det, idx) : tocar(item, det, idx);
}
