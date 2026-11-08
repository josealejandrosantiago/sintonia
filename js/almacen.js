// Lo que la app recuerda en este celular: Mi lista, progreso y ajustes.
const CLAVE = 'sintonia.v1';
const INICIAL = { fav: {}, prog: {}, ajustes: { ahorro: false }, avisoInstalar: false };

function leer() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || '{}');
    return { ...INICIAL, ...g, ajustes: { ...INICIAL.ajustes, ...(g.ajustes || {}) } };
  } catch {
    return structuredClone(INICIAL);
  }
}

const s = leer();
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(s)); } catch { /* almacenamiento lleno o bloqueado */ }
}

export const Alm = {
  esFav: (id) => Boolean(s.fav[id]),
  alternarFav(item) {
    if (s.fav[item.id]) delete s.fav[item.id];
    else s.fav[item.id] = { item, ts: Date.now() };
    guardar();
    return Boolean(s.fav[item.id]);
  },
  favoritos: () => Object.values(s.fav).sort((a, b) => b.ts - a.ts).map((f) => f.item),

  progreso: (item, idx) => s.prog[`${item.id}#${idx}`] || null,
  guardarProgreso(item, idx, t, d) {
    const k = `${item.id}#${idx}`;
    if (d && t / d > 0.95) delete s.prog[k];
    else s.prog[k] = { item, idx, t, d, ts: Date.now() };
    const orden = Object.entries(s.prog).sort((a, b) => b[1].ts - a[1].ts);
    for (const [vieja] of orden.slice(60)) delete s.prog[vieja];
    guardar();
  },
  // Último punto de cada título, del más reciente al más antiguo.
  continuar() {
    const vistos = new Set();
    return Object.values(s.prog)
      .sort((a, b) => b.ts - a.ts)
      .filter((p) => !vistos.has(p.item.id) && vistos.add(p.item.id));
  },
  borrarHistorial() { s.prog = {}; guardar(); },

  ajuste: (k) => s.ajustes[k],
  fijarAjuste(k, v) { s.ajustes[k] = v; guardar(); },
  get avisoInstalar() { return s.avisoInstalar; },
  ocultarAvisoInstalar() { s.avisoInstalar = true; guardar(); },
};
