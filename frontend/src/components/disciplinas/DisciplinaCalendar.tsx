import DisciplinaCard from './DisciplinaCard';
import type { Dia, Disciplina } from '@/api/disciplinas';

interface Props {
  disciplinas: Disciplina[];
  dias: Dia[];
  onEdit: (d: Disciplina) => void;
  onBaja: (d: Disciplina) => void;
  onReactivar: (d: Disciplina) => void;
  onEliminar: (d: Disciplina) => void;
}

/**
 * Calendario semanal.
 *
 * Un solo markup para los tres anchos: cada día es una sección y el contenedor
 * las reparte en columnas según quepan — apiladas en el teléfono, dos en
 * tablet, hasta cuatro en escritorio. La versión vieja era una rejilla fija de
 * siete columnas que en 360 px se salía de la pantalla.
 *
 * Los días sin nada se enseñan igual, en gris: saber que el viernes no hay
 * nada es información, y si se ocultan la semana parece más llena de lo que
 * está.
 */
const DisciplinaCalendar = ({
  disciplinas,
  dias,
  onEdit,
  onBaja,
  onReactivar,
  onEliminar,
}: Props) => {
  const porDia = new Map<number, Disciplina[]>();
  for (const dia of dias) porDia.set(dia.dia_id, []);
  for (const d of disciplinas) {
    const lista = porDia.get(d.dia_id);
    if (lista) lista.push(d);
    else porDia.set(d.dia_id, [d]);
  }

  // Un día vacío al final de la semana (domingo, casi siempre) no aporta nada;
  // uno vacío en medio sí, porque rompe la lectura de la semana.
  const ultimoConDatos = dias.reduce(
    (ultimo, dia, indice) => ((porDia.get(dia.dia_id)?.length ?? 0) > 0 ? indice : ultimo),
    -1,
  );
  const visibles = dias.slice(0, Math.max(ultimoConDatos + 1, 5));

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {visibles.map((dia) => {
        const delDia = porDia.get(dia.dia_id) ?? [];
        return (
          <section key={dia.dia_id} className="min-w-0 space-y-2">
            <header className="flex items-baseline justify-between border-b pb-1">
              <h2 className="font-semibold">{dia.dia_nombre}</h2>
              <span className="text-xs text-muted-foreground">
                {delDia.length === 0
                  ? 'sin disciplinas'
                  : `${delDia.length} ${delDia.length === 1 ? 'disciplina' : 'disciplinas'}`}
              </span>
            </header>

            <div className="space-y-2">
              {delDia.map((d) => (
                <DisciplinaCard
                  key={d.colacthor_id}
                  disciplina={d}
                  onEdit={onEdit}
                  onBaja={onBaja}
                  onReactivar={onReactivar}
                  onEliminar={onEliminar}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default DisciplinaCalendar;
