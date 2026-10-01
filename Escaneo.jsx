import { useEffect, useRef, useState } from 'react'
import ScanInput, { BotonManual } from './ScanInput'
import { Header, Chip, Mensaje, Confirmar } from './UI'
import { cargarCatalogo } from './supabase'
import { enviar } from './offlineQueue'
import { normCodigo, buscarEnCatalogo, fmtTiempo, uuid, beep, horaMX } from './config'

// Catálogo en memoria: la búsqueda es instantánea y funciona sin red.
let catalogo = null
let catalogoTs = 0
async function obtenerCatalogo(forzar = false) {
  if (!forzar && catalogo && Date.now() - catalogoTs < 10 * 60 * 1000) return catalogo
  const lista = await cargarCatalogo()
  catalogo = new Map(lista.map((p) => [normCodigo(p.codigo_plex), p]))
  catalogoTs = Date.now()
  return catalogo
}

// Si la foto no carga, prueba otras extensiones comunes antes de rendirse
const EXTENSIONES = ['.jpg', '.png', '.jpeg', '.JPG', '.PNG', '.JPEG', '.webp']
function variantesImagen(url) {
  if (!url) return []
  const base = url.replace(/\.(jpe?g|png|webp)$/i, '')
  return [url, ...EXTENSIONES.map((e) => base + e).filter((u) => u !== url)]
}

