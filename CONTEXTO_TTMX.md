# CONTEXTO — App "Control Embarques TTMX" v1.4 (Logística Interna / cliente TTMX)

Copia y pega este documento al inicio de un chat nuevo con Claude para continuar sin perder nada.

---

## ¿QUÉ ES?

PWA de escaneo para pistolas Zebra (DataWedge, Android). Es la versión para el cliente **TTMX**, basada en "Control Embarques" de KTMEX. Está hecha con React + Vite, se despliega en Netlify y usa Supabase como base de datos. Es un **proyecto independiente**: tiene su propio repositorio, su propio sitio Netlify y su propio proyecto Supabase.

## FLUJO

1. **Login:** el operador escanea el QR de su gafete. Si no está en `empleados` (activo), no entra.
2. **Turno y horario:** elige el equipo (**Turno Verde** o **Turno Azul**, que van rotando) y el horario (**Primer turno** o **Segundo turno**). Las listas están en `src/config.js`.
3. **Personal:** escanea el QR de la persona en **Ruta Pasillo 1**, luego **Ruta Pasillo 2** y luego **Pasillo Welding**. Se pueden cambiar antes de confirmar. Al confirmar se crea una fila en `sesiones`.
4. **Rutas:** cuadrícula con las rutas **del horario** elegido. Las rutas son fijas por horario, sin importar el equipo:
   - **Primer turno:** E … AD (26 rutas)
   - **Segundo turno:** AE … AY y luego A, B, C, D (25 rutas)
   - En la tabla `rutas`, `nombre` es la letra (en pantalla se ve "Ruta A") y `horarios` es el arreglo de horarios donde aparece (null = todos).
   - Una ruta tomada aparece 🔒 y no se puede volver a elegir en esa fecha y horario.
   - Botón **🔑 Supervisor:** pide el QR de un empleado con `rol = 'supervisor'`, muestra las rutas tomadas y permite **Desbloquear**. Luego **Salir de menú supervisor**.
   - Botones **Cambiar personal** y **Cerrar sesión**.
5. **Cantidad:** "¿Cuántos kanban vas a escanear?" (1–999). Al confirmar se crea la fila en `tomas_ruta` y la ruta queda bloqueada.
6. **Escaneo:** aparece "INICIA EL ESCANEO". Se escanea la etiqueta PLEX (código de barras 1D con texto corto, ej. **M105**). Se busca en la biblioteca (`productos.codigo_plex`) y muestra la imagen. **El mismo número de parte puede escanearse varias veces** y cada lectura cuenta.
   - Muestra el contador X / N y un cronómetro mm:ss.
   - Un código no encontrado da pantalla de error con sonido, se registra como `no_encontrado` y **no suma** al contador.
   - Al llegar a N aparece "✅ Ruta completada" con el tiempo total, `tomas_ruta.estado` pasa a `completada` y se regresa al menú de rutas.
   - "Salir de la ruta" la deja bloqueada (en proceso) hasta que la desbloquee un supervisor.

## BASE DE DATOS (supabase/schema.sql)

- **empleados:** numero_empleado (único), nombre, rol (`operador` | `supervisor`), activo
- **rutas:** id, nombre, orden, horarios (text[]), activo
- **productos:** codigo_plex (único, exactamente lo que lee la pistola), numero_parte, descripcion, imagen_url, activo
- **sesiones:** fecha_operativa, turno (equipo Verde/Azul), horario (Primer/Segundo turno), operador_* y los números y nombres de pasillo1, pasillo2 y welding
- **tomas_ruta:** fecha_operativa, turno, horario, ruta_id, ruta_nombre, operador, kanbans_programados, kanbans_escaneados, estado (`en_proceso` | `completada` | `liberada`), inicio, fin, liberada_por_*, liberada_at
  - Índice único parcial: solo una toma no liberada por (fecha_operativa, horario, ruta_id). Ese índice es el que hace el bloqueo, aunque dos pistolas intenten tomar la misma ruta al mismo tiempo.
