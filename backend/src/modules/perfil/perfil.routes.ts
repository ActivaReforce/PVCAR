import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { borrarFoto, firmarFoto, firmarSubidaFoto } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import { auditar } from '../../lib/auditoria.js';
import { titularesDe } from '../../lib/alcance.js';
import * as usuariosRepo from '../usuarios/usuarios.repository.js';
import { hijosDe } from '../inscripciones/inscripciones.repository.js';
import { horarioLargo } from '../../lib/horarios.js';
import * as repo from './perfil.repository.js';

/**
 * Perfil propio.
 *
 * Separado de /usuarios a proposito: aqui el sujeto es siempre el del token,
 * nunca un id de la URL. Asi no hay forma de editar a otro por esta puerta,
 * que es la que tiene el permiso mas repartido (los 7 roles tienen perfil.ver).
 *
 * Aqui se editan el nombre, el telefono y la foto (el nombre, desde el
 * 2026-10-07, a peticion del cliente). El correo y la cedula NO: el correo es
 * el acceso y la cedula la identidad (y la contrasena inicial de los
 * representantes); los cambia la administracion por /usuarios. La contrasena
 * vive en /auth/change-password, que exige la actual.
 */
export const perfilRouter = Router();

perfilRouter.use(requireAuth);

const actualizarPerfilSchema = z
  .object({
    usu_nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(160).optional(),
    usu_telefono: z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9+()\s-]*$/, 'El telefono solo admite numeros y los signos + ( ) -')
      .optional(),
    usu_foto: z
      .string()
      .trim()
      .regex(/^usuarios\/[A-Za-z0-9._-]{1,120}$/, 'Ruta de foto invalida')
      .nullable()
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'No hay nada que actualizar');

const fotoSchema = z.object({
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, 'No autenticado');
  return req.user;
}

/** GET /api/v1/perfil — ficha propia con la foto ya firmada. */
perfilRouter.get(
  '/',
  requirePermission('perfil', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const yo = actor(req).usuario.usu_id;
      const detalle = await usuariosRepo.obtenerUsuario(yo);
      if (!detalle) throw new ApiError(404, 'Usuario no encontrado');
      res.json({
        data: { ...detalle, usu_foto_url: await firmarFoto(detalle.usu_foto) },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

perfilRouter.patch(
  '/',
  requirePermission('perfil', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quien = actor(req);
      const yo = quien.usuario.usu_id;
      const input = actualizarPerfilSchema.parse(req.body);

      const antes = await usuariosRepo.obtenerUsuario(yo);
      if (!antes) throw new ApiError(404, 'Usuario no encontrado');

      await enTransaccion(async (client) => {
        await usuariosRepo.actualizarUsuario(client, yo, {
          nombre: input.usu_nombre,
          telefono: input.usu_telefono?.trim() || null,
          tocarTelefono: input.usu_telefono !== undefined,
          foto: input.usu_foto ?? null,
          tocarFoto: input.usu_foto !== undefined,
          tocarCedula: false,
        });
        await auditar(
          {
            actor: quien,
            accion: 'editar',
            entidad: 'usuario',
            entidadId: yo,
            detalle: { origen: 'perfil', campos: Object.keys(input) },
          },
          client,
        );
      });

      if (input.usu_foto !== undefined && input.usu_foto !== antes.usu_foto) {
        await borrarFoto(antes.usu_foto);
      }

      const despues = await usuariosRepo.obtenerUsuario(yo);
      res.json({
        data: { ...despues!, usu_foto_url: await firmarFoto(despues!.usu_foto) },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/v1/perfil/resumen — lo que tiene a cargo: colegios que coordina,
 * disciplinas que da, entrenadores a los que respalda y sus hijos. Cada lista
 * sale vacía si no le toca por sus roles.
 */
perfilRouter.get(
  '/resumen',
  requirePermission('perfil', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const quien = actor(req);
      const yo = quien.usuario.usu_id;
      const [colegios, disciplinas, titulares, hijos] = await Promise.all([
        repo.colegiosQueCoordina(yo),
        repo.disciplinasQueDa(yo),
        titularesDe(quien.usuario),
        hijosDe(yo),
      ]);
      res.json({
        data: {
          colegios,
          disciplinas,
          titulares,
          hijos: hijos.map((h) => ({
            nino_id: h.nino_id,
            nombre: h.nombre,
            col_nombre: h.col_nombre,
            disciplinas: h.activas.map((a) => ({ actividad: a.actividad, horario: horarioLargo(a.horarios) })),
          })),
        },
        error: null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/v1/perfil/foto — URL de subida firmada.
 *
 * El navegador sube el archivo directo a Storage con esa URL y despues manda
 * la ruta devuelta en PATCH /perfil. El bucket sigue privado y el front nunca
 * ve una key. El limite de 500 KB y los tipos permitidos los impone el propio
 * bucket (migracion 0003).
 */
perfilRouter.post(
  '/foto',
  requirePermission('perfil', 'ver'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      actor(req);
      const { mimeType } = fotoSchema.parse(req.body);
      res.json({ data: await firmarSubidaFoto(mimeType), error: null });
    } catch (err) {
      next(err);
    }
  },
);
