/* Pruebas 5 y 8 de la Fase 7.
 *
 * Son las dos que no se pueden hacer desde la pantalla: el desplegable de
 * coordinadores solo ofrece candidatos validos, y no hay ruta a la ficha de un
 * colegio ajeno. Se hacen contra el API con la sesion que ya esta abierta.
 *
 * Uso: F12 -> Console en dev-pvcar.vercel.app, pegar y Enter.
 */

const API = 'https://pvcarbackend-development.up.railway.app/api/v1';
const TOKEN = JSON.parse(
  localStorage.getItem('sb-vjwlwjqaalppzmycbalw-auth-token'),
).access_token;

async function probar(etiqueta, metodo, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json().catch(() => null);
  console.log(`${etiqueta}\n   -> ${r.status}  ${JSON.stringify(j?.error ?? j?.data ?? j)}\n`);
}

/* =======================================================================
 * PRUEBA 5 — coordinador invalido.  Ejecutar como PROPIETARIO.
 * Cambia COL_ID por el id del colegio que creaste en la prueba 1.
 * Se esperan dos 400 que digan QUE id falla.
 * ===================================================================== */
const COL_ID = 17;

await probar('5a  entrenador sin rol 2 (id 60)', 'PUT', `/colegios/${COL_ID}/coordinadores`, {
  coordinadores: [60],
});
await probar('5b  usuario inactivo (id 56)', 'PUT', `/colegios/${COL_ID}/coordinadores`, {
  coordinadores: [56],
});
await probar('5c  id que no existe (999999)', 'PUT', `/colegios/${COL_ID}/coordinadores`, {
  coordinadores: [999999],
});

/* =======================================================================
 * PRUEBA 8 — alcance por API.  Ejecutar como COORDINADOR (Johanna, 112),
 * que lleva Calderon (12). Innova Quitumbe (11) NO es suyo.
 * Se esperan dos 403.
 * ===================================================================== */
await probar('8a  ficha de un colegio ajeno', 'GET', '/colegios/11');
await probar('8b  editar un colegio ajeno', 'PATCH', '/colegios/11', {
  col_direccion: 'no deberia guardarse',
});

/* Control: el suyo si debe salir 200. Si esto falla, el problema no es el
   alcance sino la sesion. */
await probar('8c  control: su propio colegio', 'GET', '/colegios/12');
