import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  CheckCircle2,
  GraduationCap,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Trash2,
  UserCog,
  UserX,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useEliminarNovedad, useMarcarNovedadesVistas, useNovedades } from '@/hooks/useNovedades';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES_GLOBALES } from '@/hooks/useUserForm';
import { ZONA } from '@/lib/fecha';
import type { Novedad, TipoNovedad } from '@/api/novedades';
import CrearNovedadDialog from '@/components/novedades/CrearNovedadDialog';
import ConfigCorreo, { type Aviso } from '@/components/correos/ConfigCorreo';

const TODOS = 'todos';

const ETIQUETA_TIPO: Record<TipoNovedad, string> = {
  general: 'General',
  personal: 'Personal',
  representante: 'Representantes',
  alumno: 'Alumnos',
  ausencia: 'Ausencia',
  correccion: 'Corrección',
};

const COLOR_TIPO: Record<TipoNovedad, string> = {
  general: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  personal: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  representante: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  alumno: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  ausencia: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
  correccion: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200',
};

const ICONO_TIPO: Record<TipoNovedad, typeof Megaphone> = {
  general: Megaphone,
  personal: UserCog,
  representante: Users,
  alumno: GraduationCap,
  ausencia: UserX,
  correccion: CheckCircle2,
};

const AVISOS_NOVEDADES: Aviso[] = [
  { campo: 'notificar_mencionado', texto: 'Las novedades sobre personal avisan también al mencionado' },
  {
    campo: 'notificar_representante',
    texto: 'Las novedades sobre un alumno o un representante avisan también al representante',
  },
];

const AVISOS_AUSENCIAS: Aviso[] = [
  {
    campo: 'notificar_representante',
    texto:
      'La notificación de ausencia del alumno se avisa también al representante (correo y en sus Novedades)',
  },
];

/** 2026-10-12 → 12/10/2026 */
const fechaLegible = (fecha: string) => fecha.split('-').reverse().join('/');

/** Ficha de una ausencia o corrección: la clase, el alumno y su representante. */
const DetalleClase = ({ n }: { n: Novedad }) => {
  const d = n.datos;
  if (!d) return null;
  const alumno = n.alumnos[0];
  const filas: Array<[string, string]> = [
    ['Alumno', alumno?.nombre ?? '—'],
    ['Colegio', d.colegio],
    ['Disciplina', d.actividad],
    ['Clase', `${d.dia ? `${d.dia} ` : ''}${fechaLegible(d.fecha)}${d.horario ? ` · ${d.horario}` : ''}`],
    ['Asistencia', d.estado + (d.hora_tarde ? ` · llegó ${d.hora_tarde}` : '')],
    ...(d.razon ? ([['Motivo', d.razon]] as Array<[string, string]>) : []),
  ];
  const representantes = alumno?.representantes ?? [];
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md bg-muted/50 p-3 text-xs">
      {filas.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-muted-foreground">{k}</dt>
          <dd className="break-words text-foreground">{v}</dd>
        </div>
      ))}
      <dt className="font-medium text-muted-foreground">Representante</dt>
      <dd className="min-w-0 space-y-0.5 text-foreground">
        {representantes.length === 0
          ? 'Sin representante activo'
          : representantes.map((r) => (
              <p key={`${r.nombre}-${r.correo ?? ''}`} className="break-words">
                {r.nombre}
                {r.telefono && (
                  <>
                    {' · '}
                    <a href={`tel:${r.telefono}`} className="underline underline-offset-2">
                      {r.telefono}
                    </a>
                  </>
                )}
                {r.correo && <span className="text-muted-foreground"> · {r.correo}</span>}
              </p>
            ))}
      </dd>
    </dl>
  );
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

/**
 * Con la casilla Editar, dos pestañas como en Inscripciones; sin ella, la
 * lista a secas (una sola pestaña no aporta nada).
 */
