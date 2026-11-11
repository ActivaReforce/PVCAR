import { lazy, Suspense, useState } from 'react';
import { Lock, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { ROL } from '@/hooks/useUserForm';
import ConfigCorreo from '@/components/correos/ConfigCorreo';
import PestanaComunicados from '@/components/comunicados/PestanaComunicados';
import PestanaContactos from '@/components/comunicados/PestanaContactos';
import PestanaPlantillas from '@/components/comunicados/PestanaPlantillas';
import PestanaRepresentantes from '@/components/comunicados/PestanaRepresentantes';

/** El editor (TipTap) pesa: se carga al abrir un comunicado, no con la página. */
const ComunicadoEditor = lazy(() => import('@/components/comunicados/ComunicadoEditor'));

/**
 * Comunicados (2026-11-11): correos masivos a representantes y contactos por
 * Resend Broadcasts, sin entrar a Resend. Solo el rol Propietario.
 * Diseño en docs/comunicados.md.
 */

const Comunicados = () => {
  const { user } = useAuth();
  const esPropietario = user?.roles.some((r) => r.rol_id === ROL.PROPIETARIO) ?? false;
  /** null cerrado, 'nuevo' o el id del borrador. */
  const [abierto, setAbierto] = useState<number | 'nuevo' | null>(null);

  if (!esPropietario) {
    return (
      <div className="container mx-auto p-4 lg:p-6">
        <div className="rounded-lg border border-dashed py-16 text-center text-muted-foreground">
          <Lock className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p>Comunicados es solo del Propietario.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Comunicados</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Correos a representantes y contactos, hasta 1.000 por envío.
          </p>
        </div>
        <Button onClick={() => setAbierto('nuevo')} className="h-11 sm:h-10">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo comunicado
        </Button>
      </div>

      <Tabs defaultValue="comunicados">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="comunicados">Comunicados</TabsTrigger>
            <TabsTrigger value="contactos">Contactos</TabsTrigger>
            <TabsTrigger value="representantes">Representantes</TabsTrigger>
            <TabsTrigger value="plantillas">Plantillas</TabsTrigger>
            <TabsTrigger value="configuracion">Configuración</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="comunicados" className="pt-2">
          <PestanaComunicados onAbrir={setAbierto} />
        </TabsContent>
        <TabsContent value="contactos" className="pt-2">
          <PestanaContactos />
        </TabsContent>
        <TabsContent value="representantes" className="pt-2">
          <PestanaRepresentantes />
        </TabsContent>
        <TabsContent value="plantillas" className="pt-2">
          <PestanaPlantillas />
        </TabsContent>
        <TabsContent value="configuracion" className="pt-2">
          <ConfigCorreo
            tipo="comunicados"
            titulo="Remitente de los comunicados"
            descripcion="Un solo remitente para todos los comunicados y la dirección a la que llegan las respuestas."
            sinCopias
          />
        </TabsContent>
      </Tabs>

      {abierto !== null && (
        <Suspense fallback={null}>
          <ComunicadoEditor
            key={String(abierto)}
            id={abierto === 'nuevo' ? null : abierto}
            onCerrar={() => setAbierto(null)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default Comunicados;
