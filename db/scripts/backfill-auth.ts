/**
 * backfill-auth.ts — siembra Supabase Auth con las contrasenas actuales.
 *
 * Objetivo (Anexo A del Plan): que el dia del cutover cada persona entre con
 * el mismo correo y la misma contrasena de siempre, sin correo de verificacion
 * y sin reset. Se puede porque hoy las contrasenas estan en texto plano: se
 * mandan a Supabase Auth, que las guarda hasheadas con bcrypt.
 *
 * QUE HACE
 *   1. Lee los usuarios ACTIVOS (est_id = 1) del dump de la base vieja.
 *   2. Valida correo y longitud de contrasena. Lo que no valida no se intenta:
 *      va al reporte con su motivo.
 *   3. Crea la cuenta en Auth con email_confirm: true — eso es lo que evita
 *      que 50 personas reciban un correo de verificacion el dia del cutover.
 *   4. Enlaza auth_user_id en public.usuario si la fila ya existe.
 *   5. Deje o no filas por enlazar, escribe el mapeo usu_id -> auth_user_id en
 *      db/scripts/out/ para la carga de datos del cutover.
 *
 * POR QUE ESCRIBE UN MAPEO Y NO SOLO UPDATEs:
 *   public.usuario tiene CHECK (est_id <> 1 OR auth_user_id IS NOT NULL). Un
 *   usuario activo NO se puede insertar con auth_user_id en NULL, asi que en el
 *   cutover las cuentas de Auth tienen que existir ANTES de cargar los datos, y
 *   la carga debe traer el auth_user_id puesto. Este script corre primero.
 *
 * ES IDEMPOTENTE: se puede correr N veces. Una cuenta que ya existe en Auth se
 * reusa en vez de fallar, y una fila ya enlazada se salta.
 *
 * USO (desde la raiz del repo):
 *   # 1. Ensayo. No escribe nada, ni en Auth ni en la base. Es el modo por defecto.
 *   npm run backfill:auth -- --dump ../Backup_bd/prod_data_public_2026-07-27.sql
 *
 *   # 2. De verdad, cuando el ensayo cierre limpio:
 *   npm run backfill:auth -- --dump ../Backup_bd/prod_data_public_2026-07-27.sql --apply
 *
 *   # 3. Solo en PVCAR_Dev: ademas inserta usuario y usuario_rol del dump, que
 *   #    es lo que permite probar el login por rol antes del cutover.
 *   npm run backfill:auth -- --dump ... --apply --seed-dev
 *
 * VARIABLES DE ENTORNO (las del proyecto DESTINO, nunca las de la base vieja):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 *
 * El cutover no avanza hasta que el reporte cierre con 0 omitidos.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import { leerBloqueCopy } from './dump.js';

const PAUSA_ENTRE_CUENTAS_MS = 150;
const MIN_PASSWORD = 6;
const DIR_SALIDA = path.resolve(process.cwd(), 'db/scripts/out');

/**
 * Huella de PVCAR_Dev: la sembro 0004_seed_dev.sql, que nunca corre en prod.
 * Es la guardia de --seed-dev — sin esta fila, el script se niega a insertar
 * usuarios, porque en prod chocarian con la carga del cutover.
 */
const COLEGIO_MARCA_DEV = 'Colegio de Pruebas Dev';

/** Laxa a proposito: acepta subdominios y rechaza lo que Auth rechazaria. */
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

interface UsuarioDump {
  usu_id: number;
  usu_nombre: string;
  usu_correo: string;
  usu_contrasena: string;
  usu_telefono: string | null;
  est_id: number;
}

interface Omitido {
  usu_id: number;
  correo: string;
  motivo: string;
}

// ---------------------------------------------------------------- argumentos

function leerArgs() {
  const argv = process.argv.slice(2);
  const dumpIdx = argv.indexOf('--dump');
  const dump = dumpIdx >= 0 ? argv[dumpIdx + 1] : process.env.DUMP_PATH;

  if (!dump) {
    console.error('Falta --dump <ruta al dump de la base vieja> (o DUMP_PATH).');
    process.exit(2);
  }

  return {
    dump,
    apply: argv.includes('--apply'),
    // Solo para PVCAR_Dev: ademas de crear las cuentas, inserta las filas de
    // public.usuario y usuario_rol del dump, que es lo unico que permite
    // probar el login por rol antes del cutover (0004_seed_dev no siembra
    // usuarios: una cuenta de Auth no se crea desde SQL).
    seedDev: argv.includes('--seed-dev'),
  };
}

