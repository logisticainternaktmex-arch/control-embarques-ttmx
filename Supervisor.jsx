import { useCallback, useEffect, useState } from 'react'
import ScanInput, { BotonManual } from './ScanInput'
import { Header, Chip, Mensaje, Confirmar } from './UI'
import { buscarEmpleado, cargarTomas, liberarToma } from './supabase'
import { parseEmpleado, beep, horaMX, colorTurno } from './config'

export default function Supervisor({ st, onSalir }) {
  const [sup, setSup] = useState(null) // no se guarda: al recargar se vuelve a pedir
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [tomas, setTomas] = useState([])
  const [aLiberar, setALiberar] = useState(null)
  const [aviso, setAviso] = useState('')

  const leer = async (raw) => {
    if (ocupado) return
    const numero = parseEmpleado(raw)
    setOcupado(true); setError('')
    try {
      const emp = await buscarEmpleado(numero)
      if (!emp || emp.rol !== 'supervisor') {
        beep(false)
        setError(emp ? `${emp.nombre} no tiene permisos de supervisor.` : `Empleado ${numero} no registrado.`)
      } else {
        beep(true)
        setSup(emp)
      }
    } catch {
      setError('Sin conexión con la base de datos.')
    } finally {
      setOcupado(false)
    }
  }

  const refrescar = useCallback(async () => {
    try {
      setTomas(await cargarTomas(st.fecha, st.horario))
    } catch {
      setError('Sin conexión. No se pudieron cargar las rutas.')
    }
  }, [st.fecha, st.horario])

  useEffect(() => { if (sup) refrescar() }, [sup, refrescar])

  const liberar = async () => {
    const t = aLiberar
    setALiberar(null); setOcupado(true); setError(''); setAviso('')
    try {
      await liberarToma(t.id, sup)
      setAviso(`Ruta ${t.ruta_nombre} liberada. Ya se puede volver a seleccionar.`)
      await refrescar()
    } catch {
      setError('No se pudo liberar la ruta. Revisa la conexión.')
    } finally {
      setOcupado(false)
    }
  }

  if (!sup) {
    return (
      <div className="pantalla">
        <Header sub={<Chip tone="amarillo">Modo supervisor</Chip>} />
        <main className="centro">
          <div className="icono-grande">🔑</div>
          <h2>Escanea el QR del supervisor</h2>
          {ocupado && <p className="tenue">Validando…</p>}
          <Mensaje>{error}</Mensaje>
        </main>
        <footer className="pie">
          <BotonManual onScan={leer} texto="⌨ Ingresar número manual" />
          <button className="btn btn-gris" onClick={onSalir}>← Cancelar</button>
        </footer>
        <ScanInput onScan={leer} active={!ocupado} />
      </div>
    )
  }

  return (
    <div className="pantalla">
      <Header sub={<><Chip tone="amarillo">🔑 {sup.nombre}</Chip><Chip tone={colorTurno(st.turno)}>{st.turno}</Chip><Chip tone="gris">{st.horario} · {st.fecha}</Chip></>} />
      <main className="contenido">
        <h2>Rutas tomadas</h2>
        <Mensaje>{error}</Mensaje>
        <Mensaje tipo="ok">{aviso}</Mensaje>
        {!tomas.length && <p className="tenue">No hay rutas bloqueadas en este horario.</p>}
        <div className="lista">
          {tomas.map((t) => (
            <div key={t.id} className="renglon">
              <div>
                <div className="renglon-titulo">🔒 Ruta {t.ruta_nombre}</div>
                <div className="tenue">
                  {t.estado === 'completada' ? 'Completada' : 'En proceso'} · {t.operador_nombre} · {horaMX(t.inicio)}
                  <br />Kanbans: {t.estado === 'completada' ? t.kanbans_escaneados : '…'} / {t.kanbans_programados}
                </div>
              </div>
              <button className="btn btn-rojo btn-chico" disabled={ocupado} onClick={() => setALiberar(t)}>
                Desbloquear
              </button>
            </div>
          ))}
        </div>
      </main>
      <footer className="pie">
        <button className="btn btn-azul" onClick={onSalir}>Salir de menú supervisor</button>
      </footer>
      {aLiberar && (
        <Confirmar
          titulo={`¿Desbloquear ruta ${aLiberar.ruta_nombre}?`}
          texto="La ruta quedará disponible para volver a seleccionarse."
          si="Desbloquear"
          peligro
          onSi={liberar}
          onNo={() => setALiberar(null)}
        />
      )}
    </div>
  )
}
