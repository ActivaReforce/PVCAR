import { describe, expect, it, vi } from 'vitest';

/*
 * Excel de facturación de Mensualidades (2026-11-18): una fila por pago, lo
 * pagado con la inscripción en amarillo y sumando, lo no pagado en rojo, y lo
 * que se debe agrupado por representante y mes.
 */

vi.mock('../../config/env.js', () => ({ env: {}, frontendBaseUrl: 'https://activareforce.com', allowedOrigins: [] }));
vi.mock('../../config/supabase.js', () => ({ getSupabaseAdmin: () => ({}), getSupabaseAnon: () => ({}) }));

const base = {
  usu_id: 7,
  representante: 'Ana Pérez',
  cedula: '1700000000',
  correo: 'ana@x.co',
  telefono: '0999999999',
  colegios: ['CRISFE'],
  subtotal: 32.1,
  descuento: 0,
  iva: 4.82,
  total: 36.92,
  factura_nombre: 'Ana Pérez',
  factura_identificacion: '1700000000',
  factura_correo: 'ana@x.co',
  factura_direccion: 'Quito',
};

const pagos = [
  { ...base, tipo: 'inscripcion', aprobado: true, fecha_pago: '2026-11-10', mes_pago: '2026-11-01', meses: ['2026-11-01'], hijos: ['Leo'], disciplinas: ['Fútbol'] },
  { ...base, tipo: 'mensualidad', aprobado: true, fecha_pago: '2026-11-20', mes_pago: '2026-11-01', meses: ['2026-12-01', '2027-01-01'], hijos: ['Leo'], disciplinas: ['Fútbol — Lunes 15:00'], total: 73.84 },
  { ...base, tipo: 'mensualidad', aprobado: false, fecha_pago: '2026-11-21', mes_pago: '2026-11-01', meses: ['2026-12-01'], hijos: ['Mía'], disciplinas: ['Danza'] },
];

vi.mock('../../config/db.js', () => ({
  getPool: () => ({
    query: async (sql: string) => {
      if (sql.includes('FROM public.padre WHERE usu_id')) {
        return { rows: [{ usu_id: 7, factura_nombre: 'Ana Pérez', factura_identificacion: '1700000000', factura_correo: 'ana@x.co', factura_direccion: 'Quito' }] };
      }
      return { rows: pagos };
    },
  }),
}));

const deuda = (alumno: string, estado: 'pendiente' | 'atrasado') => ({
  nino_id: alumno.length,
  alumno,
  col_id: 1,
  col_nombre: 'CRISFE',
  mes: '2026-12-01',
  estado,
  subtotal: 32.1,
  descuento: 0,
  iva: 4.82,
  total: 36.92,
  disciplinas: ['Fútbol'],
  contacto: { usu_id: 7, nombre: 'Ana Pérez', cedula: '1700000000', telefono: null, correo: 'ana@x.co' },
  futuro: false,
});

vi.mock('../mensualidades/mensualidades.service.js', () => ({
  registrosMensuales: async () => [],
  deudas: async () => [deuda('Leo', 'pendiente'), deuda('Mía', 'atrasado')],
}));

describe('facturación de Mensualidades', () => {
  it('una fila por pago, colores y deudas por representante y mes', async () => {
    const { filasMensualidades } = await import('./reportes.facturacion.js');
    const filas = await filasMensualidades({ meses: ['2026-11-01', '2026-12-01'] }, 100);

    const porEstado = (e: string) => filas.filter((f) => f.estado === e);

    const inscripcion = porEstado('Pagado (Inscripción)')[0]!;
    expect(inscripcion._color).toBe('amarillo');
    expect(inscripcion._factura).toBe(true);

    // Un pago que cubre diciembre y enero es UNA fila.
    const pagado = porEstado('Pagado')[0]!;
    expect(pagado.mes).toBe('Diciembre, Enero');
    expect(pagado.ano).toBe('2026, 2027');
    expect(pagado._color).toBeNull();
    expect(pagado.recaudado).toBe(73.84);
    expect(pagado.disciplinas).toBe('Fútbol');

    expect(porEstado('En revisión')[0]!._color).toBe('rojo');

    // Leo y Mía deben diciembre: una sola fila de Ana, atrasada, al final.
    const debe = filas.at(-1)!;
    expect(debe.estado).toBe('Atrasado');
    expect(debe.hijos).toBe('Leo, Mía');
    expect(debe.total).toBe(73.84);
    expect(debe._color).toBe('rojo');
    expect(debe._factura).toBe(false);
    expect(debe.factura_direccion).toBe('Quito');
  });
});
