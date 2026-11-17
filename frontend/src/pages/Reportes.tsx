import { Link } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  Calendar,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Megaphone,
  MessageSquare,
  School,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  Users2,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCatalogoReportes } from '@/hooks/useTablero';
import { PAGOS } from '@/api/reportes';
import { useAuth } from '@/contexts/AuthContext';
import { ROLES_GLOBALES } from '@/hooks/useUserForm';

/** El ícono de cada reporte: el mismo de su módulo en el menú. */
const ICONOS: Record<string, LucideIcon> = {
  usuarios: Users,
  colegios: School,
  actividades: BookOpen,
  disciplinas: Calendar,
  entrenadores: UserCog,
  estudiantes: GraduationCap,
  evaluaciones: ClipboardList,
  'asistencias-alumnos': UserCheck,
  'asistencias-entrenadores': Users2,
  representantes: UserRound,
  encuestas: MessageSquare,
  novedades: Megaphone,
};

interface Tarjeta {
  id: string;
  titulo: string;
  descripcion: string;
  ruta: string;
  icono: LucideIcon;
}

/**
 * Índice de Reportes.
 *
 * La lista **la decide el backend**: solo salen los reportes para los que se
 * tiene el permiso del módulo de origen. Tarjetas pequeñas (2026-11-16): el
 * ícono y el nombre; la descripción, al pasar el cursor.
 */
const Reportes = () => {
  const catalogo = useCatalogoReportes();
  const { user } = useAuth();
  const esGlobal = user?.roles.some((r) => ROLES_GLOBALES.includes(r.rol_id)) ?? false;

  if (catalogo.isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-lg">Cargando reportes...</div>
      </div>
    );
  }

  if (catalogo.isError) {
    return (
      <div className="container mx-auto p-6">
        <p className="text-destructive">
          No se pudieron cargar los reportes: {(catalogo.error as Error).message}
        </p>
      </div>
    );
  }

  const reportes = catalogo.data ?? [];
  const tarjetas: Tarjeta[] = [];
  for (const r of reportes) {
    if (PAGOS.reportes.includes(r.id)) {
      if (!tarjetas.some((t) => t.id === PAGOS.id)) {
        tarjetas.push({ ...PAGOS, ruta: '/reportes/pagos', icono: Wallet });
      }
      continue;
    }
    tarjetas.push({
      id: r.id,
      titulo: r.titulo,
      descripcion: r.descripcion,
      ruta: `/reportes/${r.id}`,
      icono: ICONOS[r.id] ?? FileSpreadsheet,
    });
  }
  if (esGlobal) {
    // La plataforma anterior: solo para quien lo ve todo (el backend lo vuelve a exigir).
    tarjetas.push({
      id: 'data-anterior',
      titulo: 'Data anterior',
      descripcion:
        'Todo lo de la plataforma anterior (oct 2025 – sep 2026): cifras, gráficas, cada tabla con filtros y exportación a Excel.',
      ruta: '/reportes/data-anterior',
      icono: Archive,
    });
  }

  return (
    <div className="container mx-auto min-w-0 max-w-5xl space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Reportes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada reporte se ve en pantalla y se puede bajar en Excel. Todos respetan tu alcance.
        </p>
      </div>

      {tarjetas.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg">No tienes ningún reporte disponible</p>
            <p className="mt-2 text-sm">Cada reporte necesita el permiso de ver su módulo de origen.</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tarjetas.map((t) => (
          <Tooltip key={t.id}>
            <TooltipTrigger asChild>
              <Link
                to={t.ruta}
                aria-label={`${t.titulo}: ${t.descripcion}`}
                className={`flex min-h-12 items-center gap-2.5 rounded-lg border bg-card px-3 py-2.5 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-muted/40 ${
                  t.id === 'data-anterior' ? 'border-amber-300/70 dark:border-amber-700/60' : ''
                }`}
              >
                <t.icono className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span className="min-w-0 truncate">{t.titulo}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{t.descripcion}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  );
};

export default Reportes;
