import { Link, useSearchParams } from 'react-router-dom';
import { Archive, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import ResumenHistorico from '@/components/historico/ResumenHistorico';
import ExploradorHistorico from '@/components/historico/ExploradorHistorico';
import { useAuth } from '@/contexts/AuthContext';
import { useExportarHistorico } from '@/hooks/useHistorico';
import { ROL } from '@/hooks/useUserForm';

const GLOBALES: number[] = [ROL.PROPIETARIO, ROL.ADMIN];

/**
 * Data anterior: lo que hubo en la plataforma vieja.
 *
 * Es el esquema `archivo` —una copia congelada del 2026-10-01, cuando la
 * empresa decidió arrancar la plataforma nueva desde cero— y no se mezcla con
 * nada de lo de hoy. Dos pestañas: un **Resumen** con las cifras y las
 * gráficas, y **Datos**, donde se ve cada tabla entera con filtros, orden y
 * exportación a Excel.
 *
 * La pestaña y el conjunto van en la URL, para que "atrás" y un enlace
 * compartido lleven al mismo sitio.
 */
const DataAnterior = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const exportar = useExportarHistorico();

  const vista = params.get('vista') === 'datos' ? 'datos' : 'resumen';
  const conjunto = params.get('conjunto') ?? 'alumnos';

  const ir = (cambios: Record<string, string>) =>
    setParams((p) => {
      const nuevo = new URLSearchParams(p);
      for (const [k, v] of Object.entries(cambios)) nuevo.set(k, v);
      return nuevo;
    });

  const esGlobal = user?.roles.some((r) => GLOBALES.includes(r.rol_id)) ?? false;

  if (!esGlobal) {
    return (
      <div className="container mx-auto space-y-4 p-6">
        <p className="text-muted-foreground">Data anterior solo está disponible para Propietario y Admin.</p>
        <Button asChild variant="outline">
          <Link to="/reportes">Volver a Reportes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <Button asChild variant="ghost" className="-ml-3 mb-1 h-8">
            <Link to="/reportes">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Reportes
            </Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground sm:text-3xl">
            <Archive className="h-6 w-6 flex-shrink-0 text-muted-foreground" />
            Data anterior
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todo lo que se registró en la plataforma anterior, de octubre de 2025 a septiembre de 2026.
            Solo consulta: no se edita y no se mezcla con los datos de hoy.
          </p>
        </div>

        <ConditionalAction module="reportes" action="crear">
          <Button
            variant="outline"
            className="h-11 w-full flex-shrink-0 sm:h-10 sm:w-auto"
            disabled={exportar.isPending}
            onClick={() => exportar.mutate('todo')}
          >
            {exportar.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Descargar todo en Excel
          </Button>
        </ConditionalAction>
      </div>

      <Tabs value={vista} onValueChange={(v) => ir({ vista: v })}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="resumen" className="flex-1 sm:flex-none">
            Resumen
          </TabsTrigger>
          <TabsTrigger value="datos" className="flex-1 sm:flex-none">
            Datos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen" className="mt-6">
          <ResumenHistorico />
        </TabsContent>
        <TabsContent value="datos" className="mt-6">
          <ExploradorHistorico conjuntoId={conjunto} onElegir={(id) => ir({ conjunto: id })} />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground">
        No se guardaron en esta copia las contraseñas, la información de salud ni las notas de los
        alumnos, sus cédulas ni las fotos. Encuestas y Representantes no tuvieron ningún dato en la
        plataforma anterior.
      </p>
    </div>
  );
};

export default DataAnterior;
