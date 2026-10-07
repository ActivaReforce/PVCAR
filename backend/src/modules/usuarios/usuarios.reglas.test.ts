import { describe, expect, it } from 'vitest';
import { ROL } from '../../lib/constants.js';
import {
  diferenciaDeRoles,
  esGlobal,
  puedeCambiarSusPropiosRoles,
  puedeRepartirEsosRoles,
  revisarCambioDeRoles,
} from './usuarios.reglas.js';

describe('esGlobal', () => {
  it('reconoce al Propietario y al Admin Activa Reforce', () => {
    expect(esGlobal([ROL.PROPIETARIO])).toBe(true);
    expect(esGlobal([ROL.ADMIN])).toBe(true);
    expect(esGlobal([ROL.ENTRENADOR, ROL.ADMIN])).toBe(true);
  });

  it('no cuela a un coordinador ni a un entrenador', () => {
    expect(esGlobal([ROL.COORDINADOR])).toBe(false);
    expect(esGlobal([ROL.COORDINADOR, ROL.ENTRENADOR])).toBe(false);
    expect(esGlobal([])).toBe(false);
  });
});

describe('diferenciaDeRoles', () => {
  it('separa lo agregado de lo quitado', () => {
    expect(diferenciaDeRoles([2, 3], [3, 6])).toEqual({ agregados: [6], quitados: [2] });
  });

  it('no ve cambios donde no los hay, aunque cambie el orden', () => {
    expect(diferenciaDeRoles([3, 2], [2, 3])).toEqual({ agregados: [], quitados: [] });
  });
});

describe('puedeRepartirEsosRoles', () => {
  it('un Propietario reparte cualquier rol', () => {
    expect(puedeRepartirEsosRoles([ROL.PROPIETARIO], [], [ROL.PROPIETARIO]).ok).toBe(true);
    expect(puedeRepartirEsosRoles([ROL.PROPIETARIO], [ROL.ADMIN], []).ok).toBe(true);
  });

  it('un coordinador reparte roles normales', () => {
    expect(puedeRepartirEsosRoles([ROL.COORDINADOR], [], [ROL.ENTRENADOR]).ok).toBe(true);
    expect(
      puedeRepartirEsosRoles([ROL.COORDINADOR], [ROL.ENTRENADOR], [ROL.ASISTENTE]).ok,
    ).toBe(true);
  });

  it('un coordinador NO puede nombrar Propietario ni Admin', () => {
    expect(puedeRepartirEsosRoles([ROL.COORDINADOR], [], [ROL.PROPIETARIO]).ok).toBe(false);
    expect(puedeRepartirEsosRoles([ROL.COORDINADOR], [], [ROL.ADMIN]).ok).toBe(false);
  });

  it('un coordinador tampoco puede degradar a un Propietario', () => {
    const veredicto = puedeRepartirEsosRoles(
      [ROL.COORDINADOR],
      [ROL.PROPIETARIO, ROL.ENTRENADOR],
      [ROL.ENTRENADOR],
    );
    expect(veredicto.ok).toBe(false);
    expect(veredicto.motivo).toMatch(/Propietario/);
  });
});

describe('puedeCambiarSusPropiosRoles', () => {
  it('no deja que alguien se conceda un rol nuevo', () => {
    expect(puedeCambiarSusPropiosRoles(7, 7, [ROL.COORDINADOR], [ROL.COORDINADOR, ROL.PROPIETARIO]).ok).toBe(
      false,
    );
  });

  it('deja quitarse roles propios', () => {
    expect(
      puedeCambiarSusPropiosRoles(7, 7, [ROL.COORDINADOR, ROL.ENTRENADOR], [ROL.COORDINADOR]).ok,
    ).toBe(true);
  });

  it('no estorba cuando se edita a otro', () => {
    expect(puedeCambiarSusPropiosRoles(7, 9, [], [ROL.PROPIETARIO]).ok).toBe(true);
  });
});

describe('revisarCambioDeRoles', () => {
  it('el caso que motiva todo esto: coordinador con usuarios.editar ascendiendose', () => {
    const veredicto = revisarCambioDeRoles({
      actorId: 58,
      rolesDelActor: [ROL.COORDINADOR],
      usuarioEditado: 58,
      rolesAntes: [ROL.COORDINADOR],
      rolesDespues: [ROL.COORDINADOR, ROL.PROPIETARIO],
    });
    expect(veredicto.ok).toBe(false);
  });

  it('el Propietario editando a un tercero pasa', () => {
    const veredicto = revisarCambioDeRoles({
      actorId: 12,
      rolesDelActor: [ROL.PROPIETARIO],
      usuarioEditado: 60,
      rolesAntes: [ROL.ENTRENADOR],
      rolesDespues: [ROL.ENTRENADOR, ROL.COORDINADOR],
    });
    expect(veredicto.ok).toBe(true);
  });

  it('un alta hecha por un coordinador no puede nacer con rol global', () => {
    const veredicto = revisarCambioDeRoles({
      actorId: 58,
      rolesDelActor: [ROL.COORDINADOR],
      usuarioEditado: 0,
      rolesAntes: [],
      rolesDespues: [ROL.ADMIN],
    });
    expect(veredicto.ok).toBe(false);
  });
});
