import DisciplinaCard from "./DisciplinaCard";
import { GrupoDesplegable } from "@/components/comun/TarjetaDesplegable";
import type { Dia, Disciplina } from "@/api/disciplinas";

interface Props {
  disciplinas: Disciplina[];
  dias: Dia[];
  onEdit: (d: Disciplina) => void;
  onBaja: (d: Disciplina) => void;
  onReactivar: (d: Disciplina) => void;
  onEliminar: (d: Disciplina) => void;
}

/**
 * El calendario, por colegio.
 *
 * Pedido del cliente al probar la Fase 8: una sección por colegio y, dentro,
 * su semana de lunes a domingo. Cada disciplina es una tarjeta compacta
 * (actividad y hora) que despliega el detalle, y sale en **cada uno de sus
 * días** con la hora de ese día (Disciplinas v2: una disciplina tiene varios).
 *
 * Un solo markup para todos los anchos: desde `lg` la semana son siete
 * columnas de un ancho mínimo legible (si no caben, se desliza en horizontal
 * en vez de estrujar los nombres); por debajo, los días se apilan y los que no tienen nada se
 * ocultan, porque en el teléfono siete encabezados vacíos solo empujan la
 * lista hacia abajo. En las siete columnas sí se ven los vacíos: saber que el
 * viernes no hay nada es información.
 */
const DisciplinaCalendar = ({
  disciplinas,
  dias,
  onEdit,
  onBaja,
  onReactivar,
  onEliminar,
}: Props) => {
  const colegios = new Map<number, { nombre: string; lista: Disciplina[] }>();
  for (const d of disciplinas) {
    const grupo = colegios.get(d.col_id) ?? { nombre: d.col_nombre, lista: [] };
    grupo.lista.push(d);
    colegios.set(d.col_id, grupo);
  }
  const orden = [...colegios.entries()].sort(([, a], [, b]) =>
    a.nombre.localeCompare(b.nombre, "es"),
  );

  return (
    <GrupoDesplegable>
      <div className="space-y-8">
        {orden.map(([colId, { nombre, lista }]) => {
          const sinEntrenador = lista.filter(
            (d) => d.est_id === 1 && d.entrenadores.length === 0,
          ).length;
          return (
            <section key={colId} className="min-w-0 space-y-3">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 border-b pb-1">
                <h2 className="text-lg font-semibold">{nombre}</h2>
                <span className="text-xs text-muted-foreground">
                  {lista.length}{" "}
                  {lista.length === 1 ? "disciplina" : "disciplinas"}
                  {sinEntrenador > 0 && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {" "}
                      · {sinEntrenador} sin entrenador
                    </span>
                  )}
                </span>
              </header>

              {/* Lo único que se desplaza a lo ancho es el calendario de cada colegio. */}
              <div className="max-w-full lg:overflow-x-auto lg:pb-1">
                <div className="grid grid-cols-1 gap-3 lg:min-w-[61rem] lg:grid-cols-[repeat(7,minmax(8.5rem,1fr))] lg:gap-2">
                  {dias.map((dia) => {
                    const horaDe = (d: Disciplina) =>
                      d.horarios.find((h) => h.dia_id === dia.dia_id)?.inicio ?? "";
                    const delDia = lista
                      .filter((d) => d.horarios.some((h) => h.dia_id === dia.dia_id))
                      .sort((a, b) => horaDe(a).localeCompare(horaDe(b)));
                    return (
                      <div
                        key={dia.dia_id}
                        className={`min-w-0 space-y-1.5 ${delDia.length === 0 ? "hidden lg:block" : ""}`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {dia.dia_nombre}
                        </p>
                        {delDia.length === 0 ? (
                          <p className="text-xs text-muted-foreground/60">—</p>
                        ) : (
                          delDia.map((d) => (
                            <DisciplinaCard
                              key={d.colacthor_id}
                              disciplina={d}
                              diaId={dia.dia_id}
                              onEdit={onEdit}
                              onBaja={onBaja}
                              onReactivar={onReactivar}
                              onEliminar={onEliminar}
                            />
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </GrupoDesplegable>
  );
};

export default DisciplinaCalendar;
