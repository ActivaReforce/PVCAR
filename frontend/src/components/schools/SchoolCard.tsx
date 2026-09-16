import { CalendarDays, GraduationCap, Mail, MapPin, Pencil, Phone, Trash2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import type { ColegioListado } from '@/api/colegios';

interface Props {
  colegio: ColegioListado;
  onEdit: (colegio: ColegioListado) => void;
  onDelete: (colegio: ColegioListado) => void;
}

/**
 * Tarjeta de un colegio.
 *
 * Tres cosas cambian respecto a la del sistema viejo:
 *
 *  - **Se ve en modo oscuro.** La anterior pintaba un degradado claro fijo
 *    (`from-blue-50`) con texto `text-gray-900` encima y ciclaba ocho colores
 *    por posicion en la lista: en oscuro quedaba texto negro sobre fondo
 *    claro, y el color de cada tarjeta cambiaba al pasar de pagina. Aqui van
 *    tokens del tema.
 *  - **No hay que desplegarla para ver lo importante.** Antes la direccion y
 *    el contacto estaban escondidos tras un clic.
 *  - **Dice cuanto cuelga del colegio** — disciplinas y alumnos, contados en
 *    SQL. Es lo que decide si se puede borrar o no, y verlo antes ahorra el
 *    intento.
 */
const SchoolCard = ({ colegio, onEdit, onDelete }: Props) => {
  const iniciales = (colegio.col_rep_nombre ?? colegio.col_nombre)
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="space-y-3 pb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight break-words">
            {colegio.col_nombre}
          </h3>
          <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
            <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span className="break-words">{colegio.col_direccion}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <strong>{colegio.disciplinas}</strong> disciplinas
          </span>
          <span className="flex items-center gap-1.5">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <strong>{colegio.estudiantes}</strong> alumnos
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <div className="space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Coordinadores
          </p>
          <div className="flex flex-wrap gap-1">
            {colegio.coordinadores.length > 0 ? (
              colegio.coordinadores.map((c) => (
                <Badge key={c.usu_id} variant="secondary" className="max-w-full text-xs">
                  <span className="truncate">{c.usu_nombre}</span>
                </Badge>
              ))
            ) : (
              <Badge variant="outline" className="text-xs">
                Sin coordinador
              </Badge>
            )}
          </div>
        </div>

        {(colegio.col_rep_nombre || colegio.col_rep_email || colegio.col_rep_telefono) && (
          <div className="flex items-start gap-3 rounded-md border p-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={colegio.col_rep_foto_url ?? undefined} alt="" />
              <AvatarFallback>{iniciales}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium" title={colegio.col_rep_nombre ?? ''}>
                {colegio.col_rep_nombre ?? 'Contacto del colegio'}
              </p>
              {colegio.col_rep_email && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate" title={colegio.col_rep_email}>
                    {colegio.col_rep_email}
                  </span>
                </p>
              )}
              {colegio.col_rep_telefono && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{colegio.col_rep_telefono}</span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Las acciones quedan abajo del todo, alineadas entre tarjetas. */}
        <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">
          <ConditionalAction module="colegios" action="editar">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 flex-1 sm:flex-none"
              onClick={() => onEdit(colegio)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </Button>
          </ConditionalAction>
          <ConditionalAction module="colegios" action="eliminar">
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 flex-1 text-destructive hover:text-destructive sm:flex-none"
              onClick={() => onDelete(colegio)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar
            </Button>
          </ConditionalAction>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchoolCard;
