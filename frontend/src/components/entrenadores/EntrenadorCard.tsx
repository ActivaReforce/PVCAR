import { AlertTriangle, CalendarDays, GraduationCap, IdCard, UserPlus, Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { Entrenador } from '@/api/entrenadores';

interface Props {
  entrenador: Entrenador;
  onVer: (e: Entrenador) => void;
  onAsignar: (e: Entrenador) => void;
}

const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

/**
 * Tarjeta de un entrenador.
 *
 * Además de lo de siempre (foto, nombre, cédula, colegios y número de
 * disciplinas) enseña **los avisos que el sistema viejo se tragaba**: en los
 * datos reales hay 4 entrenadores cuyo usuario está dado de baja pero siguen
 * con la ficha activa y disciplinas asignadas, y 2 fichas de gente que ya no
 * tiene el rol de Entrenador. Antes se veían como cualquier otro.
 */
const EntrenadorCard = ({ entrenador, onVer, onAsignar }: Props) => {
  const fichaActiva = entrenador.est_id === 1;
  const usuarioDeBaja = entrenador.usuario_est_id !== 1;
  const sinRol = !entrenador.tiene_rol;

  return (
    <Card className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={entrenador.usu_foto_url ?? undefined} alt="" />
            <AvatarFallback>{iniciales(entrenador.usu_nombre)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="break-words font-medium leading-tight">{entrenador.usu_nombre}</p>
            <p className="truncate text-sm text-muted-foreground" title={entrenador.usu_correo}>
              {entrenador.usu_correo}
            </p>
            {entrenador.ent_cedula && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <IdCard className="h-3 w-3 flex-shrink-0" />
                {entrenador.ent_cedula}
              </p>
            )}
          </div>
        </div>

        {(usuarioDeBaja || sinRol || !fichaActiva) && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {usuarioDeBaja && 'El usuario está dado de baja. '}
              {sinRol && 'Ya no tiene el rol de Entrenador. '}
              {!fichaActiva && 'Su ficha de entrenador está inactiva. '}
              {entrenador.disciplinas > 0 && 'Sigue teniendo disciplinas asignadas.'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <strong>{entrenador.disciplinas}</strong> disciplinas
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <strong>{entrenador.alumnos}</strong> alumnos
          </span>
          {entrenador.auxiliares > 0 && (
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-muted-foreground" />
              <strong>{entrenador.auxiliares}</strong> auxiliares
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {entrenador.colegios.length > 0 ? (
            entrenador.colegios.map((c) => (
              <Badge key={c.col_id} variant="secondary" className="max-w-full text-xs">
                <span className="truncate">{c.col_nombre}</span>
              </Badge>
            ))
          ) : (
            <Badge variant="outline" className="text-xs">
              Sin disciplinas asignadas
            </Badge>
          )}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 flex-1 sm:flex-none"
            onClick={() => onVer(entrenador)}
          >
            Ver ficha
          </Button>
          <ConditionalAction module="entrenadores" action="editar">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => onAsignar(entrenador)}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Asignar
            </Button>
          </ConditionalAction>
        </div>
      </CardContent>
    </Card>
  );
};

export default EntrenadorCard;
