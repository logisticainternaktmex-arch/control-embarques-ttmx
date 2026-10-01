import { useState } from 'react'
import { Header, Chip, Mensaje } from './UI'
import { MAX_KANBAN } from './config'

export default function Cantidad({ st, onConfirmar, onCancelar }) {
  const [valor, setValor] = useState('')
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)

  const n = parseInt(valor, 10)
  const valido = Number.isInteger(n) && n > 0 && n <= MAX_KANBAN

  const cambiar = (delta) => {
    const actual = Number.isInteger(n) ? n : 0
    setValor(String(Math.min(MAX_KANBAN, Math.max(1, actual + delta))))
  }

  const confirmar = async () => {
    if (!valido || ocupado) return
    setOcupado(true); setError('')
    try {
      await onConfirmar(n)
    } catch (e) {
      setError(e.message === 'RUTA_OCUPADA'
        ? 'Esta ruta acaba de ser tomada por otro equipo.'
        : 'No se pudo iniciar la ruta. Revisa la conexión.')
      setOcupado(false)
    }
  }

  return (
    <div className="pantalla">
      <Header sub={<><Chip>👤 {st.operador.nombre}</Chip><Chip tone="amarillo">Ruta {st.rutaSel.nombre}</Chip></>} />
      <main className="contenido">
        <h2>¿Cuántos kanban vas a escanear?</h2>
        <div className="contador">
          <button className="btn btn-gris btn-cuadro" onClick={() => cambiar(-1)}>−</button>
          <input
            className="input-numero"
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={valor}
            placeholder="0"
            onChange={(e) => setValor(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          />
          <button className="btn btn-gris btn-cuadro" onClick={() => cambiar(1)}>+</button>
        </div>
        <Mensaje>{error}</Mensaje>
      </main>
      <footer className="pie">
        <button className="btn btn-verde btn-grande" disabled={!valido || ocupado} onClick={confirmar}>
          {ocupado ? 'Iniciando…' : 'Iniciar escaneo →'}
        </button>
        <button className="btn btn-gris" onClick={onCancelar}>← Elegir otra ruta</button>
      </footer>
    </div>
  )
}
