import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ROL } from '../lib/constants.js';
import { requirePersonal } from './requirePersonal.js';

/**
 * Un padre no administra lo que no filtra por alcance (Encuestas), aunque en
 * Permisos se le marque "ver". El personal sí, con cualquier rol.
 */
const conRoles = (roles: number[]) =>
  ({ user: { usuario: { roles: roles.map((rol_id) => ({ rol_id })) } } }) as unknown as Request;

const pasar = (req: Request) => {
  const next = vi.fn() as unknown as NextFunction & ReturnType<typeof vi.fn>;
  requirePersonal(req, {} as Response, next);
  return next.mock.calls[0]?.[0];
};

describe('requirePersonal', () => {
  it('deja pasar a cualquier rol del personal', () => {
    for (const rol of [ROL.PROPIETARIO, ROL.COORDINADOR, ROL.ENTRENADOR, ROL.ADMIN, ROL.ASISTENTE]) {
      expect(pasar(conRoles([rol]))).toBeUndefined();
    }
  });

  it('deja pasar a quien es representante y además personal', () => {
    expect(pasar(conRoles([ROL.REPRESENTANTE, ROL.ENTRENADOR]))).toBeUndefined();
  });

  it('frena al que solo es representante', () => {
    expect(pasar(conRoles([ROL.REPRESENTANTE]))).toMatchObject({ statusCode: 403 });
  });

  it('frena a quien no tiene roles', () => {
    expect(pasar(conRoles([]))).toMatchObject({ statusCode: 403 });
  });
});
