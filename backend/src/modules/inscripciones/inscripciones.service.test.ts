import { describe, expect, it } from 'vitest';

process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.FRONTEND_ORIGIN ??= 'https://dev-pvcar.vercel.app';

const { bloqueosDeAprobacion, correoDeAprobacion, firmaDeImagenValida, problemasDeDisciplinas } =
  await import('./inscripciones.service.js');
const { rellenar } = await import('./inscripciones.contrato.js');
const { envioSchema } = await import('./inscripciones.schemas.js');
const { calcularCobro } = await import('./inscripciones.precios.js');

/**
 * Reglas de Inscripciones que no necesitan base: que disciplinas se aceptan,
 * cuando no se puede aprobar, que el comprobante sea una imagen de verdad y
 * que el correo de aprobacion no lleve la contrasena.
 */

const disciplina = (id: number, col: number, est = 1) => ({
  colacthor_id: id,
  col_id: col,
  est_id: est,
  col_nombre: 'Colegio',
  actividad: 'Futbol',
  categoria: null,
  dia: 'Lunes',
  dia_id: 1,
  hora_inicio: '16:00',
  hora_fin: '17:00',
});

describe('problemasDeDisciplinas', () => {
  const encontradas = new Map([
    [1, disciplina(1, 10)],
    [2, disciplina(2, 10, 2)],
    [3, disciplina(3, 20)],
  ]);

  it('acepta una disciplina activa del colegio del alumno', () => {
    expect(
      problemasDeDisciplinas([{ nombre: 'A', col_id: 10, disciplinas: [1] }], encontradas),
    ).toEqual([]);
  });

  it('rechaza la inexistente, la de baja y la de otro colegio', () => {
    const problemas = problemasDeDisciplinas(
      [{ nombre: 'A', col_id: 10, disciplinas: [99, 2, 3] }],
      encontradas,
    );
    expect(problemas).toHaveLength(3);
  });
});

describe('bloqueosDeAprobacion', () => {
  const usuario = {
    usu_id: 5,
    usu_nombre: 'Ana',
    usu_correo: 'ana@x.co',
    usu_cedula: '1712345678',
    est_id: 1,
    es_representante: true,
    por_correo: true,
    por_cedula: true,
  };

  it('sin coincidencias se puede aprobar', () => {
    expect(bloqueosDeAprobacion([], [])).toEqual([]);
  });

  it('el mismo usuario activo (correo y cedula) no bloquea: se reutiliza', () => {
    expect(bloqueosDeAprobacion([usuario], [])).toEqual([]);
  });

  it('bloquea si el usuario del correo esta de baja', () => {
    expect(bloqueosDeAprobacion([{ ...usuario, est_id: 2 }], [])).toHaveLength(1);
  });

  it('bloquea si la cedula es de otra persona', () => {
    const otro = { ...usuario, usu_id: 9, por_correo: false, por_cedula: true };
    expect(bloqueosDeAprobacion([otro], [])).toHaveLength(1);
  });

  it('suma los problemas de disciplinas', () => {
    expect(bloqueosDeAprobacion([], ['x'])).toEqual(['x']);
  });
});

describe('firmaDeImagenValida', () => {
  it('reconoce jpeg, png y webp por sus primeros bytes', () => {
    expect(firmaDeImagenValida(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), 'image/jpeg')).toBe(true);
    expect(
      firmaDeImagenValida(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
        'image/png',
      ),
    ).toBe(true);
    expect(firmaDeImagenValida(Buffer.from('RIFF0000WEBPVP8 '), 'image/webp')).toBe(true);
  });

  it('rechaza un PDF o un ejecutable con tipo de imagen', () => {
    expect(firmaDeImagenValida(Buffer.from('%PDF-1.7'), 'image/jpeg')).toBe(false);
    expect(firmaDeImagenValida(Buffer.from([0x4d, 0x5a, 0x90, 0x00]), 'image/png')).toBe(false);
  });
});

describe('correoDeAprobacion', () => {
  it('no escribe la cedula: dice que la contrasena es la cedula', () => {
    const correo = correoDeAprobacion('Ana <b>', 'ana@x.co', true);
    expect(correo.texto).toContain('número de cédula');
    expect(correo.html).not.toContain('<b>');
    expect(correo.html).toContain('Ana &lt;b&gt;');
  });

  it('a un usuario existente no le habla de la cedula', () => {
    expect(correoDeAprobacion('Ana', 'ana@x.co', false).texto).not.toContain('cédula');
  });
});