- **escaneos:** un renglón por lectura. Guarda fecha_hora, toma_id, sesion_id, fecha_operativa, turno, horario, ruta_nombre, consecutivo, kanbans_programados, codigo_leido, numero_parte, descripcion, imagen_mostrada, resultado, segundos/tiempo desde inicio y desde el anterior (mm:ss), operador y personal de los 3 pasillos, y sincronizado_offline.
  - El `id` lo genera la app (UUID) para que los reintentos sin red no dupliquen registros.

**RLS:** la app solo lee catálogos, inserta sesiones, tomas y escaneos, y actualiza `tomas_ruta` únicamente a `completada` o `liberada`. No puede borrar ni editar escaneos.

## ARCHIVOS

```
control-embarques-ttmx/
├── index.html, package.json, vite.config.js, netlify.toml, .env.example
├── public/manifest.webmanifest
├── supabase/schema.sql
└── src/
    ├── main.jsx, App.jsx (máquina de pasos; estado guardado en localStorage)
    ├── config.js        ← TURNOS, PUESTOS, utilidades (parseEmpleado, fmtTiempo…)
    ├── index.css        ← color principal #3576ac
    ├── components/ScanInput.jsx (input invisible DataWedge + botón manual), UI.jsx
    ├── pages/Login, Turno, Personal, Rutas, Supervisor, Cantidad, Escaneo (.jsx)
    └── services/supabase.js, offlineQueue.js
```

## DETALLES TÉCNICOS

- **DataWedge:** perfil con Keystroke output y "Send ENTER key" (también acepta TAB). No usa cámara.
- **Gafete:** se toman los dígitos iniciales del QR (`parseEmpleado` en config.js).
- **Biblioteca:** al entrar a escanear se carga todo `productos` en memoria (se refresca cada 10 min). La búsqueda es instantánea y funciona sin red. Las imágenes sí necesitan red.
- **Offline:** los escaneos y el cierre de ruta se guardan en una cola local y se sincronizan cada 15 s o al recuperar la red. Arriba aparece una barra amarilla con los pendientes.
- **Recarga:** si la pistola recarga la página, se retoma en el mismo paso, con el mismo contador y cronómetro. El modo supervisor sí vuelve a pedir el QR.
- **Código PLEX:** se normaliza quitando espacios y `*` (Code 39) y pasando a mayúsculas (`normCodigo`).
- **Lectura doble:** solo se ignora el mismo código si llega en menos de 1.5 s (rebote de la pistola).
- **Fecha operativa:** es el día en que EMPEZÓ el turno (`fechaOperativa` en config.js). En el **Segundo turno, que cruza la medianoche**, lo que se escanea antes de las 12:00 del día (`HORA_CORTE_SEGUNDO_TURNO`) cuenta para el día anterior. Así los bloqueos de ruta y los reportes no se parten a medianoche.
- Si la pistola conserva una sesión de un turno anterior, el menú de rutas muestra un aviso con el botón "Iniciar nuevo turno".

## DESPLIEGUE

1. Crear un proyecto nuevo en Supabase y correr `supabase/schema.sql` en el SQL Editor.
2. Crear un bucket público `imagenes-ttmx`, subir las imágenes y poner la URL pública en `productos.imagen_url`.
3. Crear el repo en GitHub y subir esta carpeta (sin node_modules ni dist).
4. En Netlify, importar el repo y agregar las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
5. Dar de alta empleados (con `rol='supervisor'` para quien desbloquea), rutas y productos.

## PENDIENTES / POR AJUSTAR

- `supabase/migracion_v1_3.sql`: actualiza una base creada con una versión anterior del schema.
- Para mover una ruta de horario: `update rutas set horarios = array['Segundo turno'] where nombre = 'X';`
- Dashboard de administración (KPIs, tiempos por ruta y por operador, exportar a Excel).
