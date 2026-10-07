import { Clock, Info } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ESTADO_ASISTENCIA } from '@/api/asistencias';
import type { Borrador } from '@/hooks/useBorradorAsistencia';
import { ORDEN_ESTADOS, PINTA, iniciales } from './estados';

interface Props {
  clave: string;
  nombre: string;
  fotoUrl: string | null;
  /** Grado, disciplinas que imparte, titular del auxiliar… */
  detalle: string | null;
  /** Aviso en ámbar: ya no está inscrito / hoy no da clase aquí. */
  aviso: string | null;
  marca: Borrador;
  sucia: boolean;
  incompleta: boolean;
  /** Quién puso la marca guardada y cuándo. Nulo si no hay ninguna. */
  registro: { por: string | null; en: string | null } | null;
  /** Hora de Ecuador según el servidor, para el botón "Ahora". */
  horaServidor: string;
  onEstado: (clave: string, asisest_id: number) => void;
  onHora: (clave: string, hora: string) => void;
  onRazon: (clave: string, razon: string) => void;
}

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/**
 * Una persona en la lista de asistencia.
 *
 * **El caso de uso es el entrenador con el teléfono en la cancha**, así que la
 * tarjeta manda y la tabla es lo que se deriva: los cuatro estados son botones
 * grandes (44 px, el mínimo táctil) y ocupan toda la fila en 360 px. En el
 * sistema viejo eran un `<Select>` desplegable, y había que abrirlo, buscar la
 * opción y confirmarla, cuarenta veces seguidas.
 *
 * Los campos condicionales aparecen debajo solo cuando toca, y el botón
 * "Ahora" pone la hora **del servidor**, no la del reloj del teléfono.
 */
const FilaAsistencia = ({
  clave,
  nombre,
  fotoUrl,
  detalle,
  aviso,
  marca,
  sucia,
  incompleta,
  registro,
  horaServidor,
  onEstado,
  onHora,
  onRazon,
}: Props) => {
  const esTarde = marca.asisest_id === ESTADO_ASISTENCIA.TARDE;
  const esJustificado = marca.asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO;

  return (
    <li
      className={`px-3 py-3 sm:px-4 ${sucia ? 'bg-muted/40' : ''} ${
        incompleta ? 'border-l-4 border-l-amber-500' : ''
      }`}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarImage src={fotoUrl ?? undefined} alt="" />
            <AvatarFallback>{iniciales(nombre)}</AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="truncate font-medium" title={nombre}>
              {nombre}
            </div>
            {detalle && (
              <div className="truncate text-sm text-muted-foreground" title={detalle}>
                {detalle}
              </div>
            )}
            {aviso && (
              <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{aviso}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:w-[26rem] lg:flex-shrink-0">
          {ORDEN_ESTADOS.map((id) => {
            const pinta = PINTA[id];
            const elegido = marca.asisest_id === id;
            return (
              <Button
                key={id}
                type="button"
                variant="outline"
                aria-pressed={elegido}
                aria-label={`${pinta.etiqueta} — ${nombre}`}
                onClick={() => onEstado(clave, id)}
                className={`h-11 px-1 text-xs font-medium sm:text-sm ${
                  elegido ? `${pinta.lleno} hover:opacity-90` : pinta.suave
                }`}
              >
                <span className="sm:hidden">{pinta.inicial}</span>
                <span className="hidden truncate sm:inline">{pinta.etiqueta}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {(esTarde || esJustificado) && (
        <div className="mt-3 lg:pl-[3.25rem]">
          {esTarde && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <Input
                type="time"
                value={marca.hora}
                onChange={(evento) => onHora(clave, evento.target.value)}
                aria-label={`Hora de llegada de ${nombre}`}
                className="h-11 w-36 sm:h-10"
              />
              <Button
                type="button"
                variant="ghost"
                className="h-11 sm:h-10"
                onClick={() => onHora(clave, horaServidor)}
              >
                Ahora ({horaServidor})
              </Button>
            </div>
          )}

          {esJustificado && (
            <Textarea
              value={marca.razon}
              onChange={(evento) => onRazon(clave, evento.target.value)}
              placeholder="Motivo de la justificación…"
              aria-label={`Motivo de ${nombre}`}
              rows={2}
              className="resize-none"
            />
          )}

          {incompleta && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              {esTarde ? 'Falta la hora de llegada.' : 'Falta el motivo (mínimo 3 letras).'}
            </p>
          )}
        </div>
      )}

      {registro?.en && !sucia && (
        <p className="mt-2 text-xs text-muted-foreground lg:pl-[3.25rem]">
          Registrado por {registro.por ?? 'alguien'} el {fechaCorta(registro.en)}
        </p>
      )}
    </li>
  );
};

export default FilaAsistencia;
