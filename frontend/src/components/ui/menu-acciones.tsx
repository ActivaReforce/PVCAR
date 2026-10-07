import { type ComponentType, type ReactNode } from 'react';
import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { usePermissions } from '@/hooks/usePermissions';

export interface AccionDeMenu {
  /** Texto del elemento. Es lo que lee quien usa el menú, así que va en claro. */
  etiqueta: string;
  icono: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /** Permiso que hace falta. Sin él, el elemento no se pinta. */
  modulo: string;
  accion: 'crear' | 'editar' | 'eliminar';
  /** Rojo y separado del resto: borrar, dar de baja. */
  destructivo?: boolean;
  /** Para ocultar una acción por estado, no por permiso (p. ej. reactivar algo que ya está activo). */
  visible?: boolean;
}

interface Props {
  /** Nombre de lo que se administra. Va al aria-label: "Ajustes de Innova Quitumbe". */
  nombre: string;
  acciones: AccionDeMenu[];
  children?: ReactNode;
}

/**
 * El menú de ajustes de una tarjeta.
 *
 * ---------------------------------------------------------------------------
 * Por qué una tuerca y no los botones sueltos
 *
 * Antes cada tarjeta llevaba sus acciones a la vista: dos botones con texto en
 * Colegios y Actividades, y filas de tres o cuatro botones de icono en
 * Disciplinas, Evaluaciones y Estudiantes. Con veinte tarjetas en pantalla eso
 * son ochenta controles compitiendo con el contenido, que es lo que la persona
 * ha venido a leer. Y los destructivos estaban al mismo nivel visual que los
 * demás: "Eliminar" a un clic, del mismo tamaño que "Editar".
 *
 * Ahora hay un solo control por tarjeta. Editar y eliminar siguen a la misma
 * distancia real —un clic para abrir, otro para elegir— pero dejan de gritar,
 * y lo destructivo queda separado por una línea y en rojo, que es lo que se
 * espera de un menú.
 *
 * ---------------------------------------------------------------------------
 * Dos detalles que importan
 *
 * **Si no hay ninguna acción permitida, no se pinta nada.** Una tuerca que al
 * abrirse está vacía es peor que no tenerla: promete algo que no existe. Por
 * eso el filtro por permiso ocurre aquí y no dentro de cada elemento.
 *
 * **El aria-label nombra la tarjeta.** Veinte tuercas idénticas no le dicen
 * nada a un lector de pantalla; "Ajustes de Innova Quitumbe" sí.
 */
const MenuAcciones = ({ nombre, acciones, children }: Props) => {
  const { hasPermission } = usePermissions();

  const permitidas = acciones.filter(
    (a) => a.visible !== false && hasPermission(a.modulo, a.accion),
  );

  if (permitidas.length === 0) return null;

  const normales = permitidas.filter((a) => !a.destructivo);
  const destructivas = permitidas.filter((a) => a.destructivo);

  const pintar = (accion: AccionDeMenu) => {
    const Icono = accion.icono;
    return (
      <DropdownMenuItem
        key={accion.etiqueta}
        onSelect={accion.onSelect}
        className={`min-h-11 cursor-pointer gap-2 md:min-h-0 ${
          accion.destructivo ? 'text-destructive focus:text-destructive' : ''
        }`}
      >
        <Icono className="h-4 w-4" />
        {accion.etiqueta}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground hover:text-foreground md:h-9 md:w-9"
          aria-label={`Ajustes de ${nombre}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Settings2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {children}
        {normales.map(pintar)}
        {normales.length > 0 && destructivas.length > 0 && <DropdownMenuSeparator />}
        {destructivas.map(pintar)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default MenuAcciones;