const Pestanas = ({
  conConfig,
  config,
  children,
}: {
  conConfig: boolean;
  config: ReactNode;
  children: ReactNode;
}) =>
  conConfig ? (
    <Tabs defaultValue="novedades">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          <TabsTrigger value="novedades">Novedades</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="novedades" className="space-y-6 pt-2">
        {children}
      </TabsContent>
      <TabsContent value="configuracion" className="pt-2">
        {config}
      </TabsContent>
    </Tabs>
  ) : (
    <div className="space-y-6">{children}</div>
  );

const Novedades = () => {
  const { hasPermission } = usePermissions();
  const puedeCrear = hasPermission('novedades', 'crear');
  const puedeEliminar = hasPermission('novedades', 'eliminar');
  const puedeConfigurar = hasPermission('novedades', 'editar');

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

  /**
   * Lo que llega a la pantalla cuenta como visto (solo Propietario y Admin):
   * se manda la fecha de la más reciente de la lista, no "ahora", para no dar
   * por vista una que entre mientras tanto. Solo se llama si avanza.
   */
  const { user } = useAuth();
  const esGlobal = user?.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id)) ?? false;
  const marcarVisto = useMarcarNovedadesVistas();
  const ultimaMarcada = useRef('');
  const masReciente = novedades.data?.[0]?.nov_fecha_creacion;
  useEffect(() => {
    if (!esGlobal || !masReciente || masReciente <= ultimaMarcada.current) return;
    ultimaMarcada.current = masReciente;
    marcarVisto.mutate(masReciente);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate es estable
  }, [esGlobal, masReciente]);

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

      <Pestanas
        conConfig={puedeConfigurar}
        config={
          <div className="space-y-6">
            <ConfigCorreo
              tipo="novedades"
              titulo="Correo de Novedades"
              descripcion="Quién recibe el aviso cuando se escribe una novedad."
              conPara
              avisos={AVISOS_NOVEDADES}
            />
            <ConfigCorreo
              tipo="ausencias"
              titulo="Notificación por ausencia en asistencias de alumnos"
              descripcion="Al guardar la asistencia, cada alumno marcado Ausente genera un aviso; si después se corrige a Presente, Tarde o Justificado, sale otro con la corrección. Solo clases de hoy y de los 7 días anteriores."
              conPara
              avisos={AVISOS_AUSENCIAS}
            />
          </div>
        }
      >
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
              <SelectItem value="representante">Sobre representantes</SelectItem>
              <SelectItem value="alumno">Sobre alumnos</SelectItem>
              <SelectItem value="ausencia">Ausencias</SelectItem>
              <SelectItem value="correccion">Correcciones de ausencia</SelectItem>
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
                    {/* Llega en null a quien no tiene Eliminar: el backend lo oculta. */}
                    {n.autor && (
                      <p className="text-xs text-muted-foreground">
                        Por <strong className="font-medium text-foreground">{n.autor.usu_nombre}</strong>
                      </p>
                    )}
                    {(n.nov_tipo === 'personal' || n.nov_tipo === 'representante') &&
                      n.personas.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Sobre:</span>{' '}
                        {n.personas.map((p) => p.nombre).join(', ')}
                      </p>
                    )}
                    <DetalleClase n={n} />
                    {n.nov_tipo === 'alumno' && n.alumnos.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Alumnos:</span>{' '}
                        {n.alumnos
                          .map((a) => `${a.nombre}${a.col_nombre ? ` (${a.col_nombre})` : ''}`)
                          .join(', ')}
                      </p>
                    )}
                  </div>
                  {puedeEliminar && (
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
      </Pestanas>

      <CrearNovedadDialog abierto={crear} onCerrar={() => setCrear(false)} />

      <AlertDialog
        open={confirmarEliminar !== null}
        onOpenChange={(v) => (!v ? setConfirmarEliminar(null) : undefined)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta novedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de verse aquí, pero queda guardada en Reportes → Novedades. El correo que ya salió no se puede retirar.
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
