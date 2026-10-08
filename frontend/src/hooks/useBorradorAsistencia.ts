import { useCallback, useEffect, useMemo, useState } from 'react';
import { ESTADO_ASISTENCIA } from '@/api/asistencias';
import { horaEcAhora } from '@/lib/fecha';

/**
 * El borrador de una sesión: lo que hay en pantalla antes de guardar.
 *
 * Lo usan las dos pantallas —alumnos y entrenadores— porque la mecánica es la
 * misma y en el sistema viejo estaba escrita dos veces, en
 * `AsistenciasEntrenadores.tsx` (743 líneas) y en `AttendanceChildrenTable`,
 * ya con diferencias entre ellas.
 *
 * Qué resuelve:
 *
 * - **Campos condicionales.** Al pasar a Tarde se autorrellena la hora con la
 *   del momento (Ecuador) y se limpia el motivo; al pasar a Justificado se
 *   limpia la hora; con Presente o Ausente se limpian los dos. Es la misma
 *   regla que valida el backend y que defiende el CHECK de la migración 0010.
 * - **Qué está sucio.** Se compara contra lo que vino del servidor, no contra
 *   un `hasChanges` que hubiera que ir manteniendo a mano fila a fila.
 * - **Qué está incompleto.** Tarde sin hora o Justificado sin motivo: el botón
 *   de guardar lo dice antes de mandar nada.
 *
 * El borrador se reinicia solo cuando cambia la sesión (`firma`), no en cada
 * refresco: guardar devuelve la lista nueva y no debe borrar lo que el usuario
 * esté escribiendo en ese momento.
 */

export interface FilaOriginal {
  /** Identificador estable de la fila: `nino_id` o `tipo:id`. */
  clave: string;
  asisest_id: number | null;
  hora_tarde: string | null;
  razon: string | null;
}

export interface Borrador {
  asisest_id: number | null;
  hora: string;
  razon: string;
}

export interface EnvioFila {
  clave: string;
  marca: Borrador;
}

export interface UsoBorrador {
  marcas: Record<string, Borrador>;
  /** Claves con algo distinto de lo que vino del servidor. */
  sucias: string[];
  /** Claves con Tarde sin hora o Justificado sin motivo. */
  incompletas: string[];
  hayCambios: boolean;
  elegirEstado: (clave: string, asisest_id: number) => void;
  escribirHora: (clave: string, hora: string) => void;
  escribirRazon: (clave: string, razon: string) => void;
  /** Marca Presente **solo a quien no tiene estado todavía**. */
  presenteALosQueFaltan: () => void;
  deshacer: () => void;
  /**
   * Lo que se mandaría al servidor **ahora mismo**, sin esperar a que el
   * `setState` corra. Si `incluyeRestantes` es true, los que no tienen estado
   * entran como Presente. Se usa al guardar: el padre no puede chainear
   * `presenteALosQueFaltan()` + `onGuardar()` porque las marcas vendrían
   * atrasadas un render.
   */
  envio: (incluyeRestantes: boolean) => EnvioFila[];
}

const vacio = (fila: FilaOriginal): Borrador => ({
  asisest_id: fila.asisest_id,
  hora: fila.hora_tarde ?? '',
  razon: fila.razon ?? '',
});

function desdeFilas(filas: FilaOriginal[]): Record<string, Borrador> {
  return Object.fromEntries(filas.map((fila) => [fila.clave, vacio(fila)]));
}

const comoPresente: Borrador = {
  asisest_id: ESTADO_ASISTENCIA.PRESENTE,
  hora: '',
  razon: '',
};

