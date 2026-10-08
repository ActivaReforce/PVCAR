import { ESTADO } from '../../lib/constants.js';
import type { FiltrosReporte } from './reportes.definiciones.js';

/**
 * La hoja "Resumen" de cada Excel.
 *
 * Pedido del cliente (2026-10-07): que nadie tenga que trabajar el Excel a
 * mano. Cada reporte abre con una hoja ya agrupada y contada; el detalle va
 * detrás. Casos con los que se pidió:
 *
 *   ej1 — cuántas veces vino cada profe: una fila por persona con su total y,
 *         si trabaja en más de un colegio, el desglose debajo. Es por colegio
 *         y no por disciplina porque la asistencia del personal se guarda así
 *         (`asistencia_entrenador.col_id`, sin disciplina).
 *   ej2 — alumnos por disciplina: una tabla de conteos y, aparte, la lista
 *         agrupada con los nombres.
 *
 * Se calcula **sobre las mismas filas que van a la hoja de detalle**: mismos
 * filtros, mismo alcance, mismo tope. Si el Resumen dice 40, el detalle tiene
 * esas 40. Por eso no lleva consultas propias.
 *
 * Las columnas que empiezan por `_` las añade la consulta solo para esto;
 * `proyectar` las quita de la pantalla y del detalle.
 */

export type Celda = string | number;
export type Fila = Record<string, unknown>;

export interface Bloque {
  titulo: string;
  nota?: string;
  cabeceras: string[];
  filas: Celda[][];
  /** Índices de `filas` que van en negrita: totales y cabeceras de grupo. */
  destacadas: number[];
}

interface Clave {
  cabecera: string;
  de: (f: Fila) => string;
}

interface Medida {
  cabecera: string;
  calc: (grupo: Fila[]) => Celda;
}

const texto = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const numero = (v: unknown): number => Number(v ?? 0) || 0;
const comparar = (a: string, b: string) => a.localeCompare(b, 'es', { sensitivity: 'base' });

const campo =
  (clave: string, vacio = '—') =>
  (f: Fila) =>
    texto(f[clave]) || vacio;

const cuenta = (cabecera: string): Medida => ({ cabecera, calc: (g) => g.length });

const suma = (cabecera: string, clave: string): Medida => ({
  cabecera,
  calc: (g) => g.reduce((s, f) => s + numero(f[clave]), 0),
});

const cuantos = (cabecera: string, cumple: (f: Fila) => boolean): Medida => ({
  cabecera,
  calc: (g) => g.filter(cumple).length,
});

/** Porcentaje a un decimal; vacío si no hay base. */
function porcentaje(parte: number, total: number): Celda {
  return total === 0 ? '' : Math.round((parte * 1000) / total) / 10;
}

/**
 * Agrupa por una o varias claves y aplica las medidas a cada grupo, con una
 * fila de total al final. Los grupos salen en orden alfabético.
 */
