import { useEffect, useRef, useState } from 'react';
import { ImageUp, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { useToast } from '@/hooks/use-toast';
import {
  useConfigInscripciones,
  useGuardarIva,
  useRestaurarMembrete,
  useSubirMembrete,
} from '@/hooks/useInscripciones';

/** Hasta 700 KB: lo mismo que acepta el backend. */
const BYTES_MAX = 700 * 1024;

function aBase64(archivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(archivo);
  });
}

/**
 * El membrete de los PDF y el IVA (pedido del cliente, 2026-10-05).
 *
 * El membrete es la franja de arriba de cada página, la de sus Word: va de
 * borde a borde, así que conviene una imagen apaisada (unos 1240 × 280 px).
 * Cambiarlo afecta a los PDF que se generen desde ese momento; los ya
 * enviados no cambian, están guardados con su huella.
 */
const MembreteIva = () => {
  const config = useConfigInscripciones();
  const subir = useSubirMembrete();
  const restaurar = useRestaurarMembrete();
  const guardarIva = useGuardarIva();
  const { toast } = useToast();
  const archivo = useRef<HTMLInputElement>(null);
  const [iva, setIva] = useState('');

  useEffect(() => {
    if (config.data) setIva(String(config.data.iva_pct));
  }, [config.data]);

  if (config.isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (config.isError || !config.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudo cargar la configuración: {(config.error as Error | null)?.message}
      </p>
    );
  }

  const nIva = Number(iva.replace(',', '.'));
  const ivaValido = iva.trim() !== '' && Number.isFinite(nIva) && nIva >= 0 && nIva <= 100;

  const elegir = async (f: File | undefined) => {
    if (!f) return;
    if (!['image/png', 'image/jpeg'].includes(f.type)) {
      toast({ title: 'Formato no admitido', description: 'Sube una imagen PNG o JPEG.', variant: 'destructive' });
      return;
    }
    if (f.size > BYTES_MAX) {
      toast({ title: 'Imagen demasiado pesada', description: 'Como mucho 700 KB.', variant: 'destructive' });
      return;
    }
    subir.mutate({ mime: f.type, base64: await aBase64(f) });
  };

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">Membrete</h2>
          <Badge variant="outline">{config.data.membrete_propio ? 'Propio' : 'De serie (el de los Word)'}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Sale arriba de cada página de los documentos, de borde a borde. Usa una imagen apaisada de unos
          1240 × 280 píxeles, PNG o JPEG, de hasta 700 KB. El cambio vale para los PDF que se generen desde
          ahora; los ya enviados no cambian.
        </p>
        {config.data.membrete_data_url && (
          <div className="overflow-hidden rounded-md border bg-white">
            <img src={config.data.membrete_data_url} alt="Membrete actual" className="w-full" />
          </div>
        )}
        <ConditionalAction module="inscripciones" action="editar">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="h-11 sm:h-10" onClick={() => archivo.current?.click()} disabled={subir.isPending}>
              <ImageUp className="mr-2 h-4 w-4" />
              {subir.isPending ? 'Subiendo…' : 'Cambiar membrete'}
            </Button>
            {config.data.membrete_propio && (
              <Button
                variant="outline"
                className="h-11 sm:h-10"
                onClick={() => restaurar.mutate(undefined)}
                disabled={restaurar.isPending}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Volver al de serie
              </Button>
            )}
          </div>
          <input
            ref={archivo}
            type="file"
            accept="image/png,image/jpeg"
            className="sr-only"
            onChange={(e) => {
              void elegir(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </ConditionalAction>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">IVA</h2>
        <p className="text-sm text-muted-foreground">
          Se suma a la tarifa de cada alumno, ya con su descuento, y el representante ve el total con IVA. Las
          inscripciones ya enviadas conservan el que tenían.
        </p>
        <ConditionalAction module="inscripciones" action="editar">
          <div className="flex max-w-xs items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="iva">IVA (%)</Label>
              <Input
                id="iva"
                inputMode="decimal"
                value={iva}
                onChange={(e) => setIva(e.target.value)}
                className="h-11 sm:h-10"
              />
            </div>
            <Button
              className="h-11 sm:h-10"
              disabled={!ivaValido || nIva === config.data.iva_pct || guardarIva.isPending}
              onClick={() => guardarIva.mutate(nIva)}
            >
              Guardar
            </Button>
          </div>
        </ConditionalAction>
      </section>
    </div>
  );
};

export default MembreteIva;
