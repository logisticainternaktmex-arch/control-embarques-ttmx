import { useEffect, useRef } from 'react'

/**
 * Input invisible que recibe la lectura de la pistola (DataWedge en modo
 * Keystroke con sufijo ENTER). Mantiene el foco mientras esté activo.
 */
export default function ScanInput({ onScan, active = true }) {
  const ref = useRef(null)
  const cb = useRef(onScan)
  cb.current = onScan

  useEffect(() => {
    if (!active) return
    const enfocar = () => {
      const el = ref.current
      const otro = document.activeElement
      const editando = otro && otro !== el && (otro.tagName === 'INPUT' || otro.tagName === 'TEXTAREA')
      if (el && !editando && otro !== el) el.focus({ preventScroll: true })
    }
    enfocar()
    const id = setInterval(enfocar, 400)
    return () => clearInterval(id)
  }, [active])

  const onKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== 'Tab') return
    e.preventDefault()
    const valor = ref.current.value.trim()
    ref.current.value = ''
    if (valor && active) cb.current(valor)
  }

  return (
    <input
      ref={ref}
      className="scan-input"
      inputMode="none"
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      onKeyDown={onKeyDown}
      aria-hidden="true"
      tabIndex={-1}
    />
  )
}

/** Botón para teclear un código cuando no lee la pistola (o para pruebas en PC). */
export function BotonManual({ onScan, texto = '⌨ Ingresar código manual' }) {
  return (
    <button
      className="btn btn-link"
      onClick={() => {
        const v = window.prompt('Escribe el código')
        if (v && v.trim()) onScan(v.trim())
      }}
    >
      {texto}
    </button>
  )
}
