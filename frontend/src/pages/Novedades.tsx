import { useState } from 'react';
import {
  GraduationCap,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Trash2,
  UserCog,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { useEliminarNovedad, useNovedades } from '@/hooks/useNovedades';
import { ZONA } from '@/lib/fecha';
import type { Novedad, TipoNovedad } from '@/api/novedades';
import CrearNovedadDialog from '@/components/novedades/CrearNovedadDialog';
import ConfigCorreo from '@/components/correos/ConfigCorreo';

const TODOS = 'todos';

const ETIQUETA_TIPO: Record<TipoNovedad, string> = {
  general: 'General',
  personal: 'Personal',
  alumno: 'Alumnos',
};

const COLOR_TIPO: Record<TipoNovedad, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  personal: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  alumno: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
};

const ICONO_TIPO: Record<TipoNovedad, typeof Megaphone> = {
  general: Megaphone,
  personal: UserCog,
  alumno: GraduationCap,
};

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleString('es-EC', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: ZONA,
  });

const Novedades = () => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const puedeCrear = hasPermission('novedades', 'crear');
  const puedeEliminar = hasPermission('novedades', 'eliminar');

  const [tipo, setTipo] = useState<TipoNovedad | typeof TODOS>(TODOS);
  const [buscar, setBuscar] = useState('');
  const [crear, setCrear] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<Novedad | null>(null);

  const novedades = useNovedades({
    tipo: tipo === TODOS ? undefined : tipo,
    buscar: buscar.trim() || undefined,
    limit: 100,
  });

  const eliminar = useEliminarNovedad();

  const confirmar = async () => {
    if (!confirmarEliminar) return;
    try {
      await eliminar.mutateAsync(confirmarEliminar.nov_id);
      setConfirmarEliminar(null);
    } catch {
      // toast ya se enseñó
    }
  };

  const lista = novedades.data ?? [];

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Novedades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Avisos e incidencias. Lo que escribas aquí llega por correo al administrador.
          </p>
        </div>
        {puedeCrear && (
          <Button onClick={() => setCrear(true)} className="h-11 sm:h-10">
            <Plus className="mr-2 h-4 w-4" />
            Nueva novedad
          </Button>
        )}
      </div>

      <ConfigCorreo
        tipo="novedades"
        titulo="Correo de Novedades"
        descripcion="Quién recibe el aviso cuando se escribe una novedad."
        conPara
        conNotificarMencionado
        textoNotificarMencionado="Si está activo, las novedades sobre personal avisan también al mencionado, y las de alumno al representante."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar en el texto…"
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        <Select value={tipo} onValueChange={(v) => setTipo(v as TipoNovedad | typeof TODOS)}>
          <SelectTrigger className="h-11 sm:h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los tipos</SelectItem>
            <SelectItem value="general">Generales</SelectItem>
            <SelectItem value="personal">Sobre personal</SelectItem>
            <SelectItem value="alumno">Sobre alumnos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {novedades.isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando…
        </div>
      )}

      {!novedades.isLoading && lista.length === 0 && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">No hay novedades que mostrar.</p>
          {puedeCrear && (
            <p className="mt-1 text-sm">Escribe la primera con el botón de arriba.</p>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {lista.map((n) => {
          const Icono = ICONO_TIPO[n.nov_tipo];
          const esAutor = user?.usu_id === n.autor.usu_id;
          const puedeBorrarEsta = puedeEliminar || esAutor;

          return (
            <li
              key={n.nov_id}
              className="rounded-lg border bg-card p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        COLOR_TIPO[n.nov_tipo]
                      }`}
                    >
                      <Icono className="h-3 w-3" />
                      {ETIQUETA_TIPO[n.nov_tipo]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {fechaCorta(n.nov_fecha_creacion)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-foreground">{n.nov_texto}</p>
                  <p className="text-xs text-muted-foreground">
                    Por <strong className="font-medium text-foreground">{n.autor.usu_nombre}</strong>
                  </p>
                  {n.nov_tipo === 'personal' && n.personas.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Sobre:</span>{' '}
                      {n.personas.map((p) => p.nombre).join(', ')}
                    </p>
                  )}
                  {n.nov_tipo === 'alumno' && n.alumnos.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium">Alumnos:</span>{' '}
                      {n.alumnos
                        .map((a) => `${a.nombre}${a.col_nombre ? ` (${a.col_nombre})` : ''}`)
                        .join(', ')}
                    </p>
                  )}
                </div>
                {puedeBorrarEsta && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmarEliminar(n)}
                    aria-label="Eliminar novedad"
                    className="h-9 self-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <CrearNovedadDialog abierto={crear} onCerrar={() => setCrear(false)} />

      <AlertDialog
        open={confirmarEliminar !== null}
        onOpenChange={(v) => (!v ? setConfirmarEliminar(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra definitivamente. El correo que ya salió no se puede retirar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={eliminar.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmar}
              disabled={eliminar.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Novedades;
