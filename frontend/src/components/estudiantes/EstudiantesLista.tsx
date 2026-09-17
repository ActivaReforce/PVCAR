import { Eye, Pencil, RotateCcw, Trash2, UserX } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { Estudiante } from '@/api/estudiantes';

interface Props {
  estudiantes: Estudiante[];
  onVer: (e: Estudiante) => void;
  onEditar: (e: Estudiante) => void;
  onBaja: (e: Estudiante) => void;
  onReactivar: (e: Estudiante) => void;
  onEliminar: (e: Estudiante) => void;
}

/** Misma rejilla en la cabecera y en cada fila. */
const REJILLA =
  'grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_8rem_6rem_6rem_11rem] md:items-center md:gap-4';

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

/**
 * Lista de estudiantes.
 *
 * Un solo markup: columnas en escritorio, tarjeta apilada en el teléfono. Con
 * 796 alumnos la lista se lee de arriba abajo muchas veces al día, así que
 * cada fila dice lo justo — quién es, de qué colegio, qué grado, en cuántas
 * disciplinas está — y las acciones son botones visibles, no un menú.
 *
 * Lo que **no** sale aquí: cédula, información de salud y datos del
 * representante. Son datos sensibles de un menor y solo se piden al abrir la
 * ficha. En el sistema viejo viajaban todos en la consulta de la lista.
 */
const EstudiantesLista = ({
  estudiantes,
  onVer,
  onEditar,
  onBaja,
  onReactivar,
  onEliminar,
}: Props) => {
  if (estudiantes.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p className="text-lg">No hay estudiantes que mostrar</p>
        <p className="mt-2 text-sm">Ajusta los filtros o crea el primero.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className={`${REJILLA} hidden bg-muted/50 px-4 py-2 text-sm font-medium text-muted-foreground md:grid`}
      >
        <div>Estudiante</div>
        <div>Colegio</div>
        <div>Grado</div>
        <div>Disciplinas</div>
        <div>Estado</div>
        <div>Acciones</div>
      </div>

      <ul className="divide-y">
        {estudiantes.map((e) => {
          const activo = e.est_id === 1;
          return (
            <li key={e.nino_id} className={`${REJILLA} px-4 py-3`}>
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={e.nino_foto_url ?? undefined} alt="" />
                  <AvatarFallback>{iniciales(e.nino_nombre)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium" title={e.nino_nombre}>
                    {e.nino_nombre}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {e.nino_edad ? `${e.nino_edad} años` : 'Edad sin registrar'}
                  </div>
                </div>
              </div>

              <div className="min-w-0 truncate text-sm" title={e.col_nombre}>
                {e.col_nombre}
              </div>

              <div className="text-sm text-muted-foreground">
                {e.catninograd_nombre ?? '—'}
              </div>

              <div className="text-sm">
                {e.disciplinas > 0 ? (
                  <span>
                    <strong>{e.disciplinas}</strong> inscrito{e.disciplinas === 1 ? '' : 's'}
                  </span>
                ) : (
                  <span className="text-amber-700 dark:text-amber-400">Sin disciplinas</span>
                )}
              </div>

              <div>
                <Badge variant={activo ? 'default' : 'secondary'}>
                  {activo ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 md:h-9 md:w-9"
                  onClick={() => onVer(e)}
                  title="Ver ficha"
                  aria-label={`Ver ficha de ${e.nino_nombre}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>

                <ConditionalAction module="estudiantes" action="editar">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 md:h-9 md:w-9"
                    onClick={() => onEditar(e)}
                    title="Editar"
                    aria-label={`Editar a ${e.nino_nombre}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </ConditionalAction>

                {activo ? (
                  <ConditionalAction module="estudiantes" action="editar">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 text-destructive hover:text-destructive md:h-9 md:w-9"
                      onClick={() => onBaja(e)}
                      title="Dar de baja"
                      aria-label={`Dar de baja a ${e.nino_nombre}`}
                    >
                      <UserX className="h-4 w-4" />
                    </Button>
                  </ConditionalAction>
                ) : (
                  <>
                    <ConditionalAction module="estudiantes" action="editar">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 md:h-9 md:w-9"
                        onClick={() => onReactivar(e)}
                        title="Reactivar"
                        aria-label={`Reactivar a ${e.nino_nombre}`}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                    </ConditionalAction>
                    <ConditionalAction module="estudiantes" action="eliminar">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-11 w-11 text-destructive hover:text-destructive md:h-9 md:w-9"
                        onClick={() => onEliminar(e)}
                        title="Eliminar permanentemente"
                        aria-label={`Eliminar a ${e.nino_nombre}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </ConditionalAction>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EstudiantesLista;