function leerEnv() {
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  const faltan = [
    !url && 'SUPABASE_URL',
    !serviceRole && 'SUPABASE_SERVICE_ROLE_KEY',
    !databaseUrl && 'DATABASE_URL',
  ].filter(Boolean);

  if (faltan.length > 0) {
    console.error(`Faltan variables de entorno: ${faltan.join(', ')}`);
    process.exit(2);
  }

  return { url: url!, serviceRole: serviceRole!, databaseUrl: databaseUrl! };
}

// ------------------------------------------------------------- dump -> filas

/** El correo se normaliza igual que el indice unico de la tabla nueva. */
export function parsearDump(ruta: string): UsuarioDump[] {
  return leerBloqueCopy(ruta, 'usuario').map((r) => ({
    usu_id: Number(r.usu_id),
    usu_nombre: r.usu_nombre ?? '',
    usu_correo: (r.usu_correo ?? '').trim().toLowerCase(),
    usu_contrasena: r.usu_contrasena ?? '',
    usu_telefono: r.usu_telefono,
    est_id: Number(r.est_id),
  }));
}

/** Roles por usuario, del mismo dump. Solo se usan con --seed-dev. */
export function parsearRoles(ruta: string): Map<number, number[]> {
  const porUsuario = new Map<number, number[]>();
  for (const r of leerBloqueCopy(ruta, 'usuario_rol')) {
    const usuId = Number(r.usu_id);
    const rolId = Number(r.rol_id);
    const actuales = porUsuario.get(usuId) ?? [];
    if (!actuales.includes(rolId)) {
      actuales.push(rolId);
    }
    porUsuario.set(usuId, actuales);
  }
  return porUsuario;
}

// ------------------------------------------------------------------- salidas

function escribirMapeo(mapeo: Array<{ usu_id: number; auth_user_id: string }>): void {
  mkdirSync(DIR_SALIDA, { recursive: true });

  const csv = ['usu_id,auth_user_id', ...mapeo.map((m) => `${m.usu_id},${m.auth_user_id}`)].join(
    '\n',
  );
  writeFileSync(path.join(DIR_SALIDA, 'auth_user_ids.csv'), `${csv}\n`, 'utf8');

  const sql = [
    '-- Generado por db/scripts/backfill-auth.ts. Mapeo usu_id -> auth.users.id.',
    '-- Sirve para enlazar filas de public.usuario que se carguen despues.',
    '',
    ...mapeo.map(
      (m) =>
        `UPDATE public.usuario SET auth_user_id = '${m.auth_user_id}' WHERE usu_id = ${m.usu_id} AND auth_user_id IS NULL;`,
    ),
    '',
  ].join('\n');
  writeFileSync(path.join(DIR_SALIDA, 'auth_user_ids.sql'), sql, 'utf8');
}

// ------------------------------------------------------------ seed de dev

/**
 * Inserta la fila de public.usuario y sus roles. SOLO con --seed-dev.
 *
 * Va en una transaccion: un usuario sin roles no sirve para probar permisos,
 * asi que o entran los dos o no entra ninguno.
 *
 * Se conserva el usu_id del dump para que dev y prod hablen de la misma
 * persona con el mismo numero. usu_foto queda en NULL a proposito: las URLs
 * del dump apuntan al bucket viejo, que ahora es privado.
 */
async function sembrarUsuario(
  pool: pg.Pool,
  u: UsuarioDump,
  authUserId: string,
  roles: number[],
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query(
      `INSERT INTO public.usuario
           (usu_id, auth_user_id, usu_nombre, usu_correo, usu_telefono, est_id)
       VALUES ($1, $2, $3, $4, $5, 1)`,
      [u.usu_id, authUserId, u.usu_nombre, u.usu_correo, u.usu_telefono],
    );
    for (const rolId of roles) {
      await cliente.query(
        `INSERT INTO public.usuario_rol (usu_id, rol_id) VALUES ($1, $2)
         ON CONFLICT (usu_id, rol_id) DO NOTHING`,
        [u.usu_id, rolId],
      );
    }
    await cliente.query('COMMIT');
  } catch (err) {
    await cliente.query('ROLLBACK');
    throw err;
  } finally {
    cliente.release();
  }
}

/**
 * Reajusta la secuencia de usu_id. Hace falta porque se insertaron ids
 * explicitos: la identity sigue en 1 y el proximo INSERT sin id chocaria.
 */
async function resincronizarSecuencia(pool: pg.Pool): Promise<void> {
  await pool.query(
    `SELECT setval(
         pg_get_serial_sequence('public.usuario', 'usu_id'),
         GREATEST((SELECT COALESCE(MAX(usu_id), 1) FROM public.usuario), 1)
     )`,
  );
}

// --------------------------------------------------------------------- main

