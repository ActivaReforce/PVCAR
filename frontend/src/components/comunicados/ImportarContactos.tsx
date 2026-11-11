import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { comunicadosApi, type RevisionImportacion } from '@/api/comunicados';
import { mensajeDe, useAccionComunicados, useSegmentos } from '@/hooks/useComunicados';

/**
 * Importar contactos de un Excel o CSV en dos pasos: el servidor lee el
 * archivo y lo reparte (nuevos, repetidos, ya existentes, mal escritos) y,
 * solo tras revisar, se confirma. Nada se guarda en el primer paso.
 */

const MAX_BYTES = 4 * 1024 * 1024;
const NINGUNO = 'ninguno';
const NUEVO = 'nuevo';

const aBase64 = (archivo: File) =>
  new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result).split(',')[1] ?? '');
    lector.onerror = () => reject(new Error('No se pudo leer el archivo'));
    lector.readAsDataURL(archivo);
  });

const Grupo = ({
  icono,
  titulo,
  n,
  tono,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  n: number;
  tono: string;
  children?: ReactNode;
}) => {
  if (n === 0) return null;
  return (
    <Collapsible className="rounded-md border">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 p-3 text-left text-sm hover:bg-muted/50">
        <span className={tono}>{icono}</span>
        <span className="min-w-0 flex-1 font-medium">{titulo}</span>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">{n.toLocaleString('es-EC')}</span>
      </CollapsibleTrigger>
      {children && (
        <CollapsibleContent className="max-h-56 overflow-y-auto border-t p-3 text-xs text-muted-foreground">
          {children}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
};

const ImportarContactos = ({ onCerrar }: { onCerrar: () => void }) => {
  const segmentos = useSegmentos();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<string>('');
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<RevisionImportacion | null>(null);
  const [incluirRepresentantes, setIncluirRepresentantes] = useState(false);
  const [segmento, setSegmento] = useState<string>(NINGUNO);
  const [segmentoNuevo, setSegmentoNuevo] = useState('');

  const importar = useAccionComunicados(comunicadosApi.importar, (r) =>
    r.enSegmento > 0
      ? `${r.nuevos} contactos nuevos · ${r.enSegmento} añadidos al segmento`
      : `${r.nuevos} contactos nuevos`,
  );

  const leer = async (f: File | undefined) => {
    setError(null);
    setRevision(null);
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setError('El archivo pasa de 4 MB. Divídelo o quita columnas que no hacen falta.');
      return;
    }
    setArchivo(f.name);
    setLeyendo(true);
    try {
      const contenido = await aBase64(f);
      setRevision(await comunicadosApi.revisarImportacion(f.name, contenido));
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setLeyendo(false);
      if (entrada.current) entrada.current.value = '';
    }
  };

  const filas = revision
    ? [
        ...revision.nuevos,
        ...(incluirRepresentantes ? revision.yaRepresentantes.map(({ nombre, correo }) => ({ nombre, correo })) : []),
        // Los que ya eran contactos no se duplican, pero entran al segmento si se elige uno.
        ...(segmento !== NINGUNO ? revision.yaContactos : []),
      ]
    : [];
  const nuevos = revision ? revision.nuevos.length + (incluirRepresentantes ? revision.yaRepresentantes.length : 0) : 0;
  const faltaNombreSegmento = segmento === NUEVO && !segmentoNuevo.trim();

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-h-[94vh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar contactos</DialogTitle>
          <DialogDescription>
            Sube un Excel (.xlsx) o CSV con nombre y correo, en cualquier orden de columnas. Antes de guardar verás qué
            se va a importar.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => void leer(e.target.files?.[0])}
        />
        <Button variant="outline" className="h-11 w-full" disabled={leyendo} onClick={() => entrada.current?.click()}>
          {leyendo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {archivo ? 'Elegir otro archivo' : 'Elegir archivo'}
        </Button>
        {archivo && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileSpreadsheet className="h-4 w-4" />
            {archivo}
          </p>
        )}
        {error && (
          <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {revision && (
          <div className="space-y-3">
            <Grupo icono={<CheckCircle2 className="h-4 w-4" />} tono="text-emerald-600 dark:text-emerald-400" titulo="Nuevos" n={revision.nuevos.length}>
              {revision.nuevos.map((f) => (
                <p key={f.correo}>
                  {f.nombre || '(sin nombre)'} · {f.correo}
                </p>
              ))}
            </Grupo>
            <Grupo
              icono={<AlertTriangle className="h-4 w-4" />}
              tono="text-amber-600 dark:text-amber-400"
              titulo="Ya son contactos: no se duplican"
              n={revision.yaContactos.length}
            >
              {revision.yaContactos.map((f) => (
                <p key={f.correo}>{f.correo}</p>
              ))}
            </Grupo>
            <Grupo
              icono={<AlertTriangle className="h-4 w-4" />}
              tono="text-amber-600 dark:text-amber-400"
              titulo="Ya son representantes"
              n={revision.yaRepresentantes.length}
            >
              {revision.yaRepresentantes.map((f) => (
                <p key={f.correo}>
                  {f.correo} · {f.representante}
                </p>
              ))}
            </Grupo>
            {revision.yaRepresentantes.length > 0 && (
              <label className="flex items-start gap-3 rounded-md bg-muted/50 p-3 text-sm">
                <input
                  type="checkbox"
                  checked={incluirRepresentantes}
                  onChange={(e) => setIncluirRepresentantes(e.target.checked)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                />
                <span>
                  Agregarlos también como contactos. Normalmente no hace falta: ya les llegan los comunicados a
                  representantes y en un envío nunca se repite un correo.
                </span>
              </label>
            )}
            <Grupo
              icono={<AlertTriangle className="h-4 w-4" />}
              tono="text-amber-600 dark:text-amber-400"
              titulo="Repetidos dentro del archivo: se usa el primero"
              n={revision.repetidosArchivo.length}
            >
              {revision.repetidosArchivo.map((f) => (
                <p key={`${f.fila}-${f.correo}`}>
                  Fila {f.fila} · {f.correo}
                </p>
              ))}
            </Grupo>
            <Grupo
              icono={<XCircle className="h-4 w-4" />}
              tono="text-destructive"
              titulo="Sin correo válido: no se importan"
              n={revision.invalidos.length}
            >
              {revision.invalidos.map((f) => (
                <p key={f.fila}>
                  Fila {f.fila} · {f.texto}
                </p>
              ))}
            </Grupo>

            <div className="space-y-1.5 pt-2">
              <Label>Añadirlos a un segmento (opcional)</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NINGUNO}>Ninguno</SelectItem>
                  <SelectItem value={NUEVO}>Un segmento nuevo…</SelectItem>
                  {(segmentos.data ?? []).map((s) => (
                    <SelectItem key={s.comseg_id} value={String(s.comseg_id)}>
                      {s.comseg_nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {segmento === NUEVO && (
                <Input
                  value={segmentoNuevo}
                  onChange={(e) => setSegmentoNuevo(e.target.value)}
                  placeholder="Nombre del segmento nuevo"
                  maxLength={80}
                  className="h-11 sm:h-10"
                />
              )}
              {segmento !== NINGUNO && revision.yaContactos.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Los que ya eran contactos también entran en el segmento.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar}>
            Cancelar
          </Button>
          {revision && (
            <Button
              disabled={filas.length === 0 || faltaNombreSegmento || importar.isPending}
              onClick={() =>
                importar.mutate(
                  {
                    filas,
                    segmento: segmento !== NINGUNO && segmento !== NUEVO ? Number(segmento) : null,
                    segmentoNuevo: segmento === NUEVO ? segmentoNuevo.trim() : null,
                  },
                  { onSuccess: onCerrar },
                )
              }
            >
              {importar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nuevos > 0 ? `Importar ${nuevos.toLocaleString('es-EC')} contactos` : 'Añadir al segmento'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportarContactos;
