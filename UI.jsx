export function Header({ sub }) {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-a">Logística</span> Interna
        <span className="badge">TTMX</span>
      </div>
      {sub && <div className="header-sub">{sub}</div>}
    </header>
  )
}

export function Chip({ children, tone = 'blue' }) {
  return <span className={`chip chip-${tone}`}>{children}</span>
}

export function Confirmar({ titulo, texto, si = 'Sí', no = 'No', onSi, onNo, peligro }) {
  return (
    <div className="modal-fondo">
      <div className="modal">
        <h3>{titulo}</h3>
        {texto && <p>{texto}</p>}
        <div className="fila">
          <button className="btn btn-gris" onClick={onNo}>{no}</button>
          <button className={`btn ${peligro ? 'btn-rojo' : 'btn-azul'}`} onClick={onSi}>{si}</button>
        </div>
      </div>
    </div>
  )
}

export function Mensaje({ tipo = 'error', children }) {
  if (!children) return null
  return <div className={`msg msg-${tipo}`}>{children}</div>
}
