import { ESTADO_ASISTENCIA } from '@/api/asistencias';

/**
 * Los cuatro estados y cómo se pintan.
 *
 * Un solo sitio para el color y la etiqueta: en el sistema viejo el nombre se
 * leía del catálogo y se comparaba en minúsculas (`e.asisest_nombre
 * .toLowerCase() === 'presente'`) en cinco archivos. Renombrar un estado desde
 * la base habría roto "Aplicar Presente a todos" sin que nada avisara.
 *
 * Cada color trae su variante oscura: un verde 600 sobre fondo oscuro no se
 * lee, y el caso de uso real es un teléfono al aire libre.
 */
export interface PintaEstado {
  id: number;
  etiqueta: string;
  /** Una letra para el botón cuando no cabe la palabra (360 px). */
  inicial: string;
  /** Botón sin seleccionar. */
  suave: string;
  /** Botón seleccionado. */
  lleno: string;
  /** Texto suelto: el estado guardado en una fila de solo lectura. */
  texto: string;
}

export const PINTA: Record<number, PintaEstado> = {
  [ESTADO_ASISTENCIA.PRESENTE]: {
    id: ESTADO_ASISTENCIA.PRESENTE,
    etiqueta: 'Presente',
    inicial: 'P',
    suave:
      'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950',
    lleno: 'bg-emerald-600 text-emerald-50 dark:bg-emerald-500 dark:text-emerald-950',
    texto: 'text-emerald-700 dark:text-emerald-400',
  },
  [ESTADO_ASISTENCIA.AUSENTE]: {
    id: ESTADO_ASISTENCIA.AUSENTE,
    etiqueta: 'Ausente',
    inicial: 'A',
    suave:
      'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950',
    lleno: 'bg-rose-600 text-rose-50 dark:bg-rose-500 dark:text-rose-950',
    texto: 'text-rose-700 dark:text-rose-400',
  },
  [ESTADO_ASISTENCIA.TARDE]: {
    id: ESTADO_ASISTENCIA.TARDE,
    etiqueta: 'Tarde',
    inicial: 'T',
    suave:
      'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950',
    lleno: 'bg-amber-500 text-amber-950 dark:bg-amber-400 dark:text-amber-950',
    texto: 'text-amber-700 dark:text-amber-400',
  },
  [ESTADO_ASISTENCIA.JUSTIFICADO]: {
    id: ESTADO_ASISTENCIA.JUSTIFICADO,
    etiqueta: 'Justificado',
    inicial: 'J',
    suave:
      'border-sky-300 text-sky-700 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-400 dark:hover:bg-sky-950',
    lleno: 'bg-sky-600 text-sky-50 dark:bg-sky-500 dark:text-sky-950',
    texto: 'text-sky-700 dark:text-sky-400',
  },
};

/** El orden en que salen los cuatro botones, de mejor a peor. */
export const ORDEN_ESTADOS = [
  ESTADO_ASISTENCIA.PRESENTE,
  ESTADO_ASISTENCIA.AUSENTE,
  ESTADO_ASISTENCIA.TARDE,
  ESTADO_ASISTENCIA.JUSTIFICADO,
];

export const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((parte) => parte[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
