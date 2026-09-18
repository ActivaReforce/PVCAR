# Barrido de SQL contra un Postgres de usar y tirar

Sirve para validar **todo** el SQL del backend sin encender la aplicación y sin
tocar ninguna Supabase: tablas, columnas, tipos y número de parámetros los
comprueba el propio motor.

Nació el 2026-09-18, cuando Disciplinas y Entrenadores devolvían 500 en `dev`.
La consulta de la página estaba bien; la de los conteos mandaba parámetros de
más. Ni la CI ni las pruebas de servicio lo veían, porque los repositorios van
siempre fingidos.

## Lo que ya corre en cada CI

`backend/src/modules/sql-parametros.test.ts` finge el pool, llama a todas las
funciones exportadas de los repositorios —más `alcanceDe`, `auditar` y las diez
definiciones de reportes— y comprueba las dos reglas que Postgres no perdona:

1. tantos valores como marcadores;
2. sin huecos entre `$1` y `$n`, porque un marcador que no aparece en el texto
   no tiene tipo que deducir.

## El barrido completo, a mano

Hace falta el Postgres 17 que ya está instalado (`C:\Program Files\PostgreSQL\17\bin`).

1. Volcar el SQL:

   ```
   PVCAR_VOLCAR_SQL=1 npx vitest run --root backend src/modules/sql-parametros.test.ts
   ```

   Deja `dump-sql.json` en la raíz (gitignoreado).

2. Levantar un clúster aparte, en un puerto que no moleste:

   ```
   initdb -D pgdata -U postgres --auth=trust -E UTF8
   pg_ctl -D pgdata -o "-p 55432" -l pg.log start
   createdb -h localhost -p 55432 -U postgres pvcar_espejo
   ```

3. Aplicar las migraciones de `db/migrations` **menos** `0003_storage`,
   `0004_seed_dev` y `0005_grants`, que son de Supabase. Antes hay que crear los
   roles que el baseline nombra: `anon`, `authenticated`, `service_role`.

4. Convertir cada consulta del volcado en un `PREPARE qN AS …;` y pasárselas a
   `psql`. `PREPARE` valida sin ejecutar: no toca datos.

5. Al terminar, `pg_ctl -D pgdata stop` y borrar la carpeta.

Resultado del 2026-09-18: 187 consultas distintas, dos fallos reales
—`contarEstudiantes` con hueco en `$6` y `marcarEstadoPendiente` mezclando
`integer` y `smallint` sobre el mismo `$2`— y ningún nombre de tabla o columna
que no exista.