export default function Escaneo({ st, setProgreso, onTerminar }) {
  const { toma, personal, operador } = st
  const prog = st.progreso
  const total = toma.kanbans_programados
  const [ahora, setAhora] = useState(Date.now())
  const [error, setError] = useState('')
  const [estadoCat, setEstadoCat] = useState(catalogo ? 'ok' : 'cargando')
  const [confirmSalir, setConfirmSalir] = useState(false)
  const [ultimaLeida, setUltimaLeida] = useState('')
  const [intentoImg, setIntentoImg] = useState({}) // código → índice de variante que se está probando
  const ultimaLectura = useRef({ codigo: '', ts: 0 })
  // Copia síncrona del progreso: evita contar dos veces si llegan lecturas muy seguidas
  const progRef = useRef(prog)
  progRef.current = prog

  useEffect(() => {
    obtenerCatalogo()
      .then(() => setEstadoCat('ok'))
      .catch(() => setEstadoCat(catalogo ? 'ok' : 'error'))
  }, [])

  useEffect(() => {
    if (prog.completado) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [prog.completado])

  const transcurrido = ((prog.completado ? prog.finTs : ahora) - toma.inicioLocal) / 1000

  const leer = async (raw) => {
    if (progRef.current.completado) return
    const codigo = normCodigo(raw)
    const t = Date.now()
    // Evita doble lectura accidental del mismo código
    if (codigo === ultimaLectura.current.codigo && t - ultimaLectura.current.ts < 1500) return
    ultimaLectura.current = { codigo, ts: t }
    setUltimaLeida(String(raw))

    let cat = catalogo
    if (!cat) {
      try { cat = await obtenerCatalogo(true); setEstadoCat('ok') } catch { cat = new Map() }
    }
    const prod = buscarEnCatalogo(cat, raw)
    const prog = progRef.current
    const encontrado = !!prod

    const segInicio = (t - toma.inicioLocal) / 1000
    const segAnterior = (t - (prog.ultimoTs || toma.inicioLocal)) / 1000
    const consecutivo = encontrado ? prog.consecutivo + 1 : null

    const registro = {
      id: uuid(),
      fecha_hora: new Date(t).toISOString(),
      toma_id: toma.id,
      sesion_id: st.sesionId,
      fecha_operativa: st.fecha,
      turno: st.turno,
      horario: st.horario,
      ruta_nombre: toma.ruta_nombre,
      consecutivo,
      kanbans_programados: total,
      codigo_leido: String(raw).trim(),
      numero_parte: prod?.numero_parte || null,
      sebango: prod?.sebango || null,
      descripcion: prod?.descripcion || null,
      imagen_mostrada: !!prod?.imagen_url,
      resultado: encontrado ? 'encontrado' : 'no_encontrado',
      segundos_desde_inicio: Math.round(segInicio),
      segundos_desde_anterior: Math.round(segAnterior),
      tiempo_desde_inicio: fmtTiempo(segInicio),
      tiempo_desde_anterior: fmtTiempo(segAnterior),
      operador_numero: operador.numero_empleado,
      operador_nombre: operador.nombre,
      pasillo1_numero: personal.pasillo1?.numero, pasillo1_nombre: personal.pasillo1?.nombre,
      pasillo2_numero: personal.pasillo2?.numero, pasillo2_nombre: personal.pasillo2?.nombre,
      welding_numero: personal.welding?.numero, welding_nombre: personal.welding?.nombre,
    }
    enviar({ tipo: 'escaneo', data: registro })

    if (!encontrado) {
      beep(false)
      setError(`Código no encontrado en la biblioteca: "${registro.codigo_leido}"`)
      return
    }

    beep(true)
    setError('')
    const completado = consecutivo >= total
    const historial = [
      { n: consecutivo, codigo: prod.codigo_plex, parte: prod.numero_parte, sebango: prod.sebango, tiempo: registro.tiempo_desde_anterior, hora: registro.fecha_hora },
      ...(prog.historial || []),
    ].slice(0, 8)

    const nuevo = {
      consecutivo,
      ultimoTs: t,
      ultimo: prod,
      historial,
      completado,
      finTs: completado ? t : null,
    }
    progRef.current = { ...prog, ...nuevo }
    setProgreso(nuevo)

    if (completado) {
      enviar({
        tipo: 'toma',
        id: toma.id,
        data: { estado: 'completada', fin: new Date(t).toISOString(), kanbans_escaneados: consecutivo },
      })
    }
  }

  const ult = prog.ultimo

  return (
    <div className="pantalla">
      <Header sub={<><Chip tone="amarillo">Ruta {toma.ruta_nombre}</Chip><Chip>👤 {operador.nombre}</Chip></>} />

      <div className="barra-progreso">
        <div>
          <div className="tenue">Kanban</div>
          <div className="numero-grande">{prog.consecutivo} / {total}</div>
        </div>
        <div className="derecha">
          <div className="tenue">Tiempo</div>
          <div className="numero-grande">⏱ {fmtTiempo(transcurrido)}</div>
        </div>
      </div>
      <div className="progreso"><div style={{ width: `${Math.min(100, (prog.consecutivo / total) * 100)}%` }} /></div>

      <main className="contenido">
        {ultimaLeida && <p className="tenue ultima-lectura">Última lectura: <code>{JSON.stringify(ultimaLeida)}</code></p>}
        {estadoCat === 'cargando' && <p className="tenue">Cargando biblioteca de imágenes…</p>}
        <Mensaje>{estadoCat === 'error' ? 'No se pudo cargar la biblioteca. Revisa la conexión.' : ''}</Mensaje>
        <Mensaje>{error}</Mensaje>

        {!ult ? (
          <div className="inicia">
            <div className="icono-grande">🔫</div>
            <div className="inicia-texto">INICIA EL ESCANEO</div>
            <p className="tenue">Escanea el código de barras o QR de PLEX</p>
          </div>
        ) : (
          <div className={`producto ${error ? 'producto-tenue' : ''}`}>
            {(() => {
              const vars = variantesImagen(ult.imagen_url)
              const i = intentoImg[ult.codigo_plex] || 0
              return i < vars.length
                ? <img
                    key={vars[i]}
                    src={vars[i]}
                    alt=""
                    onError={() => setIntentoImg((s) => ({ ...s, [ult.codigo_plex]: i + 1 }))}
                  />
                : <div className="sin-imagen">Sin imagen para {ult.codigo_plex}<br /><small>Sube {ult.codigo_plex}.jpg al bucket imagenes-ttmx</small></div>
            })()}
            <div className="producto-datos">
              <div><span className="tenue">PLEX</span><strong>{ult.codigo_plex}</strong></div>
              <div><span className="tenue">No. parte</span><strong>{ult.numero_parte || '—'}</strong></div>
              <div><span className="tenue">Sebango</span><strong>{ult.sebango || '—'}</strong></div>
            </div>
            {ult.descripcion && <div className="tenue">{ult.descripcion}</div>}
          </div>
        )}

        {!!prog.historial?.length && (
          <div className="lista lista-compacta">
            {prog.historial.map((h) => (
              <div key={h.n} className="renglon">
                <span>#{h.n} · {h.codigo}{h.sebango ? ` · ${h.sebango}` : ''}</span>
                <span className="tenue">{horaMX(h.hora)} · +{h.tiempo}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="pie">
        <BotonManual onScan={leer} />
        <button className="btn btn-gris" onClick={() => setConfirmSalir(true)}>Salir de la ruta</button>
      </footer>

      <ScanInput onScan={leer} active={!prog.completado && !confirmSalir} />

      {confirmSalir && (
        <Confirmar
          titulo="¿Salir de la ruta?"
          texto={`Llevas ${prog.consecutivo} de ${total}. La ruta quedará bloqueada hasta que un supervisor la desbloquee.`}
          si="Salir"
          peligro
          onSi={onTerminar}
          onNo={() => setConfirmSalir(false)}
        />
      )}

      {prog.completado && (
        <div className="overlay-ok">
          <div className="icono-grande">✅</div>
          <h1>Ruta completada</h1>
          <p>Ruta {toma.ruta_nombre} · {total} kanban</p>
          <p className="numero-grande">⏱ {fmtTiempo(transcurrido)}</p>
          <button className="btn btn-blanco btn-grande" onClick={onTerminar}>Volver a rutas</button>
        </div>
      )}
    </div>
  )
}
