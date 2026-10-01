-- Solo si YA habías corrido una versión anterior de schema.sql.
-- Agrega el "horario" (Primer / Segundo turno) y asigna las rutas fijas.
-- Si vas a empezar de cero, corre solo schema.sql.

-- 1) Rutas: horario fijo
alter table rutas drop column if exists turnos;
alter table rutas add column if not exists horarios text[];
update rutas set activo = false where nombre like 'Ruta %';

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

-- 2) Horario en sesiones, tomas y escaneos
alter table sesiones   add column if not exists horario text;
alter table tomas_ruta add column if not exists horario text;
alter table escaneos   add column if not exists horario text;
update sesiones   set horario = 'Primer turno' where horario is null;
update tomas_ruta set horario = 'Primer turno' where horario is null;
alter table sesiones   alter column horario set not null;
alter table tomas_ruta alter column horario set not null;

-- 3) El bloqueo de ruta ahora es por fecha + horario
drop index if exists tomas_ruta_una_activa;
create unique index tomas_ruta_una_activa
  on tomas_ruta (fecha_operativa, horario, ruta_id)
  where estado <> 'liberada';
drop index if exists escaneos_fecha_idx;
create index if not exists escaneos_fecha_idx on escaneos (fecha_operativa, horario);

-- 4) Producto de prueba con etiqueta real
update productos set activo = false where codigo_plex = 'PLEX-TEST-001';
insert into productos (codigo_plex, numero_parte, descripcion)
values ('M105', 'M105', 'Producto de prueba (etiqueta M105)')
on conflict (codigo_plex) do nothing;
