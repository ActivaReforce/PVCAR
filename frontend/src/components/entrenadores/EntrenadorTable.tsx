import { ArrowDown, ArrowUp, ArrowUpDown, Eye, UserPlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { cn } from '@/lib/utils';
import type { Entrenador, FiltrosEntrenadores } from '@/api/entrenadores';

type Orden = NonNullable<FiltrosEntrenadores['orden']>;

interface Props {
  entrenadores: Entrenador[];
  onVer: (e: Entrenador) => void;
  onAsignar: (e: Entrenador) => void;
  orden: Orden;
  dir: 'asc' | 'desc';
  onOrdenar: (clave: Orden) => void;
}

/** Columnas desde md, las mismas en la cabecera y en cada fila. */
const COLUMNAS_MD =
  'md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.8fr)_8rem_6rem_5.5rem] md:items-center md:gap-4';
const REJILLA = `grid ${COLUMNAS_MD}`;
/** En el teléfono: nombre y acciones en una línea, el resto debajo. */
const FILA = `grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1.5 ${COLUMNAS_MD}`;

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

function Cabecera({
  clave,
  children,
  orden,
  dir,
  onOrdenar,
}: {
  clave: Orden;
  children: string;
  orden: Orden;
  dir: 'asc' | 'desc';
  onOrdenar: (clave: Orden) => void;
}) {
  const activa = orden === clave;
  const Icono = !activa ? ArrowUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={() => onOrdenar(clave)}
      className={cn(
        'flex items-center gap-1 text-left font-medium hover:text-foreground',
        activa && 'text-foreground',
      )}
      aria-label={`Ordenar por ${children.toLowerCase()}`}
    >
      {children}
      <Icono className="h-3.5 w-3.5 flex-shrink-0" />
    </button>
  );
}

/**
 * Lista de entrenadores, con el mismo patrón que la de Usuarios.
 *
 * Pedido del cliente al probar la Fase 8: lista paginada en vez de tarjetas,
 * cada fila con su información, y **borde ámbar** en quien está activo y no
 * tiene ninguna disciplina, que es a quien hay que asignar.
 *
 * Un solo markup: desde `md` las columnas; en el teléfono, nombre y acciones
 * en la primera línea y el resto en una línea compacta debajo.
 * "Asignar" solo aparece con la ficha activa — a alguien de baja el backend no
 * le deja asignar nada, y enseñar el botón para que luego falle era el fallo
 * que vio el cliente con Bernard Rosario.
 */
const EntrenadorTable = ({ entrenadores, onVer, onAsignar, orden, dir, onOrdenar }: Props) => {
  return (
    <div className="min-w-0 space-y-2">
      <div className={`${REJILLA} hidden px-4 py-1 text-sm text-muted-foreground md:grid`}>
        <Cabecera clave="nombre" orden={orden} dir={dir} onOrdenar={onOrdenar}>
          Entrenador
        </Cabecera>
        <div className="font-medium">Cédula · teléfono</div>
        <div className="font-medium">Colegios</div>
        <Cabecera clave="disciplinas" orden={orden} dir={dir} onOrdenar={onOrdenar}>
          Disciplinas
        </Cabecera>
        <div className="font-medium">Estado</div>
        <div className="font-medium">Acciones</div>
      </div>

      <ul className="space-y-2">
        {entrenadores.map((e) => {
          const activo = e.est_id === 1;
          const sinDisciplinas = activo && e.disciplinas === 0;
          return (
            <li
              key={e.ent_id}
              className={cn(
                FILA,
                'rounded-lg border bg-card px-3 py-2.5 md:px-4 md:py-3',
                sinDisciplinas && 'border-2 border-amber-500 dark:border-amber-400',
                !activo && 'border-dashed bg-muted/40',
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <Avatar className="h-9 w-9 flex-shrink-0 md:h-10 md:w-10">
                  <AvatarImage src={e.usu_foto_url ?? undefined} alt="" />
                  <AvatarFallback>{iniciales(e.usu_nombre)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-medium" title={e.usu_nombre}>
                    {e.usu_nombre}
                  </div>
                  <div
                    className="truncate text-xs text-muted-foreground md:text-sm"
                    title={e.usu_correo}
                  >
                    {e.usu_correo}
                  </div>
                </div>
              </div>

              {/* En el teléfono todo esto va en una línea compacta bajo el nombre;
                  desde md, `contents` lo disuelve y cada dato vuelve a su columna. */}
              <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs md:contents md:text-sm">
                <div className="min-w-0 text-muted-foreground">
                  <span className="md:block md:truncate">{e.usu_cedula ?? 'Sin cédula'}</span>
                  <span className="md:hidden"> · </span>
                  <span className="md:block md:truncate">{e.usu_telefono ?? 'Sin teléfono'}</span>
                </div>

                <div className="flex min-w-0 flex-wrap gap-1">
                  {e.colegios.length > 0 ? (
                    e.colegios.map((c) => (
                      <Badge key={c.col_id} variant="secondary" className="max-w-full text-xs">
                        <span className="truncate">{c.col_nombre}</span>
                      </Badge>
                    ))
                  ) : (
                    <span
                      className={cn(
                        sinDisciplinas
                          ? 'font-medium text-amber-700 dark:text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      Sin disciplinas
                    </span>
                  )}
                </div>

                <div>
                  <strong>{e.disciplinas}</strong>
                  <span className="text-muted-foreground">
                    <span className="md:hidden"> disc.</span> · {e.alumnos} alumnos
                    {e.auxiliares > 0 &&
                      ` · ${e.auxiliares} ${e.auxiliares === 1 ? 'auxiliar' : 'auxiliares'}`}
                  </span>
                </div>

                <div>
                  <Badge variant={activo ? 'default' : 'secondary'} className="text-xs">
                    {activo ? 'Activo' : 'Inactivo'}
                  </Badge>
                </div>
              </div>

              {/* Acciones: arriba a la derecha en el teléfono, última columna en md. */}
              <div className="col-start-2 row-start-1 flex items-center gap-0.5 md:col-start-auto md:row-start-auto">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 md:h-9 md:w-9"
                  onClick={() => onVer(e)}
                  title="Ver ficha"
                  aria-label={`Ver ficha de ${e.usu_nombre}`}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {activo && (
                  <ConditionalAction module="entrenadores" action="editar">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 md:h-9 md:w-9"
                      onClick={() => onAsignar(e)}
                      title="Asignar disciplinas"
                      aria-label={`Asignar disciplinas a ${e.usu_nombre}`}
                    >
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </ConditionalAction>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default EntrenadorTable;