describe('rellenar', () => {
  it('sustituye los marcadores y deja a la vista uno desconocido', () => {
    const valores = {
      representante_nombre: 'Ana',
      representante_cedula: '1',
      alumno_nombre: 'Leo',
      alumno_fecha_nacimiento: '1 de enero de 2016',
      colegio: 'C',
      disciplinas: 'D',
      fecha: 'hoy',
    };
    expect(
      rellenar(
        '{{ representante_nombre }} y {{alumno_nombre}} {{otro}}',
        valores as Parameters<typeof rellenar>[1],
      ),
    ).toBe(
      'Ana y Leo {{otro}}',
    );
  });
});

describe('envioSchema', () => {
  const valido = {
    representante: {
      nombre: 'Ana Pérez',
      cedula: '1712345678',
      correo: ' Ana@X.co ',
      telefono: '0991234567',
    },
    ninos: [
      {
        nombre: 'Leo Pérez',
        fecha_nacimiento: '2016-05-01',
        col_id: 1,
        catninograd_id: null,
        parentesco: 'Madre',
        toma_transporte: false,
        disciplinas: [1],
      },
    ],
    documentos: { contrato: 1, terminos: 2, privacidad: 3 },
    acepta: { contrato: true, terminos: true, privacidad: true },
    comprobante: { mime: 'image/jpeg', base64: 'A'.repeat(200) },
  };

  it('normaliza el correo y acepta un envio completo', () => {
    const r = envioSchema.parse(valido);
    expect(r.representante.correo).toBe('ana@x.co');
  });

  it('exige las tres casillas', () => {
    expect(() =>
      envioSchema.parse({ ...valido, acepta: { ...valido.acepta, privacidad: false } }),
    ).toThrow();
  });

  it('rechaza una cedula de menos de 6 caracteres (es la contrasena)', () => {
    expect(() =>
      envioSchema.parse({ ...valido, representante: { ...valido.representante, cedula: '123' } }),
    ).toThrow();
  });

  it('rechaza una fecha de nacimiento de un adulto', () => {
    const nino = { ...valido.ninos[0]!, fecha_nacimiento: '1990-01-01' };
    expect(() => envioSchema.parse({ ...valido, ninos: [nino] })).toThrow();
  });
});

describe('calcularCobro', () => {
  const precios = new Map([
    [1, { precio: 28.3, descuentoHermano: 10, descuentoSoloPrimera: false }],
    [2, { precio: 40, descuentoHermano: 50, descuentoSoloPrimera: true }],
  ]);

  it('un alumno solo paga completo, sin coma flotante', () => {
    const c = calcularCobro([{ colId: 1, disciplinas: 3 }], precios);
    expect(c.total).toBe(84.9);
    expect(c.alumnos[0]!.paga_completo).toBe(true);
    expect(c.alumnos[0]!.descuento).toBe(0);
  });

  it('el hermano con menos importe lleva el descuento en todas sus disciplinas', () => {
    const c = calcularCobro(
      [
        { colId: 1, disciplinas: 1 },
        { colId: 1, disciplinas: 2 },
      ],
      precios,
    );
    // Paga completo el segundo (56,60); el primero 28,30 - 10 % = 25,47.
    expect(c.alumnos[1]!.paga_completo).toBe(true);
    expect(c.alumnos[0]!.descuento).toBe(2.83);
    expect(c.alumnos[0]!.total).toBe(25.47);
    expect(c.total).toBe(82.07);
  });

  it('con "solo la primera", el descuento cubre una sola disciplina del hermano', () => {
    const c = calcularCobro(
      [
        { colId: 2, disciplinas: 3 },
        { colId: 2, disciplinas: 3 },
      ],
      precios,
    );
    // Empate: paga completo el primero. El segundo: 120 - 50 % de 40.
    expect(c.alumnos[0]!.paga_completo).toBe(true);
    expect(c.alumnos[1]!.total).toBe(100);
    expect(c.total).toBe(220);
  });

  it('sin precio configurado no calcula', () => {
    expect(() => calcularCobro([{ colId: 9, disciplinas: 1 }], precios)).toThrow();
  });
});
