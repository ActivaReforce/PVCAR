import { ROL, ROLES_GLOBALES } from '../../lib/constants.js';

/**
 * Reglas de quien puede repartir que rol.
 *
 * Estan aparte del servicio, sin base de datos ni red, para poder probarlas:
 * son decisiones de negocio puras y son justo las que, si fallan, permiten que
 * alguien se ascienda a si mismo.
 *
 * El sistema viejo no tenia ninguna de las dos: el formulario mandaba la lista
 * de roles y el navegador la escribia directo en usuario_rol con la anon key.
 */

export function esGlobal(rolesDelActor: number[]): boolean {
  return rolesDelActor.some((r) => ROLES_GLOBALES.includes(r));
}

/** Los roles que cambian entre el antes y el despues, en las dos direcciones. */
export function diferenciaDeRoles(
  antes: number[],
  despues: number[],
): { agregados: number[]; quitados: number[] } {
  return {
    agregados: despues.filter((r) => !antes.includes(r)),
    quitados: antes.filter((r) => !despues.includes(r)),
  };
}

export interface Veredicto {
  ok: boolean;
  motivo?: string;
}

const OK: Veredicto = { ok: true };

/**
 * Solo un rol global (Propietario o Admin Activa Reforce) puede conceder o
 * retirar roles globales.
 *
 * Sin esto, basta con que la pantalla de Permisos le de `usuarios.editar` a un
 * Coordinador — algo que la matriz permite y que es razonable querer — para que
 * ese coordinador pueda nombrarse Propietario y quedarse con el sistema. Hoy
 * los datos reales no le dan ese permiso a nadie mas que al Propietario, asi
 * que es una puerta cerrada por costumbre, no por diseno. Aqui se cierra por
 * diseno.
 */
export function puedeRepartirEsosRoles(
  rolesDelActor: number[],
  rolesAntes: number[],
  rolesDespues: number[],
): Veredicto {
  if (esGlobal(rolesDelActor)) return OK;

  const { agregados, quitados } = diferenciaDeRoles(rolesAntes, rolesDespues);
  const tocaGlobales = [...agregados, ...quitados].filter((r) => ROLES_GLOBALES.includes(r));

  if (tocaGlobales.length > 0) {
    return {
      ok: false,
      motivo:
        'Solo Propietario PVCAR o Administrador Activa Reforce pueden conceder o retirar esos roles.',
    };
  }
  return OK;
}

/**
 * Nadie se concede a si mismo un rol que no tenia.
 *
 * Quitarse roles propios si se permite: no escala privilegios, y el candado de
 * "no puede quedar el sistema sin Propietario activo" ya cubre el encerrarse
 * fuera. Lo que no puede pasar es que quien tiene `usuarios.editar` se ascienda
 * editando su propia ficha.
 */
export function puedeCambiarSusPropiosRoles(
  actorId: number,
  usuarioEditado: number,
  rolesAntes: number[],
  rolesDespues: number[],
): Veredicto {
  if (actorId !== usuarioEditado) return OK;

  const { agregados } = diferenciaDeRoles(rolesAntes, rolesDespues);
  if (agregados.length > 0) {
    return {
      ok: false,
      motivo: 'No puedes concederte roles a ti mismo. Pideselo a otro Propietario.',
    };
  }
  return OK;
}

/** Los dos veredictos juntos, en el orden en que importan. */
export function revisarCambioDeRoles(params: {
  actorId: number;
  rolesDelActor: number[];
  usuarioEditado: number;
  rolesAntes: number[];
  rolesDespues: number[];
}): Veredicto {
  const propios = puedeCambiarSusPropiosRoles(
    params.actorId,
    params.usuarioEditado,
    params.rolesAntes,
    params.rolesDespues,
  );
  if (!propios.ok) return propios;

  return puedeRepartirEsosRoles(params.rolesDelActor, params.rolesAntes, params.rolesDespues);
}

export { ROL, ROLES_GLOBALES };
