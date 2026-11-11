import { useState } from 'react';
import { LayoutTemplate, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { comunicadosApi, MARCADOR, type Plantilla } from '@/api/comunicados';
import { useAccionComunicados, usePlantillas } from '@/hooks/useComunicados';
import VistaCorreo from './VistaCorreo';
import { previsualizar } from './util';

/**
 * Plantillas: el marco del correo (logo, colores, pie) en HTML, con el
 * marcador {{contenido}} donde va el texto de cada comunicado.
 */

const EJEMPLO = `<p style="margin:0 0 12px"><strong>Así se verá el texto del comunicado.</strong></p><p style="margin:0 0 12px">Un párrafo de ejemplo para ver tamaños, colores y márgenes.</p><table style="border-collapse:collapse;width:100%"><tr><th style="border:1px solid #d0d5dd;padding:6px 10px;background:#f2f4f7">Columna</th><th style="border:1px solid #d0d5dd;padding:6px 10px;background:#f2f4f7">Columna</th></tr><tr><td style="border:1px solid #d0d5dd;padding:6px 10px">Dato</td><td style="border:1px solid #d0d5dd;padding:6px 10px">Dato</td></tr></table>`;

const BASE = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f5">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#1f2937">
    <div style="background:#dc2626;color:#ffffff;padding:20px 24px;font-size:20px;font-weight:bold">Activa Reforce</div>
    <div style="padding:24px">
      {{contenido}}
    </div>
    <div style="padding:16px 24px;background:#f4f4f5;color:#6b7280;font-size:12px;text-align:center">
      Activa Reforce · activareforce.com
    </div>
  </div>
</body>
</html>`;

const FormPlantilla = ({ plantilla, onCerrar }: { plantilla: Plantilla | null; onCerrar: () => void }) => {
  const [nombre, setNombre] = useState(plantilla?.complan_nombre ?? '');
  const [html, setHtml] = useState(plantilla?.complan_html ?? BASE);
  const guardar = useAccionComunicados(
    (d: { nombre: string; html: string }) =>
      plantilla ? comunicadosApi.editarPlantilla(plantilla.complan_id, d) : comunicadosApi.crearPlantilla(d),
    () => 'Plantilla guardada',
  );
  const sinMarcador = !html.includes(MARCADOR);

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent
        className="max-h-[96vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{plantilla ? 'Editar plantilla' : 'Nueva plantilla'}</DialogTitle>
          <DialogDescription>
            Solo el marco: apariencia y estilos. Pon <code className="rounded bg-muted px-1">{MARCADOR}</code> donde va el
            texto de cada comunicado. Los correos leen mejor el estilo escrito en cada etiqueta (style="…") que en un bloque
            &lt;style&gt;.
          </DialogDescription>
        </DialogHeader>
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pla-nombre">Nombre</Label>
              <Input id="pla-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className="h-11 sm:h-10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pla-html">HTML</Label>
              <Textarea
                id="pla-html"
                value={html}
                onChange={(e) => setHtml(e.target.value)}
                spellCheck={false}
                className="min-h-[50vh] font-mono text-xs"
              />
              {sinMarcador && (
                <p className="text-sm text-destructive">Falta {MARCADOR}: sin él no hay dónde poner el texto.</p>
              )}
            </div>
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label>Vista previa</Label>
            <VistaCorreo html={previsualizar(EJEMPLO, html)} className="h-[60vh] min-h-[360px]" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button
            disabled={!nombre.trim() || sinMarcador || guardar.isPending}
            onClick={() => guardar.mutate({ nombre: nombre.trim(), html }, { onSuccess: onCerrar })}
          >
            {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PestanaPlantillas = () => {
  const plantillas = usePlantillas();
  const [editar, setEditar] = useState<Plantilla | null | 'nueva'>(null);
  const [borrar, setBorrar] = useState<Plantilla | null>(null);
  const eliminar = useAccionComunicados(comunicadosApi.borrarPlantilla, () => 'Plantilla borrada');
  const lista = plantillas.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">El marco de los correos. Al escribir un comunicado eliges una, o ninguna.</p>
        <Button className="h-11 sm:h-10" onClick={() => setEditar('nueva')}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {plantillas.isLoading ? (
        <div className="flex justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : lista.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <LayoutTemplate className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p>Aún no hay plantillas. Sin plantilla, el correo sale limpio y centrado.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((p) => (
            <li key={p.complan_id} className="overflow-hidden rounded-lg border bg-card">
              <div className="pointer-events-none h-56 overflow-hidden border-b bg-white">
                <VistaCorreo
                  html={previsualizar(EJEMPLO, p.complan_html)}
                  titulo={`Miniatura de ${p.complan_nombre}`}
                  className="h-[448px] w-[200%] origin-top-left scale-50 rounded-none border-0"
                />
              </div>
              <div className="flex items-center gap-2 p-3">
                <p className="min-w-0 flex-1 break-words font-medium">{p.complan_nombre}</p>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Editar" onClick={() => setEditar(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Borrar"
                  onClick={() => setBorrar(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editar && <FormPlantilla plantilla={editar === 'nueva' ? null : editar} onCerrar={() => setEditar(null)} />}

      <AlertDialog open={borrar !== null} onOpenChange={(v) => !v && setBorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar la plantilla «{borrar?.complan_nombre}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Los comunicados ya enviados no cambian. Un borrador que la use se quedará sin plantilla.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (borrar) eliminar.mutate(borrar.complan_id);
                setBorrar(null);
              }}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PestanaPlantillas;
