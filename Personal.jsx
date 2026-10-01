import { useState } from 'react'
import ScanInput, { BotonManual } from './ScanInput'
import { Header, Chip, Mensaje } from './UI'
import { buscarEmpleado } from './supabase'
import { PUESTOS, parseEmpleado, beep, colorTurno } from './config'

export default function Personal({ operador, turno, horario, inicial, onConfirmar, onAtras }) {
  const [personal, setPersonal] = useState(inicial || {})
  const primerFaltante = () => PUESTOS.findIndex((p) => !personal[p.key])
  const [idx, setIdx] = useState(() => {
    const i = PUESTOS.findIndex((p) => !(inicial || {})[p.key])
    return i === -1 ? null : i
  })
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const puesto = idx === null ? null : PUESTOS[idx]

  const leer = async (raw) => {
    if (!puesto || ocupado) return
    const numero = parseEmpleado(raw)
    setOcupado(true); setError('')
    try {
      const emp = await buscarEmpleado(numero)
      if (!emp) {
        beep(false)
        setError(`Empleado ${numero} no registrado o inactivo.`)
        return
      }
      beep(true)
      const nuevo = { ...personal, [puesto.key]: { numero: emp.numero_empleado, nombre: emp.nombre } }
      setPersonal(nuevo)
      const sig = PUESTOS.findIndex((p) => !nuevo[p.key])
      setIdx(sig === -1 ? null : sig)
    } catch {
      beep(false)
      setError('Sin conexión con la base de datos. Intenta de nuevo.')
    } finally {
      setOcupado(false)
    }
  }

  const confirmar = async () => {
    setOcupado(true); setError('')
    try {
      await onConfirmar(personal)
    } catch {
      setError('No se pudo guardar. Revisa la conexión e intenta de nuevo.')
      setOcupado(false)
    }
  }

  return (
    <div className="pantalla">
      <Header sub={<><Chip>👤 {operador.nombre}</Chip><Chip tone={colorTurno(turno)}>{turno}</Chip><Chip tone="gris">{horario}</Chip></>} />
      <main className="contenido">
        {puesto ? (
          <div className="tarjeta tarjeta-activa">
            <div className="tenue">¿Quién está en</div>
            <h2 className="sin-margen">{puesto.label}?</h2>
            <p>🔫 Escanea el código QR del empleado asignado</p>
            {ocupado && <p className="tenue">Validando…</p>}
          </div>
        ) : (
          <div className="tarjeta tarjeta-ok">
            <h2 className="sin-margen">✅ Personal asignado</h2>
            <p className="tenue">Revisa y confirma para continuar</p>
          </div>
        )}
        <Mensaje>{error}</Mensaje>

        <div className="lista">
          {PUESTOS.map((p, i) => (
            <div key={p.key} className={`renglon ${i === idx ? 'renglon-activo' : ''}`}>
              <div>
                <div className="renglon-titulo">{p.label}</div>
                <div className="tenue">
                  {personal[p.key] ? `${personal[p.key].nombre} (#${personal[p.key].numero})` : 'Pendiente'}
                </div>
              </div>
              {personal[p.key] && i !== idx && (
                <button className="btn btn-link" onClick={() => { setIdx(i); setError('') }}>
                  Cambiar
                </button>
              )}
            </div>
          ))}
        </div>
      </main>
      <footer className="pie">
        {puesto && <BotonManual onScan={leer} texto="⌨ Ingresar número manual" />}
        <div className="fila">
          <button className="btn btn-gris" onClick={onAtras}>← Atrás</button>
          {!puesto && (
            <button className="btn btn-verde" disabled={ocupado} onClick={confirmar}>
              Confirmar →
            </button>
          )}
          {puesto && primerFaltante() === -1 && (
            <button className="btn btn-azul" onClick={() => setIdx(null)}>Dejar como está</button>
          )}
        </div>
      </footer>
      <ScanInput onScan={leer} active={!!puesto && !ocupado} />
    </div>
  )
}