async function main(): Promise<void> {
  const { dump, apply, seedDev } = leerArgs();
  const { url, serviceRole, databaseUrl } = leerEnv();

  console.log(`Modo: ${apply ? 'APLICAR (escribe en Auth y en la base)' : 'ENSAYO (no escribe nada)'}`);
  if (seedDev) {
    console.log('Con --seed-dev: tambien insertara usuario y usuario_rol (solo PVCAR_Dev).');
  }
  console.log(`Dump: ${dump}`);
  console.log(`Destino: ${url}\n`);

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 4,
    ssl: { rejectUnauthorized: false },
  });

  try {
    // Guardia: si la tabla destino tiene usu_contrasena, es el schema VIEJO y
    // DATABASE_URL apunta a la base equivocada. Abortar antes de tocar nada.
    const { rows: cols } = await pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'usuario'
             AND column_name = 'usu_contrasena'
       ) AS existe`,
    );
    if (cols[0]?.existe) {
      throw new Error(
        'La base destino tiene public.usuario.usu_contrasena: es el schema viejo. ' +
          'Revisa DATABASE_URL — este script solo corre contra PVCAR o PVCAR_Dev.',
      );
    }

    // Guardia de --seed-dev: solo la base de dev tiene el colegio de pruebas
    // de 0004_seed_dev. En prod insertar usuarios aqui chocaria con la carga
    // del cutover, asi que se aborta antes de crear ni una cuenta.
    if (seedDev) {
      const { rows: marca } = await pool.query<{ existe: boolean }>(
        'SELECT EXISTS (SELECT 1 FROM public.colegio WHERE col_nombre = $1) AS existe',
        [COLEGIO_MARCA_DEV],
      );
      if (!marca[0]?.existe) {
        throw new Error(
          `--seed-dev exige la base de desarrollo y no se encontro "${COLEGIO_MARCA_DEV}" ` +
            '(lo siembra 0004_seed_dev.sql). En prod los usuarios entran con la carga del cutover.',
        );
      }
    }

    const todos = parsearDump(dump);
    const activos = todos.filter((u) => u.est_id === 1);
    const rolesDump = seedDev ? parsearRoles(dump) : new Map<number, number[]>();
    console.log(`Usuarios en el dump: ${todos.length} (activos: ${activos.length})\n`);

    // Indice de lo que ya existe en Auth, para reusar en vez de fallar.
    // La Admin API no tiene "buscar por correo": se lista y se indexa.
    const yaEnAuth = new Map<string, string>();
    for (let page = 1; ; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(`No se pudo listar auth.users: ${error.message}`);
      for (const u of data.users) {
        if (u.email) yaEnAuth.set(u.email.trim().toLowerCase(), u.id);
      }
      if (data.users.length < 1000) break;
    }
    console.log(`Cuentas ya existentes en Auth: ${yaEnAuth.size}\n`);

    // Filas que ya existen en la base destino y su enlace actual.
    const { rows: filasDestino } = await pool.query<{
      usu_id: number;
      auth_user_id: string | null;
    }>('SELECT usu_id, auth_user_id FROM public.usuario');
    const enlaceActual = new Map(filasDestino.map((f) => [f.usu_id, f.auth_user_id]));

    const omitidos: Omitido[] = [];
    const mapeo: Array<{ usu_id: number; auth_user_id: string }> = [];
    let creados = 0;
    let reusados = 0;
    let enlazados = 0;
    let yaEnlazados = 0;
    let pendientesDeCarga = 0;
    let sembrados = 0;

    for (const u of activos) {
      // Ya enlazado: nada que hacer. Es el caso normal al reejecutar.
      if (enlaceActual.get(u.usu_id)) {
        yaEnlazados++;
        continue;
      }

      if (!RE_CORREO.test(u.usu_correo)) {
        omitidos.push({
          usu_id: u.usu_id,
          correo: u.usu_correo,
          motivo: 'correo con formato invalido — corregir en el sistema viejo',
        });
        continue;
      }

      if (u.usu_contrasena.length < MIN_PASSWORD) {
        omitidos.push({
          usu_id: u.usu_id,
          correo: u.usu_correo,
          motivo: `contrasena de ${u.usu_contrasena.length} caracteres (Auth exige ${MIN_PASSWORD}) — campana previa, Anexo A.4`,
        });
        continue;
      }

      const existente = yaEnAuth.get(u.usu_correo);
      let authUserId = existente;
      let creadaAhora = false;

      if (!authUserId) {
        if (!apply) {
          // Ensayo: se cuenta lo que se crearia y donde iria a parar, sin
          // crear nada ni pedirle un id a Auth.
          creados++;
          if (enlaceActual.has(u.usu_id)) {
            enlazados++;
          } else if (seedDev) {
            sembrados++;
          } else {
            pendientesDeCarga++;
          }
          continue;
        }

        const { data, error } = await admin.auth.admin.createUser({
          email: u.usu_correo,
          password: u.usu_contrasena,
          // La clave de que la migracion sea invisible: la cuenta nace
          // confirmada y nadie recibe correo de verificacion.
          email_confirm: true,
          user_metadata: { usu_id: u.usu_id },
        });

        if (error || !data.user) {
          omitidos.push({
            usu_id: u.usu_id,
            correo: u.usu_correo,
            motivo: `Auth rechazo la creacion: ${error?.message ?? 'sin detalle'}`,
          });
          continue;
        }

        authUserId = data.user.id;
        creadaAhora = true;
        creados++;
        yaEnAuth.set(u.usu_correo, authUserId);
        await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_CUENTAS_MS));
      } else {
        reusados++;
      }

      mapeo.push({ usu_id: u.usu_id, auth_user_id: authUserId });

      // La fila de public.usuario todavia no existe.
      if (!enlaceActual.has(u.usu_id)) {
        if (!seedDev) {
          // Pre-cutover normal: no es error. Queda en el mapeo para la carga.
          pendientesDeCarga++;
          continue;
        }
        if (!apply) {
          sembrados++;
          continue;
        }
        try {
          await sembrarUsuario(pool, u, authUserId, rolesDump.get(u.usu_id) ?? []);
          sembrados++;
        } catch (err) {
          if (creadaAhora) {
            await admin.auth.admin.deleteUser(authUserId);
            yaEnAuth.delete(u.usu_correo);
            creados--;
            mapeo.pop();
          }
          omitidos.push({
            usu_id: u.usu_id,
            correo: u.usu_correo,
            motivo: `fallo el INSERT de usuario: ${(err as Error).message}`,
          });
        }
        continue;
      }

      // En ensayo no se escribe ni aqui, aunque la cuenta ya exista en Auth.
      if (!apply) {
        enlazados++;
        continue;
      }

      try {
        const { rowCount } = await pool.query(
          'UPDATE public.usuario SET auth_user_id = $1 WHERE usu_id = $2 AND auth_user_id IS NULL',
          [authUserId, u.usu_id],
        );
        if (rowCount === 1) {
          enlazados++;
        } else {
          omitidos.push({
            usu_id: u.usu_id,
            correo: u.usu_correo,
            motivo: 'la fila cambio de enlace mientras corria el script',
          });
        }
      } catch (err) {
        // Regla del Anexo A paso 5: si la escritura falla, se borra la cuenta
        // recien creada. Sin esto quedan cuentas huerfanas en Auth que
        // bloquean el correo en la siguiente corrida.
        if (creadaAhora) {
          await admin.auth.admin.deleteUser(authUserId);
          yaEnAuth.delete(u.usu_correo);
          creados--;
          mapeo.pop();
        }
        omitidos.push({
          usu_id: u.usu_id,
          correo: u.usu_correo,
          motivo: `fallo el UPDATE de auth_user_id: ${(err as Error).message}`,
        });
      }
    }

    if (apply && sembrados > 0) {
      await resincronizarSecuencia(pool);
    }

    if (apply && mapeo.length > 0) {
      escribirMapeo(mapeo);
    }

    // ------------------------------------------------------------- reporte
    console.log('=== Resumen ===');
    console.log(`Activos en el dump:          ${activos.length}`);
    console.log(`Ya enlazados (sin tocar):    ${yaEnlazados}`);
    console.log(`Cuentas creadas en Auth:     ${creados}${apply ? '' : ' (se crearian)'}`);
    console.log(`Cuentas reusadas:            ${reusados}`);
    console.log(`Enlazados en public.usuario: ${enlazados}`);
    if (seedDev) {
      console.log(`Sembrados en dev:            ${sembrados}`);
    }
    console.log(`Pendientes de la carga:      ${pendientesDeCarga}`);
    console.log(`Omitidos:                    ${omitidos.length}`);

    if (omitidos.length > 0) {
      console.log('\nOmitidos, uno por uno:');
      for (const o of omitidos) {
        console.log(`  usu_id ${o.usu_id}  ${o.correo}  →  ${o.motivo}`);
      }
    }

    if (apply && mapeo.length > 0) {
      console.log(`\nMapeo escrito en ${DIR_SALIDA} (auth_user_ids.csv y .sql).`);
    }

    const cubiertos = yaEnlazados + creados + reusados;
    console.log(`\nCobertura: ${cubiertos}/${activos.length} usuarios activos.`);

    if (omitidos.length > 0 || cubiertos < activos.length) {
      console.log('\nEl reporte NO cierra limpio. El cutover no debe avanzar asi.');
      process.exitCode = 1;
    } else {
      console.log('\nReporte limpio.');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error('\nbackfill-auth fallo:', err instanceof Error ? err.message : err);
  process.exit(1);
});
