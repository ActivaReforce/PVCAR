import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/requirePermission.js';
import { ApiError } from '../../middleware/error.js';
import { borrarFoto, firmarFoto, firmarSubidaFoto } from '../../lib/storage.js';
import { enTransaccion } from '../../lib/tx.js';
import { auditar } from '../../lib/auditoria.js';
import * as usuariosRepo from '../usuarios/usuarios.repository.js';

/**
 * Perfil propio.
 *
 * Separado de /usuarios a proposito: aqui el sujeto es siempre el del token,
 * nunca un id de la URL. Asi no hay forma de editar a otro por esta puerta,
 * que es la que tiene el permiso mas repartido (los 7 roles tienen perfil.ver).
 *
 * El nombre y el correo NO se editan aqui: son datos administrativos y
 * cambiarlos afecta al acceso. Van por /usuarios, con permiso usuarios.editar.
 * La contrasena vive en /auth/change-password, que exige la actual.
 */
export const perfilRouter = Router();

perfilRouter.use(requireAuth);

const actualizarPerfilSchema = z
  .object({
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
          telefono: input.usu_telefono?.trim() || null,
          tocarTelefono: input.usu_telefono !== undefined,
          foto: input.usu_foto ?? null,
          tocarFoto: input.usu_foto !== undefined,
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
