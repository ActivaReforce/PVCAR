import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASISTENCIA } from '../asistencias/asistencias.schemas.js';

/** Aviso automático de ausencia (punto 9), sin base de datos. */

const ultimoAvisoDeClase = vi.fn(async () => new Map<number, 'ausencia' | 'correccion'>());
const nombresDeAlumnos = vi.fn(async (_c: unknown, ids: number[]) => new Map(ids.map((id) => [id, `Alumno ${id}`])));
const insertarAviso = vi.fn(async (_c: unknown, _a: unknown) => 900 + insertarAviso.mock.calls.length);

vi.mock('./novedades.repository.js', () => ({ ultimoAvisoDeClase, nombresDeAlumnos, insertarAviso }));
vi.mock('../correos/correos.service.js', () => ({ configuracion: vi.fn(), enviarComo: vi.fn() }));
vi.mock('../../config/db.js', () => ({ getPool: () => ({ query: vi.fn() }) }));
vi.mock('../../config/env.js', () => ({ env: {} }));

const aus = await import('./novedades.ausencias.js');
const { hoyEc } = await import('../../lib/fecha.js');

/** Karate, martes y jueves. 2026-10-13 es martes. */
const CLASE = {
  colacthor_id: 135,
  col_nombre: 'Innova Los Chillos',
  act_nombre: 'Karate',
  horarios: [
    { dia_id: 2, dia_nombre: 'Martes', inicio: '15:00', fin: '16:00' },
    { dia_id: 4, dia_nombre: 'Jueves', inicio: '16:00', fin: '17:00' },
  ],
};

beforeEach(() => {
  ultimoAvisoDeClase.mockClear();
  nombresDeAlumnos.mockClear();
  insertarAviso.mockClear();
});

describe('qué aviso toca', () => {
  it('Ausente sin aviso previo, o tras una corrección → ausencia', () => {
    expect(aus.avisoQueToca(ASISTENCIA.AUSENTE, undefined)).toBe('ausencia');
    expect(aus.avisoQueToca(ASISTENCIA.AUSENTE, 'correccion')).toBe('ausencia');
  });

  it('Ausente con la ausencia ya avisada → nada (guardar dos veces no repite)', () => {
    expect(aus.avisoQueToca(ASISTENCIA.AUSENTE, 'ausencia')).toBeNull();
  });

  it('Presente, Tarde o Justificado tras una ausencia → corrección', () => {
    for (const e of [ASISTENCIA.PRESENTE, ASISTENCIA.TARDE, ASISTENCIA.JUSTIFICADO]) {
      expect(aus.avisoQueToca(e, 'ausencia')).toBe('correccion');
    }
  });

  it('Presente sin ausencia previa → nada', () => {
    expect(aus.avisoQueToca(ASISTENCIA.PRESENTE, undefined)).toBeNull();
    expect(aus.avisoQueToca(ASISTENCIA.TARDE, 'correccion')).toBeNull();
  });
});

describe('qué fechas avisan', () => {
  it('hoy y los 7 días anteriores; ni más atrás ni futuras', () => {
    const hoy = '2026-10-13';
    expect(aus.fechaAvisable('2026-10-13', hoy)).toBe(true);
    expect(aus.fechaAvisable('2026-10-06', hoy)).toBe(true);
    expect(aus.fechaAvisable('2026-10-05', hoy)).toBe(false);
    expect(aus.fechaAvisable('2026-10-14', hoy)).toBe(false);
  });

  it('cruza fin de mes', () => {
    expect(aus.fechaAvisable('2026-09-30', '2026-10-02')).toBe(true);
  });
});

