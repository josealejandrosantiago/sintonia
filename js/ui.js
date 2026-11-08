// Utilidades de interfaz: nodos, íconos, capas con botón atrás y avisos.
export function h(etiqueta, props, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v; // solo para los íconos propios de ICONOS
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k.includes('-') || k === 'style') el.setAttribute(k, v === true ? '' : v);
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of hijos.flat(3)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : String(c));
  }
  return el;
}

const ICONOS = {
  inicio: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/>',
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  lista: '<path d="M6.5 3.5h11v17L12 16.5l-5.5 4z"/>',
  mas: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',
  play: '<path d="M7.5 4.5v15l12-7.5z" fill="currentColor" stroke-linejoin="round"/>',
  pausa: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  agregar: '<path d="M12 5v14M5 12h14"/>',
  listo: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  atras: '<path d="M14.5 5.5 8 12l6.5 6.5"/>',
  abajo: '<path d="m5.5 9 6.5 6.5L18.5 9"/>',
  siguiente: '<path d="M5.5 5v14l10-7z" fill="currentColor"/><path d="M18.5 5v14"/>',
  anterior: '<path d="M18.5 5v14l-10-7z" fill="currentColor"/><path d="M5.5 5v14"/>',
  atras15: '<path d="M4.5 12a7.5 7.5 0 1 0 2.4-5.5L4.5 8.8"/><path d="M4.5 4.5v4.3h4.3"/>',
  adelante30: '<path d="M19.5 12a7.5 7.5 0 1 1-2.4-5.5l2.4 2.3"/><path d="M19.5 4.5v4.3h-4.3"/>',
  externo: '<path d="M10 5H5v14h14v-5"/><path d="M13.5 4.5h6v6M19.5 4.5 11 13"/>',
  reloj: '<circle cx="12" cy="12.5" r="7.5"/><path d="M12 8.5v4.2l2.8 1.7"/>',
};

export function icono(nombre, clase = '') {
  return h('span', {
    class: `icono ${clase}`,
    'aria-hidden': 'true',
    html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONOS[nombre] || ''}</svg>`,
  });
}

export function tiempo(s) {
  if (!Number.isFinite(s) || s < 0) return '--:--';
  const t = Math.floor(s);
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, '0');
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

export function duracion(s) {
  if (!s) return '';
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

export function fechaCorta(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

let avisoTm;
export function aviso(texto) {
  const zona = document.getElementById('avisos');
  zona.replaceChildren(h('div', { class: 'aviso' }, texto));
  clearTimeout(avisoTm);
  avisoTm = setTimeout(() => zona.replaceChildren(), 3200);
}

// Capas a pantalla completa integradas con el botón atrás del celular.
const pila = [];

function sincronizar() {
  document.body.classList.toggle('con-capa', pila.length > 0);
  document.getElementById('mini').toggleAttribute('inert', pila.some((c) => c.el.classList.contains('visor')));
}

export function abrirCapa(el, alCerrar) {
  pila.push({ el, alCerrar });
  history.pushState({ capa: pila.length }, '');
  document.body.append(el);
  sincronizar();
  el.focus?.({ preventScroll: true });
}

export const cerrarCapa = () => history.back();

window.addEventListener('popstate', () => {
  const c = pila.pop();
  if (!c) return;
  c.alCerrar?.();
  c.el.remove();
  sincronizar();
});

// Carátula con respaldo tipográfico cuando la imagen no existe o falla.
function tonoDe(t) {
  let n = 0;
  for (const ch of String(t)) n = (n * 31 + ch.codePointAt(0)) % 360;
  return n;
}

function iniciales(t) {
  return String(t).replace(/[^\p{L}\p{N} ]/gu, ' ').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

export function portada(item, clase = '') {
  const marco = h('div', { class: `portada ${clase}`, style: `--tono:${tonoDe(item.titulo)}` },
    h('span', { class: 'portada-inicial', 'aria-hidden': 'true' }, iniciales(item.titulo)));
  if (item.imagen) {
    const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', referrerPolicy: 'no-referrer' });
    img.addEventListener('load', () => {
      // Algunas fuentes devuelven una imagen de relleno de muy pocos píxeles.
      if (img.naturalWidth < 16) img.remove();
      else img.classList.add('lista');
    });
    img.addEventListener('error', () => img.remove());
    img.src = item.imagen;
    marco.append(img);
  }
  return marco;
}

export function perezoso(el, cargar) {
  const obs = new IntersectionObserver((vis) => {
    if (vis.some((v) => v.isIntersecting)) {
      obs.disconnect();
      cargar();
    }
  }, { rootMargin: '500px 0px' });
  obs.observe(el);
}
