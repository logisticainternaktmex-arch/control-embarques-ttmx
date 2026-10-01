import { useEffect, useRef } from 'react'

/**
 * Input invisible que recibe la lectura de la pistola (DataWedge, Keystroke output).
 * Registra la lectura al recibir ENTER/TAB o, si la pistola no manda ENTER,
 * cuando deja de llegar texto por 150 ms.
 */
export default function ScanInput({ onScan, active = true }) {
  const ref = useRef(null)
  const cb = useRef(onScan)
  const timer = useRef(null)
  const activo = useRef(active)
  cb.current = onScan
  activo.current = active

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

  useEffect(() => () => clearTimeout(timer.current), [])

  const procesar = () => {
    clearTimeout(timer.current)
    const el = ref.current
    if (!el) return
    // Quita saltos de línea, tabs y caracteres de control que algunas pistolas agregan
    const valor = el.value.replace(/[\u0000-\u001F\u007F]/g, '').trim()
    el.value = ''
    if (valor && activo.current) cb.current(valor)
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab' || e.keyCode === 13 || e.keyCode === 9) {
      e.preventDefault()
      procesar()
    }
  }

  // Si la pistola no manda ENTER: se procesa cuando termina de "teclear" (150 ms sin texto nuevo)
  const onInput = () => {
    clearTimeout(timer.current)
    if (/[\r\n]/.test(ref.current?.value || '')) { procesar(); return }
    timer.current = setTimeout(procesar, 150)
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
      onInput={onInput}
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
