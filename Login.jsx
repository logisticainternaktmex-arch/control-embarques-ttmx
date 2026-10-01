import { useState } from 'react'
import ScanInput, { BotonManual } from '../components/ScanInput'
import { Header, Mensaje } from '../components/UI'
import { buscarEmpleado } from '../services/supabase'
import { parseEmpleado, beep } from '../config'

export default function Login({ onEntrar }) {
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const leer = async (raw) => {
    if (cargando) return
    const numero = parseEmpleado(raw)
    setCargando(true); setError('')
    try {
      const emp = await buscarEmpleado(numero)
      if (!emp) {
        beep(false)
        setError(`Empleado ${numero} no registrado o inactivo. No puedes ingresar.`)
      } else {
        beep(true)
        onEntrar(emp)
      }
    } catch {
      beep(false)
      setError('Sin conexión con la base de datos. Intenta de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="pantalla">
      <Header />
      <main className="centro">
        <div className="icono-grande">🔫</div>
        <h2>Escanea tu gafete</h2>
        <p className="tenue">Aprieta el botón amarillo y escanea el código QR de tu gafete</p>
        {cargando && <p className="tenue">Validando…</p>}
        <Mensaje>{error}</Mensaje>
      </main>
      <footer className="pie">
        <BotonManual onScan={leer} texto="⌨ Ingresar número manual" />
      </footer>
      <ScanInput onScan={leer} active={!cargando} />
    </div>
  )
}
