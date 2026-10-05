import { useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, Copy, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DebouncedSearchInput from '@/components/ui/debounced-search-input';
import { useToast } from '@/hooks/use-toast';
import { useInscripciones } from '@/hooks/useInscripciones';
import { dinero, type EstadoInscripcion } from '@/api/inscripciones';
import FichaInscripcion from '@/components/inscripciones/FichaInscripcion';
import DocumentosLegales from '@/components/inscripciones/DocumentosLegales';
import MembreteIva from '@/components/inscripciones/MembreteIva';
import { fechaHora } from '@/components/inscripciones/formato';

const TODAS = 'todas';

/**
 * Inscripciones (Fase 14B). Solo Propietario.
 *
 * Los representantes se inscriben solos desde el formulario público que les
 * llega por correo. Aquí se revisa cada envío —datos, contrato y comprobante—
 * y se aprueba (nacen la cuenta y los alumnos) o se rechaza (se borra).
 */
const Inscripciones = () => {
  const { toast } = useToast();
  const [estado, setEstado] = useState<string>('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(1);
  const [abierta, setAbierta] = useState<number | null>(null);

  const lista = useInscripciones({
    estado: estado === TODAS ? undefined : (estado as EstadoInscripcion),
    buscar: busqueda || undefined,
    page: pagina,
  });

  const enlace = `${window.location.origin}/inscripcion`;
  const copiarEnlace = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      toast({ title: 'Enlace copiado', description: enlace });
    } catch {
      toast({ title: 'Copia el enlace a mano', description: enlace });
    }
  };

  const datos = lista.data;
  const items = datos?.items ?? [];

  return (
    <div className="container mx-auto min-w-0 max-w-5xl space-y-6 p-4 lg:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground sm:text-3xl">Inscripciones</h1>
          {datos && (
            <p className="mt-1 text-sm text-muted-foreground">
              {datos.conteos.pendientes} pendiente{datos.conteos.pendientes === 1 ? '' : 's'} ·{' '}
              {datos.conteos.aprobadas} aprobada{datos.conteos.aprobadas === 1 ? '' : 's'}
            </p>
          )}
        </div>
        <Button variant="outline" className="h-11 sm:h-10" onClick={copiarEnlace}>
          <Copy className="mr-2 h-4 w-4" /> Copiar enlace del formulario
        </Button>
      </div>

      <Tabs defaultValue="inscripciones">
        {/* Cuatro pestañas no caben en 360 px: la fila se desplaza en vez de partirse. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="inscripciones">Inscripciones</TabsTrigger>
            <TabsTrigger value="documentos">Documentos</TabsTrigger>
            <TabsTrigger value="membrete">Membrete e IVA</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inscripciones" className="space-y-4 pt-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <DebouncedSearchInput
              placeholder="Buscar por representante, cédula, correo o alumno..."
              value={busqueda}
              onChange={(v) => {
                setBusqueda(v);
                setPagina(1);
              }}
              className="w-full sm:col-span-2"
            />
            <Select
              value={estado}
              onValueChange={(v) => {
                setEstado(v);
                setPagina(1);
              }}
            >
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendiente">Pendientes</SelectItem>
                <SelectItem value="aprobada">Aprobadas</SelectItem>
                <SelectItem value={TODAS}>Todas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {lista.isLoading && !datos && (
            <p className="py-8 text-center text-muted-foreground">Cargando inscripciones…</p>
          )}
          {lista.isError && (
            <p className="text-destructive">
              No se pudieron cargar: {(lista.error as Error).message}
            </p>
          )}

          {datos && items.length === 0 && (
            <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
              <ClipboardList className="mx-auto mb-3 h-10 w-10 opacity-50" />
              <p className="text-lg">
                {estado === 'pendiente' && !busqueda
                  ? 'No hay inscripciones por revisar'
                  : 'No hay inscripciones con ese filtro'}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm">
                Llegan desde el formulario público. Comparte el enlace con los representantes.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <ul className="divide-y overflow-hidden rounded-lg border">
              {items.map((i) => (
                <li key={i.ins_id}>
                  <button
                    type="button"
                    onClick={() => setAbierta(i.ins_id)}
                    className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium" title={i.representante_nombre}>
                        {i.representante_nombre}
                      </div>
                      <div className="truncate text-sm text-muted-foreground">
                        {i.ninos.join(', ')}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {i.representante_correo} · {i.representante_telefono}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0 sm:justify-end">
                      {i.usuario_existente && (
                        <Badge variant="outline" className="gap-1">
                          <UserCheck className="h-3 w-3" /> Ya tiene cuenta
                        </Badge>
                      )}
                      {i.total !== null && (
                        <span className="text-sm font-medium" title="Al mes, con IVA">
                          {dinero(i.total)}
                        </span>
                      )}
                      <Badge variant={i.ins_estado === 'pendiente' ? 'secondary' : 'default'}>
                        {i.ins_estado === 'pendiente' ? 'Pendiente' : 'Aprobada'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fechaHora(i.ins_fecha)}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {datos && datos.totalPages > 1 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Página {datos.page} de {datos.totalPages} · {datos.total} en total
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Página anterior"
                  disabled={datos.page <= 1}
                  onClick={() => setPagina((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Página siguiente"
                  disabled={datos.page >= datos.totalPages}
                  onClick={() => setPagina((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="documentos" className="pt-2">
          <DocumentosLegales />
        </TabsContent>

        <TabsContent value="membrete" className="pt-2">
          <MembreteIva />
        </TabsContent>
      </Tabs>

      <FichaInscripcion id={abierta} onClose={() => setAbierta(null)} />
    </div>
  );
};

export default Inscripciones;
