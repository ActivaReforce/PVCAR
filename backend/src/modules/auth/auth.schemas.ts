import { z } from 'zod';

/**
 * Minimo de 6 caracteres: es el minimo que impone Supabase Auth y el que ya
 * pide el frontend viejo. Ver Anexo A del Plan — 4 usuarios activos tienen
 * hoy contrasenas de 5, y se corrigen en el sistema viejo antes del cutover.
 */
const password = z.string().min(6, 'La contrasena debe tener al menos 6 caracteres');

/** El correo se normaliza aqui: Supabase Auth lo guarda en minusculas. */
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Correo con formato invalido');

export const loginSchema = z.object({
  email,
  // En el login no se valida longitud: si la contrasena es corta simplemente
  // no coincide, y decir "muy corta" filtraria informacion de la cuenta.
  password: z.string().min(1, 'La contrasena es obligatoria'),
});

export const forgotPasswordSchema = z.object({ email });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'La contrasena actual es obligatoria'),
    newPassword: password,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'La nueva contrasena debe ser distinta de la actual',
    path: ['newPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
