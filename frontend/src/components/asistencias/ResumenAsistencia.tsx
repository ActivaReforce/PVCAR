import type { ResumenAsistencia as Resumen } from '@/api/asistencias';
import { ESTADO_ASISTENCIA } from '@/api/asistencias';
import { PINTA } from './estados';

interface Props {
  resumen: Resumen;
}

/**
 * El resumen de la sesión, tal como lo cuenta el servidor.
 *
 * Los números vienen del backend calculados sobre la lista entera; aquí no hay
 * ningún `.filter().length`. Es la regla del checklist: contar en SQL, mostrar
 * en el navegador.
 *
 * **Oculto en móvil** (pedido del cliente, 2026-10-15): las cinco tarjetas
 * ocupaban demasiado espacio arriba. "Sin marcar" ya sale en la barra de
 * guardado, que sí vive en móvil. Desde `sm` (640 px) vuelve a enseñarse.
 */
const ResumenAsistencia = ({ resumen }: Props) => {
  const celdas = [
    { clave: 'presentes', valor: resumen.presentes, pinta: PINTA[ESTADO_ASISTENCIA.PRESENTE] },
    { clave: 'ausentes', valor: resumen.ausentes, pinta: PINTA[ESTADO_ASISTENCIA.AUSENTE] },
    { clave: 'tardes', valor: resumen.tardes, pinta: PINTA[ESTADO_ASISTENCIA.TARDE] },
    {
      clave: 'justificados',
      valor: resumen.justificados,
      pinta: PINTA[ESTADO_ASISTENCIA.JUSTIFICADO],
    },
  ];

  return (
    <div className="hidden gap-2 sm:grid sm:grid-cols-5">
      {celdas.map(({ clave, valor, pinta }) => (
        <div key={clave} className="rounded-lg border px-3 py-2">
          <div className={`text-xl font-semibold ${pinta.texto}`}>{valor}</div>
          <div className="truncate text-xs text-muted-foreground">{pinta.etiqueta}</div>
        </div>
      ))}

      <div className="rounded-lg border px-3 py-2">
        <div
          className={`text-xl font-semibold ${
            resumen.sinMarcar > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
          }`}
        >
          {resumen.sinMarcar}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          Sin marcar de {resumen.total}
        </div>
      </div>
    </div>
  );
};

export default ResumenAsistencia;
