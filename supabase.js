import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(url, key, { auth: { persistSession: false } })

// ---------- Empleados ----------
export async function buscarEmpleado(numero) {
  const { data, error } = await supabase
    .from('empleados')
    .select('numero_empleado, nombre, rol')
    .eq('numero_empleado', numero)
    .eq('activo', true)
    .maybeSingle()
  if (error) throw error
  return data // null si no existe
}

// ---------- Sesiones ----------
export async function crearSesion(sesion) {
  const { data, error } = await supabase.from('sesiones').insert(sesion).select().single()
  if (error) throw error
  return data
}

// ---------- Rutas ----------
export async function cargarRutas() {
  const { data, error } = await supabase
    .from('rutas')
    .select('id, nombre, orden, horarios')
    .eq('activo', true)
    .order('orden')
    .order('nombre')
  if (error) throw error
  return data
}

/** Tomas que bloquean rutas en la fecha y horario indicados */
export async function cargarTomas(fecha, horario) {
  const { data, error } = await supabase
    .from('tomas_ruta')
    .select('*')
    .eq('fecha_operativa', fecha)
    .eq('horario', horario)
    .neq('estado', 'liberada')
    .order('inicio')
  if (error) throw error
  return data
}

export async function tomarRuta(toma) {
  const { data, error } = await supabase.from('tomas_ruta').insert(toma).select().single()
  if (error) {
    if (error.code === '23505') throw new Error('RUTA_OCUPADA')
    throw error
  }
  return data
}

export async function liberarToma(id, supervisor) {
  const { error } = await supabase
    .from('tomas_ruta')
    .update({
      estado: 'liberada',
      liberada_por_numero: supervisor.numero_empleado,
      liberada_por_nombre: supervisor.nombre,
      liberada_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw error
}

// ---------- Catálogo de productos (biblioteca de imágenes) ----------
export async function cargarCatalogo() {
  const todos = []
  const pagina = 1000
  for (let desde = 0; ; desde += pagina) {
    const { data, error } = await supabase
      .from('productos')
      .select('codigo_plex, numero_parte, descripcion, sebango, imagen_url')
      .eq('activo', true)
      .range(desde, desde + pagina - 1)
    if (error) throw error
    todos.push(...data)
    if (data.length < pagina) break
  }
  return todos
}