function agrupar(
  titulo: string,
  filas: Fila[],
  claves: Clave[],
  medidas: Medida[],
  opciones: { nota?: string; total?: boolean } = {},
): Bloque {
  const grupos = new Map<string, { etiquetas: string[]; filas: Fila[] }>();
  for (const f of filas) {
    const etiquetas = claves.map((c) => c.de(f));
    const k = etiquetas.join('\u0000');
    const g = grupos.get(k) ?? { etiquetas, filas: [] };
    g.filas.push(f);
    grupos.set(k, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => {
    for (let i = 0; i < a.etiquetas.length; i++) {
      const c = comparar(a.etiquetas[i]!, b.etiquetas[i]!);
      if (c !== 0) return c;
    }
    return 0;
  });

  const salida: Celda[][] = ordenados.map((g) => [...g.etiquetas, ...medidas.map((m) => m.calc(g.filas))]);
  const destacadas: number[] = [];
  if (opciones.total !== false && ordenados.length > 1) {
    destacadas.push(salida.length);
    salida.push([
      'Total',
      ...claves.slice(1).map(() => ''),
      ...medidas.map((m) => m.calc(filas)),
    ]);
  }
  return {
    titulo,
    ...(opciones.nota ? { nota: opciones.nota } : {}),
    cabeceras: [...claves.map((c) => c.cabecera), ...medidas.map((m) => m.cabecera)],
    filas: salida,
    destacadas,
  };
}

/** Una lista simple de nombres, sin agrupar. */
function lista(titulo: string, cabecera: string, nombres: string[]): Bloque {
  return {
    titulo,
    cabeceras: [cabecera],
    filas: nombres.sort(comparar).map((n) => [n]),
    destacadas: [],
  };
}

// ---------------------------------------------------------------------------
// Asistencia: los cuatro estados, igual que en la pestaña de análisis

const ASIS = { PRESENTE: 1, AUSENTE: 2, TARDE: 3, JUSTIFICADO: 4 } as const;
const conEstado = (id: number) => (f: Fila) => numero(f._asisest) === id;

/** El "% presente" es el mismo de las gráficas: presentes sobre el total. */
function medidasAsistencia(): Medida[] {
  return [
    cuantos('Presente', conEstado(ASIS.PRESENTE)),
    cuantos('Tarde', conEstado(ASIS.TARDE)),
    cuantos('Justificado', conEstado(ASIS.JUSTIFICADO)),
    cuantos('Ausente', conEstado(ASIS.AUSENTE)),
    cuenta('Total'),
    {
      cabecera: 'Vino (presente + tarde)',
      calc: (g) => g.filter((f) => conEstado(ASIS.PRESENTE)(f) || conEstado(ASIS.TARDE)(f)).length,
    },
    {
      cabecera: '% presente',
      calc: (g) => porcentaje(g.filter(conEstado(ASIS.PRESENTE)).length, g.length),
    },
  ];
}

const NOTA_ASISTENCIA =
  '"% presente" es presentes sobre el total, igual que en las gráficas. "Vino" suma presentes y tardes.';

// ---------------------------------------------------------------------------
// Un resumen por reporte

type Constructor = (filas: Fila[], filtros: FiltrosReporte) => Bloque[];

const porEstado = (filas: Fila[], clave = 'estado'): Medida[] =>
  [...new Set(filas.map((f) => texto(f[clave])))]
    .filter(Boolean)
    .sort(comparar)
    .map((e) => cuantos(e, (f) => texto(f[clave]) === e));

/** Repite cada fila una vez por valor de un campo múltiple (roles, colegios). */
function expandir(filas: Fila[], clave: string, comoVacio: string): Fila[] {
  return filas.flatMap((f) => {
    const valores = Array.isArray(f[clave]) ? (f[clave] as unknown[]).map(texto) : [];
    return (valores.length > 0 ? valores : [comoVacio]).map((v) => ({ ...f, _k: v }));
  });
}

const usuarios: Constructor = (filas) => {
  const porRol = expandir(filas, '_roles', 'Sin rol');
  return [
    agrupar('Personas por estado', filas, [{ cabecera: 'Estado', de: campo('estado') }], [cuenta('Personas')]),
    agrupar(
      'Personas por rol',
      porRol,
      [{ cabecera: 'Rol', de: campo('_k') }],
      [...porEstado(filas), cuenta('Total')],
      { nota: 'Quien tiene varios roles cuenta en cada uno.', total: false },
    ),
  ];
};

const colegios: Constructor = (filas) => {
  const sinCoordinador = filas.filter((f) => !texto(f.coordinadores)).map((f) => texto(f.col_nombre));
  const bloques: Bloque[] = [
    {
      titulo: 'Totales',
      cabeceras: ['Concepto', 'Cantidad'],
      filas: [
        ['Colegios', filas.length],
        ['Disciplinas activas', filas.reduce((s, f) => s + numero(f.disciplinas), 0)],
        ['Alumnos activos', filas.reduce((s, f) => s + numero(f.estudiantes), 0)],
        ['Colegios sin coordinador', sinCoordinador.length],
      ],
      destacadas: [],
    },
  ];
  if (sinCoordinador.length > 0) bloques.push(lista('Colegios sin coordinador', 'Colegio', sinCoordinador));
  return bloques;
};

const actividades: Constructor = (filas) => {
  const sinDisciplinas = filas.filter((f) => numero(f.disciplinas) === 0).map((f) => texto(f.act_nombre));
  const bloques = [
    agrupar(
      'Actividades por categoría',
      filas,
      [{ cabecera: 'Categoría', de: campo('cat_nombre', 'Sin categoría') }],
      [cuenta('Actividades'), suma('Disciplinas activas', 'disciplinas')],
    ),
  ];
  if (sinDisciplinas.length > 0) {
    bloques.push(lista('Actividades sin disciplinas activas', 'Actividad', sinDisciplinas));
  }
  return bloques;
};

const disciplinas: Constructor = (filas) => {
  const sinEntrenador = (f: Fila) => texto(f.entrenadores) === 'Sin entrenador';
  const medidas = (): Medida[] => [
    cuenta('Disciplinas'),
    ...porEstado(filas),
    cuantos('Sin entrenador', sinEntrenador),
    suma('Alumnos activos', 'alumnos'),
  ];
  const bloques = [
    agrupar('Por colegio', filas, [{ cabecera: 'Colegio', de: campo('col_nombre') }], medidas()),
    agrupar('Por actividad', filas, [{ cabecera: 'Actividad', de: campo('act_nombre') }], medidas()),
  ];
  const huerfanas = filas.filter(sinEntrenador);
  if (huerfanas.length > 0) {
    bloques.push(
      agrupar(
        'Disciplinas sin entrenador',
        huerfanas,
        [
          { cabecera: 'Colegio', de: campo('col_nombre') },
          { cabecera: 'Actividad', de: campo('act_nombre') },
          { cabecera: 'Horario', de: campo('horario') },
        ],
        [suma('Alumnos activos', 'alumnos')],
        { total: false },
      ),
    );
  }
  return bloques;
};

const entrenadores: Constructor = (filas) => {
  const sinClases = filas.filter((f) => numero(f.disciplinas) === 0).map((f) => texto(f.usu_nombre));
  const bloques = [
    agrupar('Por estado de la ficha', filas, [{ cabecera: 'Estado', de: campo('estado') }], [cuenta('Entrenadores')]),
    agrupar(
      'Por colegio',
      expandir(filas, '_colegios', 'Sin colegio'),
      [{ cabecera: 'Colegio', de: campo('_k') }],
      [cuenta('Entrenadores')],
      { nota: 'Quien trabaja en varios colegios cuenta en cada uno.', total: false },
    ),
  ];
  if (sinClases.length > 0) bloques.push(lista('Entrenadores sin disciplinas activas', 'Entrenador', sinClases));
  return bloques;
};

interface DisciplinaDeAlumno {
  id: number;
  colegio: string;
  actividad: string;
  horario: string;
}

/**
 * ej2. Un alumno en dos disciplinas sale en las dos: la tabla de conteos suma
 * más que el total de alumnos, y lo dice.
 */
const estudiantes: Constructor = (filas, filtros) => {
  const porDisciplina = new Map<number, { d: DisciplinaDeAlumno; alumnos: Fila[] }>();
  let sinDisciplina = 0;
  for (const f of filas) {
    const suyas = ((f._disciplinas as DisciplinaDeAlumno[] | null) ?? []).filter(
      (d) => !filtros.disciplina || d.id === filtros.disciplina,
    );
    if (suyas.length === 0) sinDisciplina++;
    for (const d of suyas) {
      const g = porDisciplina.get(d.id) ?? { d, alumnos: [] };
      g.alumnos.push(f);
      porDisciplina.set(d.id, g);
    }
  }
  const grupos = [...porDisciplina.values()].sort(
    (a, b) =>
      comparar(a.d.colegio, b.d.colegio) || comparar(a.d.actividad, b.d.actividad) || comparar(a.d.horario, b.d.horario),
  );

  const conteos: Bloque = {
    titulo: 'Alumnos por disciplina',
    nota: 'Un alumno en dos disciplinas cuenta en las dos. Solo inscripciones activas.',
    cabeceras: ['Colegio', 'Actividad', 'Horario', 'Alumnos'],
    filas: grupos.map((g) => [g.d.colegio, g.d.actividad, g.d.horario, g.alumnos.length]),
    destacadas: [],
  };
  if (sinDisciplina > 0) conteos.filas.push(['Sin disciplina', '', '', sinDisciplina]);
  conteos.destacadas.push(conteos.filas.length);
  conteos.filas.push(['Total de alumnos (sin repetir)', '', '', filas.length]);

  const listado: Bloque = {
    titulo: 'Lista de alumnos por disciplina',
    cabeceras: ['Alumno', 'Grado', 'Edad', 'Estado', 'Representantes'],
    filas: [],
    destacadas: [],
  };
  for (const g of grupos) {
    listado.destacadas.push(listado.filas.length);
    const horario = g.d.horario ? ` (${g.d.horario})` : '';
    const n = g.alumnos.length;
    listado.filas.push([`${g.d.colegio} · ${g.d.actividad}${horario} — ${n} ${n === 1 ? 'alumno' : 'alumnos'}`]);
    for (const a of [...g.alumnos].sort((x, y) => comparar(texto(x.nino_nombre), texto(y.nino_nombre)))) {
      listado.filas.push([
        texto(a.nino_nombre),
        texto(a.catninograd_nombre),
        texto(a.nino_edad),
        texto(a.estado),
        texto(a.representantes),
      ]);
    }
    listado.filas.push([]);
  }
  if (listado.filas.length > 0) listado.filas.pop();

  return [
    conteos,
    listado,
    agrupar('Alumnos por colegio', filas, [{ cabecera: 'Colegio', de: campo('col_nombre') }], [
      ...porEstado(filas),
      cuenta('Total'),
    ]),
  ];
};

const asistenciasAlumnos: Constructor = (filas) => [
  agrupar('Por colegio', filas, [{ cabecera: 'Colegio', de: campo('col_nombre') }], medidasAsistencia(), {
    nota: NOTA_ASISTENCIA,
  }),
  agrupar(
    'Por disciplina',
    filas,
    [
      { cabecera: 'Colegio', de: campo('col_nombre') },
      { cabecera: 'Actividad', de: campo('act_nombre') },
      { cabecera: 'Horario', de: campo('_disc_horario', '') },
    ],
    medidasAsistencia(),
  ),
  agrupar(
    'Por alumno',
    filas,
    [
      { cabecera: 'Alumno', de: campo('nino_nombre') },
      { cabecera: 'Colegio', de: campo('col_nombre') },
      { cabecera: 'Actividad', de: campo('act_nombre') },
    ],
    medidasAsistencia(),
  ),
];

/**
 * ej1. Una fila por persona (en negrita) con su total; si marcó en más de un
 * colegio, una fila por colegio debajo. Titular y auxiliar van por separado
 * aunque sean la misma persona: son dos papeles distintos.
 */
const asistenciasEntrenadores: Constructor = (filas) => {
  const medidas = medidasAsistencia();
  const personas = new Map<string, { nombre: string; tipo: string; filas: Fila[] }>();
  for (const f of filas) {
    const k = `${texto(f.tipo)}:${texto(f._persona)}`;
    const p = personas.get(k) ?? { nombre: texto(f.usu_nombre), tipo: texto(f.tipo), filas: [] };
    p.filas.push(f);
    personas.set(k, p);
  }
  const ordenadas = [...personas.values()].sort((a, b) => comparar(a.nombre, b.nombre) || comparar(a.tipo, b.tipo));

  const bloque: Bloque = {
    titulo: 'Cuántas veces vino cada persona',
    nota: `Una fila por persona con su total; debajo, el desglose si trabaja en más de un colegio. ${NOTA_ASISTENCIA}`,
    cabeceras: ['Persona', 'Tipo', 'Colegio', ...medidas.map((m) => m.cabecera)],
    filas: [],
    destacadas: [],
  };
  for (const p of ordenadas) {
    const porColegio = new Map<string, Fila[]>();
    for (const f of p.filas) {
      const c = texto(f.col_nombre);
      porColegio.set(c, [...(porColegio.get(c) ?? []), f]);
    }
    const colegios = [...porColegio.keys()].sort(comparar);
    bloque.destacadas.push(bloque.filas.length);
    bloque.filas.push([
      p.nombre,
      p.tipo,
      colegios.length === 1 ? colegios[0]! : `Todos (${colegios.length})`,
      ...medidas.map((m) => m.calc(p.filas)),
    ]);
    if (colegios.length > 1) {
      for (const c of colegios) bloque.filas.push(['', '', c, ...medidas.map((m) => m.calc(porColegio.get(c)!))]);
    }
  }

  return [
    bloque,
    agrupar('Por colegio', filas, [{ cabecera: 'Colegio', de: campo('col_nombre') }], medidas),
  ];
};

const evaluaciones: Constructor = (filas) => {
  const evaluado = (f: Fila) => numero(f._est) === ESTADO.EVALUADO;
  const medidas = (): Medida[] => [
    cuenta('Asignadas'),
    cuantos('Evaluadas', evaluado),
    cuantos('Pendientes', (f) => !evaluado(f)),
    {
      cabecera: 'Promedio % (evaluadas)',
      calc: (g) => {
        const hechas = g.filter(evaluado);
        return hechas.length === 0
          ? ''
          : Math.round((hechas.reduce((s, f) => s + numero(f.porcentaje), 0) * 10) / hechas.length) / 10;
      },
    },
  ];
  return [
    agrupar(
      'Por evaluación',
      filas,
      [
        { cabecera: 'Evaluación', de: campo('eva_titulo') },
        { cabecera: 'Categoría', de: campo('eva_categoria', '') },
      ],
      medidas(),
    ),
    agrupar(
      'Por colegio y actividad',
      filas,
      [
        { cabecera: 'Colegio', de: campo('col_nombre') },
        { cabecera: 'Actividad', de: campo('act_nombre') },
      ],
      medidas(),
    ),
  ];
};

const RESUMENES: Record<string, Constructor> = {
  usuarios,
  colegios,
  actividades,
  disciplinas,
  entrenadores,
  estudiantes,
  'asistencias-alumnos': asistenciasAlumnos,
  'asistencias-entrenadores': asistenciasEntrenadores,
  evaluaciones,
};

export function resumenDe(id: string, filas: Fila[], filtros: FiltrosReporte): Bloque[] {
  if (filas.length === 0) return [];
  return RESUMENES[id]?.(filas, filtros) ?? [];
}
