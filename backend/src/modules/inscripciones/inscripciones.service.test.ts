import { describe, expect, it } from 'vitest';

process.env.SUPABASE_URL ??= 'https://test.supabase.co';
process.env.FRONTEND_ORIGIN ??= 'https://dev-pvcar.vercel.app';

const {
  bloqueosDeAprobacion,
  calcularEstado,
  correoDeAprobacion,
  firmaDeImagenValida,
  problemasDeDisciplinas,
} = await import('./inscripciones.service.js');
const { rellenar } = await import('./inscripciones.documentos.js');
const { envioSchema, problemasDeEnvio } = await import('./inscripciones.schemas.js');
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
    const valores = { representante_nombre: 'Ana', alumno_nombre: 'Leo', fecha: 'hoy' };
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
  const persona = { nombre: 'Jorge Andrade', relacion: 'Abuelo', telefono: '0987654321' };
  const valido = {
    representante: {
      nombre: 'Ana Pérez',
      cedula: '1712345678',
      correo: ' Ana@X.co ',
      telefono: '0991234567',
      factura: {
        nombre: 'Ana Pérez',
        identificacion: '1712345678001',
        correo: 'f@x.co',
        direccion: 'Av. Siempre Viva 123',
      },
    },
    ninos: [
      {
        nombre: 'Leo Pérez',
        fecha_nacimiento: '2016-05-01',
        col_id: 1,
        catninograd_id: 3,
        parentesco: 'Madre',
        disciplinas: [1],
        emergencia: persona,
        retiro: { ...persona, cedula: '1700000000' },
        modalidad_salida: 'escolar',
        salud: { tiene: false, autoriza: true },
        imagen: { familias: true, redes: false, promocional: false },
      },
    ],
    documentos: {
      ficha_matricula: 1,
      contrato: 2,
      autorizacion_datos: 3,
      datos_medicos: 4,
      imagen: 5,
      politica: 6,
    },
    acepta: {
      ficha_matricula: true,
      contrato: true,
      autorizacion_datos: true,
      datos_medicos: true,
      imagen: true,
      politica: true,
    },
    comprobante: { mime: 'image/jpeg', base64: 'A'.repeat(200) },
  };

  it('normaliza el correo y acepta un envio completo', () => {
    const r = envioSchema.parse(valido);
    expect(r.representante.correo).toBe('ana@x.co');
  });

  it('exige aceptar los seis documentos', () => {
    expect(() =>
      envioSchema.parse({ ...valido, acepta: { ...valido.acepta, politica: false } }),
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

  it('si hay condicion de salud, exige especificarla', () => {
    const nino = { ...valido.ninos[0]!, salud: { tiene: true, autoriza: true } };
    expect(() => envioSchema.parse({ ...valido, ninos: [nino] })).toThrow();
  });

  it('la autorizacion de salud es obligatoria, conteste si o no', () => {
    const nino = { ...valido.ninos[0]!, salud: { tiene: false, autoriza: false } };
    expect(() => envioSchema.parse({ ...valido, ninos: [nino] })).toThrow();
  });

  it('si contesta No, no guarda lo escrito en especifique', () => {
    const nino = { ...valido.ninos[0]!, salud: { tiene: false, detalle: 'Asma', autoriza: true } };
    expect(envioSchema.parse({ ...valido, ninos: [nino] }).ninos[0]!.salud.detalle).toBeNull();
  });

  it('la persona que retira no es obligatoria', () => {
    const sinRetiro = { ...valido.ninos[0]!, retiro: null };
    expect(envioSchema.parse({ ...valido, ninos: [sinRetiro] }).ninos[0]!.retiro).toBeNull();
  });

  it('acepta null en los campos opcionales (detalle de retiro, especifique)', () => {
    const nino = {
      ...valido.ninos[0]!,
      detalle_retiro: null,
      salud: { tiene: false, detalle: null, autoriza: true },
    };
    expect(() => envioSchema.parse({ ...valido, ninos: [nino] })).not.toThrow();
  });

  it('dice en castellano que falta y donde', () => {
    const nino = { ...valido.ninos[0]!, salud: { tiene: false, autoriza: false } };
    const r = envioSchema.safeParse({
      ...valido,
      representante: { ...valido.representante, telefono: 'abc' },
      ninos: [nino],
    });
    expect(r.success).toBe(false);
    const problemas = problemasDeEnvio(r.error!);
    expect(problemas).toContain('Tus datos: El teléfono solo lleva números (entre 7 y 15)');
    expect(problemas.some((p) => p.startsWith('Alumno 1 · Información de salud:'))).toBe(true);
  });

  it('cedula de 10 numeros, telefono solo numeros', () => {
    const conRep = (r: object) => ({ ...valido, representante: { ...valido.representante, ...r } });
    expect(() => envioSchema.parse(conRep({ cedula: '171234567' }))).toThrow();
    expect(() => envioSchema.parse(conRep({ cedula: '17123456AB' }))).toThrow();
    expect(() => envioSchema.parse(conRep({ telefono: '099-123-4567' }))).toThrow();
  });

  it('con autorizacion guarda el detalle', () => {
    const nino = { ...valido.ninos[0]!, salud: { tiene: true, detalle: 'Asma', autoriza: true } };
    expect(envioSchema.parse({ ...valido, ninos: [nino] }).ninos[0]!.salud.detalle).toBe('Asma');
  });
});

describe('calcularCobro', () => {
  const precios = new Map([
    [1, { precio: 28.3, descuentoHermano: 10 }],
    [2, { precio: 40, descuentoHermano: 50 }],
  ]);

  it('un alumno solo paga completo, sin coma flotante', () => {
    const c = calcularCobro([{ colId: 1, disciplinas: 3 }], precios, 0);
    expect(c.total).toBe(84.9);
    expect(c.alumnos[0]!.paga_completo).toBe(true);
    expect(c.alumnos[0]!.descuento).toBe(0);
  });

  it('lidera el que mas disciplinas tiene, aunque vaya segundo', () => {
    const c = calcularCobro(
      [
        { colId: 1, disciplinas: 1 },
        { colId: 1, disciplinas: 2 },
      ],
      precios,
      0,
    );
    expect(c.alumnos[1]!.paga_completo).toBe(true);
    // El hermano: 1 disciplina, 1 con descuento. 28,30 - 10 % = 25,47.
    expect(c.alumnos[0]!.disciplinas_con_descuento).toBe(1);
    expect(c.alumnos[0]!.total).toBe(25.47);
    expect(c.total).toBe(82.07);
  });

  it('lidera el de mas disciplinas aunque su colegio sea mas barato', () => {
    const c = calcularCobro(
      [
        { colId: 2, disciplinas: 2 }, // 80,00
        { colId: 1, disciplinas: 3 }, // 84,90
      ],
      precios,
      0,
    );
    expect(c.alumnos[1]!.paga_completo).toBe(true);
    // El hermano: sus 2 disciplinas con 50 %.
    expect(c.alumnos[0]!.disciplinas_con_descuento).toBe(2);
    expect(c.alumnos[0]!.total).toBe(40);
  });

  it('en empate de disciplinas lidera el de importe mas alto', () => {
    const c = calcularCobro(
      [
        { colId: 1, disciplinas: 2 }, // 56,60
        { colId: 2, disciplinas: 2 }, // 80,00
      ],
      precios,
      0,
    );
    expect(c.alumnos[1]!.paga_completo).toBe(true);
    expect(c.alumnos[0]!.descuento).toBe(5.66);
  });

  it('cada hermano tiene descuento en tantas disciplinas como el que lidera', () => {
    const c = calcularCobro(
      [
        { colId: 2, disciplinas: 3 },
        { colId: 2, disciplinas: 1 },
        { colId: 2, disciplinas: 3 },
      ],
      precios,
      0,
    );
    expect(c.alumnos[0]!.paga_completo).toBe(true);
    expect(c.alumnos[1]!.disciplinas_con_descuento).toBe(1);
    expect(c.alumnos[2]!.disciplinas_con_descuento).toBe(3);
    expect(c.total).toBe(120 + 20 + 60);
  });

  it('sin precio configurado no calcula', () => {
    expect(() => calcularCobro([{ colId: 9, disciplinas: 1 }], precios, 0)).toThrow();
  });

  it('suma el IVA sobre lo que paga cada alumno, ya con descuento', () => {
    const c = calcularCobro(
      [
        { colId: 2, disciplinas: 1 }, // 40,00 lidera
        { colId: 2, disciplinas: 1 }, // 40,00 - 50 % = 20,00
      ],
      precios,
      15,
    );
    expect(c.alumnos[0]!.iva).toBe(6);
    expect(c.alumnos[1]!.total_con_iva).toBe(23);
    expect(c.subtotal).toBe(60);
    expect(c.iva).toBe(9);
    expect(c.total).toBe(69);
  });
});

describe('calcularEstado', () => {
  type Tipo = Parameters<typeof calcularEstado>[0] extends Set<infer T> ? T : never;
  const todos = new Set<Tipo>([
    'ficha_matricula',
    'contrato',
    'autorizacion_datos',
    'datos_medicos',
    'imagen',
    'politica',
  ]);
  const listo = { col_id: 1, col_nombre: 'A', precio: 30, abierta: true, disciplinas_activas: 2 };

  it('abiertas con todo publicado, interruptor encendido y un colegio listo', () => {
    const e = calcularEstado(todos, true, [listo, { ...listo, col_id: 2, abierta: false }]);
    expect(e.abiertas).toBe(true);
    expect(e.colegios.map((c) => c.abierto)).toEqual([true, false]);
  });

  it('cerradas a mano aunque todo este listo', () => {
    const e = calcularEstado(todos, false, [listo]);
    expect(e.abiertas).toBe(false);
    expect(e.motivos).toEqual(['Están cerradas a mano.']);
  });

  it('sin la politica publicada no se abren', () => {
    const sinPolitica = new Set([...todos].filter((t) => t !== 'politica'));
    const e = calcularEstado(sinPolitica, true, [listo]);
    expect(e.abiertas).toBe(false);
    expect(e.motivos[0]).toContain('Política');
  });

  it('un colegio sin contrato publicado, sin valores ni disciplinas dice por que', () => {
    const sinContrato = new Set([...todos].filter((t) => t !== 'contrato'));
    const e = calcularEstado(sinContrato, true, [
      { col_id: 1, col_nombre: 'A', precio: null, abierta: null, disciplinas_activas: 0 },
    ]);
    expect(e.colegios[0]!.motivos).toHaveLength(4);
    expect(e.motivos).toContain('Ningún colegio tiene las inscripciones abiertas.');
  });
});
