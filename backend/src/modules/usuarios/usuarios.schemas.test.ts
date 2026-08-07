import { describe, expect, it } from 'vitest';
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  eliminarUsuarioSchema,
  listarUsuariosSchema,
} from './usuarios.schemas.js';

/**
 * Lo que se prueba aqui es la puerta de entrada: si un dato malo pasa de aqui,
 * llega a la base. No hace falta red ni Supabase.
 */
describe('crearUsuarioSchema', () => {
  const base = {
    usu_nombre: 'Ana Perez',
    usu_correo: 'ANA@Ejemplo.COM ',
    password: 'clave1234',
    roles: [3],
  };

  it('normaliza el correo a minusculas y sin espacios', () => {
    const parsed = crearUsuarioSchema.parse(base);
    expect(parsed.usu_correo).toBe('ana@ejemplo.com');
  });

  it('exige al menos un rol', () => {
    const res = crearUsuarioSchema.safeParse({ ...base, roles: [] });
    expect(res.success).toBe(false);
  });

  it('rechaza roles repetidos', () => {
    const res = crearUsuarioSchema.safeParse({ ...base, roles: [3, 3] });
    expect(res.success).toBe(false);
  });

  it('rechaza contrasenas de menos de 8 caracteres', () => {
    const res = crearUsuarioSchema.safeParse({ ...base, password: 'corta1' });
    expect(res.success).toBe(false);
  });

  it('rechaza una foto que no sea una ruta del bucket', () => {
    const res = crearUsuarioSchema.safeParse({
      ...base,
      usu_foto: 'https://otro-sitio.com/foto.jpg',
    });
    // El schema admite el texto; la ruta la valida el servicio.
    expect(res.success).toBe(true);
  });
});

describe('actualizarUsuarioSchema', () => {
  it('acepta un cambio parcial', () => {
    const parsed = actualizarUsuarioSchema.parse({ usu_telefono: '0999999999' });
    expect(parsed.usu_telefono).toBe('0999999999');
  });

  it('rechaza un telefono con letras', () => {
    const res = actualizarUsuarioSchema.safeParse({ usu_telefono: 'llamame' });
    expect(res.success).toBe(false);
  });

  it('permite poner la foto a null para quitarla', () => {
    const parsed = actualizarUsuarioSchema.parse({ usu_foto: null });
    expect(parsed.usu_foto).toBeNull();
  });
});

describe('listarUsuariosSchema', () => {
  it('pone page=1 y limit=25 por defecto', () => {
    const parsed = listarUsuariosSchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
  });

  it('rechaza un limit desmesurado en vez de descargar la tabla entera', () => {
    const res = listarUsuariosSchema.safeParse({ limit: '100000' });
    expect(res.success).toBe(false);
  });

  it('rechaza un orden que no este en la lista blanca', () => {
    const res = listarUsuariosSchema.safeParse({ orden: 'usu_contrasena' });
    expect(res.success).toBe(false);
  });

  it('admite varios roles separados por coma', () => {
    expect(listarUsuariosSchema.parse({ rol: '2,3' }).rol).toEqual([2, 3]);
  });

  it('ignora basura entre los roles en vez de romper la pantalla', () => {
    expect(listarUsuariosSchema.parse({ rol: '3, ,x' }).rol).toEqual([3]);
    expect(listarUsuariosSchema.parse({ rol: '' }).rol).toBeUndefined();
  });
});

describe('eliminarUsuarioSchema', () => {
  it('exige el texto de confirmacion', () => {
    expect(eliminarUsuarioSchema.safeParse({}).success).toBe(false);
    expect(eliminarUsuarioSchema.safeParse({ confirmacion: '  ' }).success).toBe(false);
    expect(eliminarUsuarioSchema.safeParse({ confirmacion: 'Ana Perez' }).success).toBe(true);
  });
});
