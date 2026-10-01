// ================== CONFIGURACIÓN AJUSTABLE ==================

export const TURNOS = [
  { nombre: 'Turno Verde', color: 'verde' },
  { nombre: 'Turno Azul', color: 'azul' },
]
// Horario de trabajo: las rutas son fijas por horario (los equipos Verde/Azul rotan)
export const HORARIOS = [
  { nombre: 'Primer turno', detalle: 'Rutas E … AD' },
  { nombre: 'Segundo turno', detalle: 'Rutas AE … AY y A … D' },
]

export const colorTurno = (t) => TURNOS.find((x) => x.nombre === t)?.color || 'gris'

// Las rutas (A … AY) y su horario se administran en la tabla `rutas` de Supabase.

// Personal que se asigna al iniciar (en este orden se piden)
export const PUESTOS = [
  { key: 'pasillo1', label: 'Ruta Pasillo 1' },
  { key: 'pasillo2', label: 'Ruta Pasillo 2' },
  { key: 'welding', label: 'Pasillo Welding' },
]

export const MAX_KANBAN = 999

// ================== UTILIDADES ==================

/** Extrae el número de empleado del QR del gafete (dígitos iniciales). */
export function parseEmpleado(raw) {
  const t = String(raw || '').trim()
  const m = t.match(/^\d+/)
  return m ? m[0] : t
}

/**
 * Normaliza el código PLEX (ej. etiqueta "M105") para buscarlo en la biblioteca:
 * quita espacios y los asteriscos de inicio/fin de Code 39, y pasa a mayúsculas.
 */
export const normCodigo = (s) =>
  String(s || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/^\][A-Za-z][0-9]/, '') // prefijo AIM (ej. ]A0) que algunas pistolas agregan
    .replace(/[*\s]/g, '')
    .toUpperCase()

/** Busca el código en el catálogo tolerando caracteres extra de la pistola. */
export function buscarEnCatalogo(cat, raw) {
  const base = normCodigo(raw)
  const candidatos = [
    base,
    base.replace(/[^A-Z0-9]/g, ''), // sin guiones / símbolos
  ]
  for (const c of candidatos) {
    if (c && cat.has(c)) return cat.get(c)
  }
  return null
}

/** Fecha YYYY-MM-DD en hora de México. */
export function fechaMX(d = new Date()) {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

// El Segundo turno cruza la medianoche: lo escaneado antes de esta hora
// (hora de México) cuenta para el día anterior, cuando empezó el turno.
export const HORA_CORTE_SEGUNDO_TURNO = 12

/** Fecha operativa: el día en que EMPEZÓ el turno. */
export function fechaOperativa(horario, d = new Date()) {
  const hora = Number(d.toLocaleString('en-US', { timeZone: 'America/Mexico_City', hour: '2-digit', hour12: false })) % 24
  if (horario === 'Segundo turno' && hora < HORA_CORTE_SEGUNDO_TURNO) {
    return fechaMX(new Date(d.getTime() - 24 * 60 * 60 * 1000))
  }
  return fechaMX(d)
}

export function horaMX(iso) {
  return new Date(iso).toLocaleTimeString('es-MX', {
    timeZone: 'America/Mexico_City', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

/** Segundos → mm:ss (o h:mm:ss si pasa de una hora). */
export function fmtTiempo(seg) {
  seg = Math.max(0, Math.round(seg || 0))
  const h = Math.floor(seg / 3600)
  const m = Math.floor((seg % 3600) / 60)
  const s = seg % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`
}

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 3) | 8).toString(16)
  })
}

// Sonido corto de confirmación / error (sin archivos externos)
let audioCtx
export function beep(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const o = audioCtx.createOscillator()
    const g = audioCtx.createGain()
    o.frequency.value = ok ? 1200 : 300
    o.connect(g); g.connect(audioCtx.destination)
    g.gain.value = 0.15
    o.start()
    o.stop(audioCtx.currentTime + (ok ? 0.12 : 0.45))
    if (!ok && navigator.vibrate) navigator.vibrate([200, 100, 200])
  } catch { /* sin audio */ }
}

// Persistencia de la sesión en el equipo (sobrevive a recargas)
const KEY = 'ttmx_estado_v1'
export function cargarEstado() {
  try { return JSON.parse(localStorage.getItem(KEY)) } catch { return null }
}
export function guardarEstado(s) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch { /* nada */ }
}