export function useBorradorAsistencia(filas: FilaOriginal[], firma: string): UsoBorrador {
  const [marcas, setMarcas] = useState<Record<string, Borrador>>(() => desdeFilas(filas));

  /**
   * `firma` es la sesión: disciplina + fecha, o colegio + fecha. Al cambiar,
   * el borrador se rehace desde cero. Las filas por sí solas no sirven de
   * disparador: llegan nuevas en cada refresco.
   */
  useEffect(() => {
    setMarcas(desdeFilas(filas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);

  /** Filas que aparecen después (un alumno recién inscrito) entran vacías. */
  useEffect(() => {
    setMarcas((previas) => {
      const faltan = filas.filter((fila) => previas[fila.clave] === undefined);
      if (faltan.length === 0) return previas;
      return { ...previas, ...desdeFilas(faltan) };
    });
  }, [filas]);

  const elegirEstado = useCallback((clave: string, asisest_id: number) => {
    setMarcas((previas) => {
      const actual = previas[clave];
      if (!actual) return previas;

      /**
       * Al pasar a Tarde se pone la hora de este momento en Ecuador. El caso
       * real: el alumno estaba Ausente, llega, el entrenador lo busca y le
       * da a Tarde — la hora útil es ahora, no la que había antes. Puede
       * editarla si hace falta.
       */
      return {
        ...previas,
        [clave]: {
          asisest_id,
          hora: asisest_id === ESTADO_ASISTENCIA.TARDE ? horaEcAhora() : '',
          razon: asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO ? actual.razon : '',
        },
      };
    });
  }, []);

  const escribirHora = useCallback((clave: string, hora: string) => {
    setMarcas((previas) =>
      previas[clave] ? { ...previas, [clave]: { ...previas[clave], hora } } : previas,
    );
  }, []);

  const escribirRazon = useCallback((clave: string, razon: string) => {
    setMarcas((previas) =>
      previas[clave] ? { ...previas, [clave]: { ...previas[clave], razon } } : previas,
    );
  }, []);

  /**
   * "Presente a los que faltan" no pisa lo ya marcado.
   *
   * Es el patrón más usado —el 90 % viene— y en el sistema viejo borraba las
   * correcciones ya hechas, hora de llegada incluida.
   */
  const presenteALosQueFaltan = useCallback(() => {
    setMarcas((previas) => {
      const siguientes = { ...previas };
      let tocado = false;
      for (const [clave, marca] of Object.entries(previas)) {
        if (marca.asisest_id === null) {
          siguientes[clave] = comoPresente;
          tocado = true;
        }
      }
      return tocado ? siguientes : previas;
    });
  }, []);

  const deshacer = useCallback(() => setMarcas(desdeFilas(filas)), [filas]);

  const { sucias, incompletas } = useMemo(() => {
    const sucias: string[] = [];
    const incompletas: string[] = [];

    for (const fila of filas) {
      const marca = marcas[fila.clave];
      if (!marca) continue;

      const original = vacio(fila);
      if (
        marca.asisest_id !== original.asisest_id ||
        marca.hora !== original.hora ||
        marca.razon.trim() !== original.razon.trim()
      ) {
        sucias.push(fila.clave);
      }

      if (marca.asisest_id === ESTADO_ASISTENCIA.TARDE && marca.hora === '') {
        incompletas.push(fila.clave);
      }
      if (
        marca.asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO &&
        marca.razon.trim().length < 3
      ) {
        incompletas.push(fila.clave);
      }
    }

    return { sucias, incompletas };
  }, [filas, marcas]);

  const envio = useCallback(
    (incluyeRestantes: boolean): EnvioFila[] => {
      const resultado: EnvioFila[] = [];
      for (const fila of filas) {
        const base = marcas[fila.clave];
        if (!base) continue;

        const efectivo: Borrador =
          incluyeRestantes && base.asisest_id === null ? comoPresente : base;
        if (efectivo.asisest_id === null) continue;

        const original = vacio(fila);
        const diferente =
          efectivo.asisest_id !== original.asisest_id ||
          efectivo.hora !== original.hora ||
          efectivo.razon.trim() !== original.razon.trim();
        if (!diferente) continue;

        resultado.push({ clave: fila.clave, marca: efectivo });
      }
      return resultado;
    },
    [filas, marcas],
  );

  return {
    marcas,
    sucias,
    incompletas,
    hayCambios: sucias.length > 0,
    elegirEstado,
    escribirHora,
    escribirRazon,
    presenteALosQueFaltan,
    deshacer,
    envio,
  };
}