describe('el texto', () => {
  const datos = (marca: { asisest_id: number; hora_tarde?: string; razon?: string }) =>
    aus.datosDe(CLASE, '2026-10-13', { nino_id: 1, ...marca });

  it('la ausencia dice clase, día, fecha y horario', () => {
    expect(aus.textoDe('ausencia', 'Martín', datos({ asisest_id: ASISTENCIA.AUSENTE }))).toBe(
      'Martín faltó a Karate en Innova Los Chillos el martes 13/10/2026 (15:00–16:00).',
    );
  });

  it('la corrección dice qué pasó', () => {
    expect(
      aus.textoDe('correccion', 'Martín', datos({ asisest_id: ASISTENCIA.TARDE, hora_tarde: '15:20' })),
    ).toContain('llegó tarde, a las 15:20');
    expect(
      aus.textoDe('correccion', 'Martín', datos({ asisest_id: ASISTENCIA.JUSTIFICADO, razon: 'Cita médica' })),
    ).toContain('quedó justificada: Cita médica');
    expect(aus.textoDe('correccion', 'Martín', datos({ asisest_id: ASISTENCIA.PRESENTE }))).toContain(
      'estuvo presente',
    );
  });

  it('la hora y el motivo solo se guardan con su estado', () => {
    const d = datos({ asisest_id: ASISTENCIA.PRESENTE, hora_tarde: '15:20', razon: 'x' });
    expect(d.hora_tarde).toBeNull();
    expect(d.razon).toBeNull();
  });
});

describe('registrar al guardar', () => {
  const client = {} as never;
  const hoy = hoyEc();

  it('una ausencia nueva y una corrección; el resto no avisa', async () => {
    ultimoAvisoDeClase.mockResolvedValueOnce(new Map([[2, 'ausencia' as const]]));
    const ids = await aus.registrarAvisos(client, {
      clase: CLASE,
      fecha: hoy,
      autorId: 76,
      marcas: [
        { nino_id: 1, asisest_id: ASISTENCIA.AUSENTE },
        { nino_id: 2, asisest_id: ASISTENCIA.TARDE, hora_tarde: '15:10' },
        { nino_id: 3, asisest_id: ASISTENCIA.PRESENTE },
      ],
    });
    expect(ids).toHaveLength(2);
    const tipos = insertarAviso.mock.calls.map((c) => (c[1] as { tipo: string; nino_id: number }));
    expect(tipos.map((t) => [t.nino_id, t.tipo])).toEqual([
      [1, 'ausencia'],
      [2, 'correccion'],
    ]);
    expect(nombresDeAlumnos).toHaveBeenCalledWith(client, [1, 2]);
  });

  it('una clase de hace un mes no avisa ni consulta nada', async () => {
    const ids = await aus.registrarAvisos(client, {
      clase: CLASE,
      fecha: '2020-01-07',
      autorId: 76,
      marcas: [{ nino_id: 1, asisest_id: ASISTENCIA.AUSENTE }],
    });
    expect(ids).toEqual([]);
    expect(ultimoAvisoDeClase).not.toHaveBeenCalled();
  });

  it('si nada toca, no busca nombres ni inserta', async () => {
    const ids = await aus.registrarAvisos(client, {
      clase: CLASE,
      fecha: hoy,
      autorId: 76,
      marcas: [{ nino_id: 1, asisest_id: ASISTENCIA.PRESENTE }],
    });
    expect(ids).toEqual([]);
    expect(nombresDeAlumnos).not.toHaveBeenCalled();
    expect(insertarAviso).not.toHaveBeenCalled();
  });
});

describe('el correo', () => {
  it('lleva alumno, clase y representante, escapado', () => {
    const datos = aus.datosDe(CLASE, '2026-10-13', { nino_id: 1, asisest_id: ASISTENCIA.AUSENTE });
    const c = aus.correoDe({
      nov_id: 1,
      nov_tipo: 'ausencia',
      nov_texto: aus.textoDe('ausencia', 'Martín <b>', datos),
      nov_fecha_creacion: '',
      autor: { usu_id: 76, usu_nombre: 'Erika', usu_correo: null },
      personas: [],
      alumnos: [
        {
          id: 1,
          nombre: 'Martín <b>',
          col_id: 14,
          col_nombre: 'Innova Los Chillos',
          grado: null,
          representantes: [{ nombre: 'Ana', correo: 'ana@x.com', telefono: '0999' }],
        },
      ],
      datos,
    });
    expect(c.asunto).toBe('Ausencia: Martín <b> — Karate, 13/10/2026');
    expect(c.html).toContain('Martín &lt;b&gt;');
    expect(c.html).not.toContain('Martín <b>');
    expect(c.texto).toContain('Representante: Ana · 0999 · ana@x.com');
    expect(c.texto).toContain('Registró: Erika');
  });
});
