// Cola offline: si no hay red, los registros se guardan en el equipo
// y se envían solos cuando regresa la conexión.
import { supabase } from './supabase'

const KEY = 'ttmx_cola_v1'

function leer() {
  try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] }
}
function guardar(cola) {
  try { localStorage.setItem(KEY, JSON.stringify(cola)) } catch { /* sin espacio */ }
}

export function pendientes() {
  return leer().length
}

// Errores de base de datos (no de red): reintentar no sirve, se descartan.
function esErrorPermanente(error) {
  const c = error?.code || ''
  return /^[0-9A-Z]{5}$/.test(c) || c.startsWith('PGRST')
}

async function ejecutar(op, offline) {
  if (op.tipo === 'escaneo') {
    const { error } = await supabase
      .from('escaneos')
      .upsert({ ...op.data, sincronizado_offline: offline }, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
  } else if (op.tipo === 'toma') {
    const { error } = await supabase.from('tomas_ruta').update(op.data).eq('id', op.id)
    if (error) throw error
  }
}

/** Intenta enviar ya; si falla por red, lo deja en cola. */
export async function enviar(op) {
  if (!navigator.onLine) { encolar(op); return false }
  try {
    await ejecutar(op, false)
    return true
  } catch (e) {
    if (esErrorPermanente(e)) { console.error('Registro rechazado', e, op); return false }
    encolar(op)
    return false
  }
}

function encolar(op) {
  const cola = leer()
  cola.push(op)
  guardar(cola)
}

let procesando = false
export async function procesarCola() {
  if (procesando || !navigator.onLine) return
  procesando = true
  try {
    while (true) {
      const cola = leer()
      if (!cola.length) break
      try {
        await ejecutar(cola[0], true)
      } catch (e) {
        if (!esErrorPermanente(e)) break // sigue sin red, se reintenta luego
        console.error('Registro descartado', e, cola[0])
      }
      const actual = leer()
      actual.shift()
      guardar(actual)
    }
  } finally {
    procesando = false
  }
}
