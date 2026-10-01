import { useCallback, useEffect, useState } from 'react'
import { Header, Chip, Mensaje, Confirmar } from './UI'
import { cargarRutas, cargarTomas } from './supabase'
import { horaMX, colorTurno, fechaOperativa } from './config'

export default function Rutas({ st, onElegir, onSupervisor, onCambiarPersonal, onCerrarSesion }) {
  const [rutas, setRutas] = useState([])
  const [tomas, setTomas] = useState([])
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [confirmSalir, setConfirmSalir] = useState(false)

  const refrescar = useCallback(async () => {
    try {
      const [r, t] = await Promise.all([cargarRutas(), cargarTomas(st.fecha, st.horario)])
      // Solo las rutas del horario elegido (horarios vacío = aparece en todos)
      setRutas(r.filter((x) => !x.horarios?.length || x.horarios.includes(st.horario)))
      setTomas(t); setError('')
    } catch {
      setError('Sin conexión. No se pudo actualizar el estado de las rutas.')
    } finally {
      setCargando(false)
    }
  }, [st.fecha, st.horario])

  useEffect(() => {
    refrescar()
    const id = setInterval(refrescar, 15000)
    return () => clearInterval(id)
  }, [refrescar])

  const tomaDe = (rutaId) => tomas.find((t) => t.ruta_id === rutaId)

  return (
    <div className="pantalla">
      <Header sub={<><Chip>👤 {st.operador.nombre}</Chip><Chip tone={colorTurno(st.turno)}>{st.turno}</Chip><Chip tone="gris">{st.horario}</Chip></>} />
      <main className="contenido">
        {fechaOperativa(st.horario) !== st.fecha && (
          <div className="msg msg-error">
            Esta sesión es de un turno anterior ({st.fecha}).
            <button className="btn btn-rojo btn-chico espacio-izq" onClick={onCerrarSesion}>Iniciar nuevo turno</button>
          </div>
        )}
        <h2>¿Qué ruta vas a escanear?</h2>
        <Mensaje>{error}</Mensaje>
        {cargando && <p className="tenue">Cargando rutas…</p>}
        <div className="grid-rutas">
          {rutas.map((r) => {
            const t = tomaDe(r.id)
            return (
              <button
                key={r.id}
                className={`ruta ${t ? (t.estado === 'completada' ? 'ruta-completa' : 'ruta-bloqueada') : ''}`}
                disabled={!!t}
                onClick={() => onElegir(r)}
              >
                <div className="ruta-nombre">{r.nombre}</div>
                {t && (
                  <div className="ruta-info">
                    {t.estado === 'completada' ? '✔ Lista' : '🔒 En uso'}
                    <br />{(t.operador_nombre || '').split(' ')[0]} {horaMX(t.inicio).slice(0, 5)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {!cargando && !rutas.length && !error && <p className="tenue">No hay rutas asignadas a este horario.</p>}

        <div className="leyenda tenue">
          <span><i className="cuadro" /> Disponible</span>
          <span><i className="cuadro cuadro-uso" /> En uso</span>
          <span><i className="cuadro cuadro-lista" /> Completada</span>
        </div>

        <div className="personal-resumen">
          <div className="renglon-titulo">Personal del turno</div>
          <div className="tenue">P1: {st.personal?.pasillo1?.nombre} · P2: {st.personal?.pasillo2?.nombre} · Welding: {st.personal?.welding?.nombre}</div>
        </div>
      </main>
      <footer className="pie">
        <button className="btn btn-amarillo" onClick={onSupervisor}>🔑 Supervisor</button>
        <div className="fila">
          <button className="btn btn-gris" onClick={onCambiarPersonal}>Cambiar personal</button>
          <button className="btn btn-gris" onClick={() => setConfirmSalir(true)}>Cerrar sesión</button>
        </div>
      </footer>
      {confirmSalir && (
        <Confirmar
          titulo="¿Cerrar sesión?"
          texto="Se regresará a la pantalla de gafete."
          onSi={onCerrarSesion}
          onNo={() => setConfirmSalir(false)}
        />
      )}
    </div>
  )
}
