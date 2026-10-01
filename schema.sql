-- =====================================================================
-- Control Embarques TTMX — Esquema Supabase
-- Ejecutar completo en: Supabase > SQL Editor > New query > Run
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- EMPLEADOS  (operadores y supervisores; rol decide quién desbloquea)
-- ---------------------------------------------------------------------
create table if not exists empleados (
  id              uuid primary key default gen_random_uuid(),
  numero_empleado text not null unique,
  nombre          text not null,
  rol             text not null default 'operador' check (rol in ('operador','supervisor')),
  activo          boolean not null default true,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RUTAS  (catálogo de rutas que aparecen en el menú)
-- ---------------------------------------------------------------------
create table if not exists rutas (
  id      serial primary key,
  nombre  text not null unique,
  orden   int not null default 0,
  horarios text[],                -- 'Primer turno' / 'Segundo turno'; null = en todos
  activo  boolean not null default true
);

-- ---------------------------------------------------------------------
-- PRODUCTOS  (biblioteca de imágenes ligada al código PLEX)
-- ---------------------------------------------------------------------
create table if not exists productos (
  id           uuid primary key default gen_random_uuid(),
  codigo_plex  text not null unique,      -- texto de la etiqueta PLEX, ej. M105 (en MAYÚSCULAS)
  numero_parte text,
  descripcion  text,
  imagen_url   text,                      -- URL pública del bucket imagenes-ttmx
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- SESIONES  (quién inició, turno y personal asignado a cada pasillo)
-- ---------------------------------------------------------------------
create table if not exists sesiones (
  id               uuid primary key default gen_random_uuid(),
  fecha_operativa  date not null,
  turno            text not null,          -- equipo: Turno Verde / Turno Azul (rotan)
  horario          text not null,          -- Primer turno / Segundo turno
  operador_numero  text not null,
  operador_nombre  text,
  pasillo1_numero  text, pasillo1_nombre text,
  pasillo2_numero  text, pasillo2_nombre text,
  welding_numero   text, welding_nombre  text,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- TOMAS_RUTA  (cada vez que alguien toma una ruta; controla el bloqueo)
-- ---------------------------------------------------------------------
create table if not exists tomas_ruta (
  id                   uuid primary key default gen_random_uuid(),
  sesion_id            uuid references sesiones(id),
  fecha_operativa      date not null,
  turno                text not null,
  horario              text not null,
  ruta_id              int not null references rutas(id),
  ruta_nombre          text,
  operador_numero      text,
  operador_nombre      text,
  kanbans_programados  int not null check (kanbans_programados > 0),
  kanbans_escaneados   int not null default 0,
  estado               text not null default 'en_proceso'
                       check (estado in ('en_proceso','completada','liberada')),
  inicio               timestamptz not null default now(),
  fin                  timestamptz,
  liberada_por_numero  text,
  liberada_por_nombre  text,
  liberada_at          timestamptz
);

-- Una ruta solo puede estar tomada una vez por fecha + horario
-- (hasta que un supervisor la marque como 'liberada').
create unique index if not exists tomas_ruta_una_activa
  on tomas_ruta (fecha_operativa, horario, ruta_id)
  where estado <> 'liberada';

-- ---------------------------------------------------------------------
-- ESCANEOS  (un renglón por cada lectura PLEX; desnormalizado para reportes)
-- ---------------------------------------------------------------------
create table if not exists escaneos (
  id                       uuid primary key,          -- lo genera la app (evita duplicados offline)
  fecha_hora               timestamptz not null,
  toma_id                  uuid references tomas_ruta(id),
  sesion_id                uuid references sesiones(id),
  fecha_operativa          date,
  turno                    text,
  horario                  text,
  ruta_nombre              text,
  consecutivo              int,                       -- 1..N solo si se encontró
  kanbans_programados      int,
  codigo_leido             text not null,
  numero_parte             text,
  descripcion              text,
  imagen_mostrada          boolean not null default false,
  resultado                text not null check (resultado in ('encontrado','no_encontrado')),
  segundos_desde_inicio    int,
  segundos_desde_anterior  int,
  tiempo_desde_inicio      text,                      -- mm:ss
  tiempo_desde_anterior    text,                      -- mm:ss
  operador_numero          text, operador_nombre text,
  pasillo1_numero          text, pasillo1_nombre text,
  pasillo2_numero          text, pasillo2_nombre text,
  welding_numero           text, welding_nombre  text,
  sincronizado_offline     boolean not null default false,
  created_at               timestamptz not null default now()
);

create index if not exists escaneos_fecha_idx on escaneos (fecha_operativa, horario);
create index if not exists escaneos_toma_idx  on escaneos (toma_id);

-- ---------------------------------------------------------------------
-- SEGURIDAD (RLS)
-- La app solo puede LEER catálogos, INSERTAR registros y actualizar
-- tomas_ruta (completar / liberar). No puede borrar ni editar escaneos.
-- ---------------------------------------------------------------------
alter table empleados  enable row level security;
alter table rutas      enable row level security;
alter table productos  enable row level security;
alter table sesiones   enable row level security;
alter table tomas_ruta enable row level security;
alter table escaneos   enable row level security;

create policy empleados_lectura  on empleados  for select to anon using (true);
create policy rutas_lectura      on rutas      for select to anon using (true);
create policy productos_lectura  on productos  for select to anon using (true);

create policy sesiones_lectura   on sesiones   for select to anon using (true);
create policy sesiones_insertar  on sesiones   for insert to anon with check (true);

create policy tomas_lectura      on tomas_ruta for select to anon using (true);
create policy tomas_insertar     on tomas_ruta for insert to anon with check (estado = 'en_proceso');
create policy tomas_actualizar   on tomas_ruta for update to anon using (true)
  with check (estado in ('completada','liberada'));

create policy escaneos_lectura   on escaneos   for select to anon using (true);
create policy escaneos_insertar  on escaneos   for insert to anon with check (true);

-- ---------------------------------------------------------------------
-- DATOS DE PRUEBA (cámbialos por los reales)
-- ---------------------------------------------------------------------
-- Rutas TTMX (fijas por horario):
--   Primer turno:  E … AD
--   Segundo turno: AE … AY, luego A … D
insert into rutas (nombre, orden, horarios) values
  ('E', 1, array['Primer turno']), ('F', 2, array['Primer turno']), ('G', 3, array['Primer turno']),
  ('H', 4, array['Primer turno']), ('I', 5, array['Primer turno']), ('J', 6, array['Primer turno']),
  ('K', 7, array['Primer turno']), ('L', 8, array['Primer turno']), ('M', 9, array['Primer turno']),
  ('N', 10, array['Primer turno']), ('O', 11, array['Primer turno']), ('P', 12, array['Primer turno']),
  ('Q', 13, array['Primer turno']), ('R', 14, array['Primer turno']), ('S', 15, array['Primer turno']),
  ('T', 16, array['Primer turno']), ('U', 17, array['Primer turno']), ('V', 18, array['Primer turno']),
  ('W', 19, array['Primer turno']), ('X', 20, array['Primer turno']), ('Y', 21, array['Primer turno']),
  ('Z', 22, array['Primer turno']), ('AA', 23, array['Primer turno']), ('AB', 24, array['Primer turno']),
  ('AC', 25, array['Primer turno']), ('AD', 26, array['Primer turno']), ('AE', 1, array['Segundo turno']),
  ('AF', 2, array['Segundo turno']), ('AG', 3, array['Segundo turno']), ('AH', 4, array['Segundo turno']),
  ('AI', 5, array['Segundo turno']), ('AJ', 6, array['Segundo turno']), ('AK', 7, array['Segundo turno']),
  ('AL', 8, array['Segundo turno']), ('AM', 9, array['Segundo turno']), ('AN', 10, array['Segundo turno']),
  ('AO', 11, array['Segundo turno']), ('AP', 12, array['Segundo turno']), ('AQ', 13, array['Segundo turno']),
  ('AR', 14, array['Segundo turno']), ('AS', 15, array['Segundo turno']), ('AT', 16, array['Segundo turno']),
  ('AU', 17, array['Segundo turno']), ('AV', 18, array['Segundo turno']), ('AW', 19, array['Segundo turno']),
  ('AX', 20, array['Segundo turno']), ('AY', 21, array['Segundo turno']), ('A', 22, array['Segundo turno']),
  ('B', 23, array['Segundo turno']), ('C', 24, array['Segundo turno']), ('D', 25, array['Segundo turno'])
on conflict (nombre) do update
  set orden = excluded.orden, horarios = excluded.horarios, activo = true;

insert into empleados (numero_empleado, nombre, rol) values
  ('1001', 'Operador Prueba',   'operador'),
  ('1002', 'Pasillo Uno Prueba','operador'),
  ('1003', 'Pasillo Dos Prueba','operador'),
  ('1004', 'Welding Prueba',    'operador'),
  ('9001', 'Supervisor Prueba', 'supervisor')
on conflict (numero_empleado) do nothing;

insert into productos (codigo_plex, numero_parte, descripcion, imagen_url) values
  ('M105', 'M105', 'Producto de prueba (etiqueta M105)', null)
on conflict (codigo_plex) do nothing;
