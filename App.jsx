import { useEffect, useState } from 'react'
import Login from './pages/Login'
import Turno from './pages/Turno'
import Personal from './pages/Personal'
import Rutas from './pages/Rutas'
import Supervisor from './pages/Supervisor'
import Cantidad from './pages/Cantidad'
import Escaneo from './pages/Escaneo'
import { crearSesion, tomarRuta } from './services/supabase'
import { procesarCola, pendientes } from './services/offlineQueue'
import { cargarEstado, guardarEstado, fechaOperativa } from './config'

const INICIAL = { paso: 'login' }

export default function App() {
  const [st, setSt] = useState(() => cargarEstado() || INICIAL)
  const [enCola, setEnCola] = useState(pendientes())
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => { guardarEstado(st) }, [st])

  // Sincronización de registros pendientes
  useEffect(() => {
    const sync = async () => { await procesarCola(); setEnCola(pendientes()) }
    const on = () => { setOnline(true); sync() }
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    sync()
    const id = setInterval(sync, 15000)
    const id2 = setInterval(() => setEnCola(pendientes()), 3000)
    return () => {
      window.removeEventListener('online', on); window.removeEventListener('offline', off)
      clearInterval(id); clearInterval(id2)
    }
  }, [])

  const ir = (patch) => setSt((s) => ({ ...s, ...patch }))

  let pantalla
  switch (st.paso) {
    case 'turno':
      pantalla = (
        <Turno
          operador={st.operador}
          onElegir={({ turno, horario }) => ir({ turno, horario, paso: 'personal' })}
          onSalir={() => setSt(INICIAL)}
        />
      )
      break

    case 'personal':
      pantalla = (
        <Personal
          operador={st.operador}
          turno={st.turno}
          horario={st.horario}
          inicial={st.personal}
          onAtras={() => ir({ paso: st.sesionId ? 'rutas' : 'turno' })}
          onConfirmar={async (personal) => {
            const fecha = fechaOperativa(st.horario)
            const s = await crearSesion({
              fecha_operativa: fecha,
              turno: st.turno,
              horario: st.horario,
              operador_numero: st.operador.numero_empleado,
              operador_nombre: st.operador.nombre,
              pasillo1_numero: personal.pasillo1.numero, pasillo1_nombre: personal.pasillo1.nombre,
              pasillo2_numero: personal.pasillo2.numero, pasillo2_nombre: personal.pasillo2.nombre,
              welding_numero: personal.welding.numero, welding_nombre: personal.welding.nombre,
            })
            ir({ personal, fecha, sesionId: s.id, paso: 'rutas' })
          }}
        />
      )
      break

    case 'rutas':
      pantalla = (
        <Rutas
          st={st}
          onElegir={(ruta) => ir({ rutaSel: { id: ruta.id, nombre: ruta.nombre }, paso: 'cantidad' })}
          onSupervisor={() => ir({ paso: 'supervisor' })}
          onCambiarPersonal={() => ir({ paso: 'personal' })}
          onCerrarSesion={() => setSt(INICIAL)}
        />
      )
      break

    case 'supervisor':
      pantalla = <Supervisor st={st} onSalir={() => ir({ paso: 'rutas' })} />
      break

    case 'cantidad':
      pantalla = (
        <Cantidad
          st={st}
          onCancelar={() => ir({ paso: 'rutas', rutaSel: null })}
          onConfirmar={async (n) => {
            const t = await tomarRuta({
              sesion_id: st.sesionId,
              fecha_operativa: st.fecha,
              turno: st.turno,
              horario: st.horario,
              ruta_id: st.rutaSel.id,
              ruta_nombre: st.rutaSel.nombre,
              operador_numero: st.operador.numero_empleado,
              operador_nombre: st.operador.nombre,
              kanbans_programados: n,
            })
            ir({
              toma: { id: t.id, ruta_nombre: t.ruta_nombre, kanbans_programados: n, inicioLocal: Date.now() },
              progreso: { consecutivo: 0, ultimoTs: null, historial: [], completado: false },
              paso: 'escaneo',
            })
          }}
        />
      )
      break

    case 'escaneo':
      pantalla = (
        <Escaneo
          st={st}
          setProgreso={(p) => setSt((s) => ({ ...s, progreso: { ...s.progreso, ...p } }))}
          onTerminar={() => ir({ paso: 'rutas', toma: null, progreso: null, rutaSel: null })}
        />
      )
      break

    default:
      pantalla = <Login onEntrar={(operador) => setSt({ paso: 'turno', operador })} />
  }

  return (
    <>
      {(!online || enCola > 0) && (
        <div className="estado-red">
          {!online ? '📡 Sin conexión' : '⏳ Sincronizando'}{enCola > 0 ? ` · ${enCola} registro(s) pendientes` : ''}
        </div>
      )}
      {pantalla}
    </>
  )
}
