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
  // fase: escanear → verificar (¿pieza correcta?) → [incorrecta] → escanear … → final (¿terminaste?) → faltantes
  const fase = prog.fase || 'escanear'
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

  const actualizar = (nuevo) => {
    progRef.current = { ...progRef.current, ...nuevo }
    setProgreso(nuevo)
  }

  useEffect(() => {
    obtenerCatalogo()
      .then(() => setEstadoCat('ok'))
      .catch(() => setEstadoCat(catalogo ? 'ok' : 'error'))
  }, [])

  const detenido = !!prog.finTs
  useEffect(() => {
    if (detenido) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [detenido])

  const transcurrido = ((prog.finTs || ahora) - toma.inicioLocal) / 1000

  const leer = async (raw) => {
    if ((progRef.current.fase || 'escanear') !== 'escanear') return
    const codigo = normCodigo(raw)
    const t = Date.now()
    // Evita doble lectura accidental del mismo código (rebote de la pistola)
    if (codigo === ultimaLectura.current.codigo && t - ultimaLectura.current.ts < 1500) return
    ultimaLectura.current = { codigo, ts: t }
    setUltimaLeida(String(raw))

    let cat = catalogo
    if (!cat) {
      try { cat = await obtenerCatalogo(true); setEstadoCat('ok') } catch { cat = new Map() }
    }
    const prod = buscarEnCatalogo(cat, raw)
    const prog = progRef.current
    if ((prog.fase || 'escanear') !== 'escanear') return
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

    if (!encontrado) {
      enviar({ tipo: 'escaneo', data: registro })
      beep(false)
      setError(`Código no encontrado en la biblioteca: "${registro.codigo_leido}"`)
      return
    }

    beep(true)
    setError('')
    // Muestra la imagen y pregunta si la pieza es correcta (el registro se guarda con la respuesta)
    actualizar({ consecutivo, ultimoTs: t, ultimo: prod, fase: 'verificar', pendiente: registro })
  }

  const responderPieza = (correcta) => {
    const prog = progRef.current
    const reg = prog.pendiente
    if (!reg) return
    enviar({ tipo: 'escaneo', data: { ...reg, verificacion: correcta ? 'correcta' : 'incorrecta' } })
    const historial = [
      { n: reg.consecutivo, codigo: prog.ultimo?.codigo_plex, sebango: reg.sebango, ok: correcta, tiempo: reg.tiempo_desde_anterior, hora: reg.fecha_hora },
      ...(prog.historial || []),
    ].slice(0, 8)
    const esUltimo = reg.consecutivo >= total
    if (!correcta) beep(false)
    actualizar({
      pendiente: null,
      historial,
      incorrectas: (prog.incorrectas || 0) + (correcta ? 0 : 1),
      fase: !correcta ? 'incorrecta' : esUltimo ? 'final' : 'escanear',
      finTs: esUltimo ? Date.now() : null,
    })
  }

  const continuarTrasIncorrecta = () => {
    const prog = progRef.current
    actualizar({ fase: prog.consecutivo >= total ? 'final' : 'escanear' })
  }

  const cerrarRuta = (completa) => {
    const prog = progRef.current
    enviar({
      tipo: 'toma',
      id: toma.id,
      data: {
        estado: 'completada',
        cierre: completa ? 'completa' : 'incompleta',
        fin: new Date(prog.finTs || Date.now()).toISOString(),
        kanbans_escaneados: prog.consecutivo,
      },
    })
    if (completa) onTerminar()
    else actualizar({ fase: 'faltantes' })
  }

  const ult = prog.ultimo
  const scanActivo = fase === 'escanear' && !confirmSalir

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
          <div className={`producto ${error ? 'producto-tenue' : ''} ${fase === 'verificar' ? 'producto-verificar' : ''}`}>
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
                : <div className="sin-imagen">Sin imagen para {ult.codigo_plex}<br /><small>Sube {ult.codigo_plex}.jpg al bucket de imágenes</small></div>
            })()}
            <div className="producto-datos">
              <div><span className="tenue">PLEX</span><strong>{ult.codigo_plex}</strong></div>
              <div><span className="tenue">No. parte</span><strong>{ult.numero_parte || '—'}</strong></div>
              <div><span className="tenue">Sebango</span><strong>{ult.sebango || '—'}</strong></div>
            </div>
            {ult.descripcion && <div className="tenue">{ult.descripcion}</div>}
          </div>
        )}

        {fase === 'escanear' && ult && (
          <p className="siguiente">🔫 Escanea el siguiente PLEX</p>
        )}

        {!!prog.historial?.length && (
          <div className="lista lista-compacta">
            {prog.historial.map((h) => (
              <div key={h.n} className={`renglon ${h.ok === false ? 'renglon-mal' : ''}`}>
                <span>{h.ok === false ? '❌' : '✅'} #{h.n} · {h.codigo}{h.sebango ? ` · ${h.sebango}` : ''}</span>
                <span className="tenue">{horaMX(h.hora)} · +{h.tiempo}</span>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="pie">
        {fase === 'verificar' ? (
          <>
            <div className="pregunta">¿La pieza es correcta con el PLEX?</div>
            <div className="fila">
              <button className="btn btn-rojo btn-grande" onClick={() => responderPieza(false)}>✖ NO</button>
              <button className="btn btn-verde btn-grande" onClick={() => responderPieza(true)}>✔ SÍ</button>
            </div>
          </>
        ) : (
          <>
            <BotonManual onScan={leer} />
            <button className="btn btn-gris" onClick={() => setConfirmSalir(true)}>Salir de la ruta</button>
          </>
        )}
      </footer>

      <ScanInput onScan={leer} active={scanActivo} />

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

      {fase === 'incorrecta' && (
        <div className="overlay overlay-rojo">
          <div className="icono-grande">⚠️</div>
          <h1>Pieza incorrecta</h1>
          <p className="overlay-texto">Llama al TL o GL</p>
          <button className="btn btn-blanco btn-grande" onClick={continuarTrasIncorrecta}>
            {prog.consecutivo >= total ? 'Continuar' : 'Continuar al siguiente escaneo'}
          </button>
        </div>
      )}

      {fase === 'final' && (
        <div className="overlay overlay-azul">
          <div className="icono-grande">🏁</div>
          <h1>¿Terminaste de escanear la ruta?</h1>
          <p>Ruta {toma.ruta_nombre} · {prog.consecutivo} kanban · ⏱ {fmtTiempo(transcurrido)}</p>
          <div className="fila overlay-botones">
            <button className="btn btn-rojo btn-grande" onClick={() => cerrarRuta(false)}>NO</button>
            <button className="btn btn-verde btn-grande" onClick={() => cerrarRuta(true)}>SÍ</button>
          </div>
        </div>
      )}

      {fase === 'faltantes' && (
        <div className="overlay overlay-amarillo">
          <div className="icono-grande">📦</div>
          <h1>Te faltaron cajas por escanear</h1>
          <p className="overlay-texto">Avisa a tu supervisor</p>
          <button className="btn btn-blanco btn-grande" onClick={onTerminar}>Entendido, volver a rutas</button>
        </div>
      )}
    </div>
  )
}
