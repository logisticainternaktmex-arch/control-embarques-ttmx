import { useState } from 'react'
import { Header, Chip } from '../components/UI'
import { TURNOS, HORARIOS } from '../config'

export default function Turno({ operador, onElegir, onSalir }) {
  const [turno, setTurno] = useState(null)
  const [horario, setHorario] = useState(null)

  return (
    <div className="pantalla">
      <Header sub={<Chip>👤 {operador.nombre}</Chip>} />
      <main className="contenido">
        <h2>¿De qué turno eres?</h2>
        <div className="fila">
          {TURNOS.map((t) => (
            <button
              key={t.nombre}
              className={`btn btn-turno ${t.color === 'verde' ? 'btn-verde' : 'btn-azul'} ${turno && turno !== t.nombre ? 'btn-apagado' : ''}`}
              onClick={() => setTurno(t.nombre)}
            >
              {turno === t.nombre ? '✔ ' : ''}{t.nombre}
            </button>
          ))}
        </div>

        <h2 className="espacio-arriba">¿Qué horario es?</h2>
        <div className="lista-botones">
          {HORARIOS.map((h) => (
            <button
              key={h.nombre}
              className={`btn btn-grande ${horario === h.nombre ? 'btn-azul' : 'btn-borde'}`}
              onClick={() => setHorario(h.nombre)}
            >
              {horario === h.nombre ? '✔ ' : ''}{h.nombre}
              <div className="btn-detalle">{h.detalle}</div>
            </button>
          ))}
        </div>
      </main>
      <footer className="pie">
        <button
          className="btn btn-verde btn-grande"
          disabled={!turno || !horario}
          onClick={() => onElegir({ turno, horario })}
        >
          Continuar →
        </button>
        <button className="btn btn-gris" onClick={onSalir}>← Salir</button>
      </footer>
    </div>
  )
}
