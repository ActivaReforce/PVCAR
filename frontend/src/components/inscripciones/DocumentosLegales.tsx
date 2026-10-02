import { useState } from 'react';
import { FilePlus2, FileText, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import {
  useDocumentoLegal,
  useDocumentosLegales,
  usePublicarDocumento,
} from '@/hooks/useInscripciones';
import { NOMBRE_DOCUMENTO, type DocumentoLegal, type TipoDocumento } from '@/api/inscripciones';
import TextoLegal from './TextoLegal';
import { fechaCorta } from './formato';

const TIPOS: TipoDocumento[] = ['contrato', 'terminos', 'privacidad'];

/**
 * Los tres textos que el representante acepta: contrato, términos y
 * privacidad.
 *
 * Una versión publicada **no se edita nunca** (la base lo impide, migración
 * 0014): quien la aceptó tiene que poder probar qué leyó. Cambiar un texto es
 * publicar la versión siguiente; las inscripciones ya enviadas conservan la
 * suya y las nuevas aceptan la nueva.
 *
 * Mientras falte alguno de los tres, el formulario público no se abre.
 */
const DocumentosLegales = () => {
  const documentos = useDocumentosLegales();
  const [editando, setEditando] = useState<TipoDocumento | null>(null);
  const [viendo, setViendo] = useState<number | null>(null);

  if (documentos.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (documentos.isError || !documentos.data) {
    return (
      <p className="text-sm text-destructive">
        No se pudieron cargar los documentos: {(documentos.error as Error | null)?.message}
      </p>
    );
  }

  const { vigentes, historial, marcadores } = documentos.data;
  const vigente = (tipo: TipoDocumento) => vigentes.find((d) => d.doc_tipo === tipo);
  const faltan = TIPOS.filter((t) => !vigente(t));

  return (
    <div className="space-y-4">
      {faltan.length > 0 && (
        <div className="rounded-md border border-amber-600/50 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium">El formulario de inscripción está cerrado</p>
          <p className="mt-1 text-muted-foreground">
            Falta publicar: {faltan.map((t) => NOMBRE_DOCUMENTO[t]).join(', ')}. Se abre solo cuando
            estén los tres.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {TIPOS.map((tipo) => {
          const doc = vigente(tipo);
          const versiones = historial.filter((h) => h.doc_tipo === tipo);
          return (
            <div key={tipo} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">{NOMBRE_DOCUMENTO[tipo]}</p>
                {doc ? (
                  <>
                    <p className="truncate font-medium" title={doc.doc_titulo}>
                      {doc.doc_titulo}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Versión {doc.doc_version} · {fechaCorta(doc.doc_fecha)} ·{' '}
                      {versiones[0]?.aceptaciones ?? 0} aceptaciones
                    </p>
                  </>
                ) : (
                  <Badge variant="secondary" className="mt-1">
                    Sin publicar
                  </Badge>
                )}
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                {doc && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 sm:h-9"
                    onClick={() => setViendo(doc.doc_id)}
                  >
                    <FileText className="mr-2 h-4 w-4" /> Ver
                  </Button>
                )}
                <ConditionalAction module="inscripciones" action="editar">
                  <Button size="sm" className="h-10 sm:h-9" onClick={() => setEditando(tipo)}>
                    <FilePlus2 className="mr-2 h-4 w-4" />
                    {doc ? 'Nueva versión' : 'Publicar'}
                  </Button>
                </ConditionalAction>
              </div>
            </div>
          );
        })}
      </div>

      {historial.length > vigentes.length && (
        <details className="rounded-lg border p-4">
          <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4" /> Versiones anteriores
          </summary>
          <ul className="mt-3 divide-y text-sm">
            {historial
              .filter((h) => !vigentes.some((v) => v.doc_id === h.doc_id))
              .map((h) => (
                <li key={h.doc_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">
                    {NOMBRE_DOCUMENTO[h.doc_tipo]} · v{h.doc_version} · {fechaCorta(h.doc_fecha)} ·{' '}
                    {h.aceptaciones} aceptaciones
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => setViendo(h.doc_id)}>
                    Ver
                  </Button>
                </li>
              ))}
          </ul>
        </details>
      )}

      <EditorDocumento
        tipo={editando}
        actual={editando ? vigente(editando) : undefined}
        marcadores={marcadores}
        onClose={() => setEditando(null)}
      />
      <VisorDocumento id={viendo} onClose={() => setViendo(null)} />
    </div>
  );
};

const EditorDocumento = ({
  tipo,
  actual,
  marcadores,
  onClose,
}: {
  tipo: TipoDocumento | null;
  actual: DocumentoLegal | undefined;
  marcadores: Record<string, string>;
  onClose: () => void;
}) => {
  const publicar = usePublicarDocumento();
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [abiertoPara, setAbiertoPara] = useState<TipoDocumento | null>(null);

  // Al abrir, se parte del texto vigente: casi siempre es un retoque.
  if (tipo !== abiertoPara) {
    setAbiertoPara(tipo);
    setTitulo(actual?.doc_titulo ?? (tipo ? NOMBRE_DOCUMENTO[tipo] : ''));
    setContenido(actual?.doc_contenido ?? '');
  }

  const sinCambios =
    actual !== undefined && actual.doc_titulo === titulo.trim() && actual.doc_contenido === contenido;

  const guardar = async () => {
    if (!tipo) return;
    try {
      await publicar.mutateAsync({ tipo, titulo: titulo.trim(), contenido });
      onClose();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={tipo !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {tipo && NOMBRE_DOCUMENTO[tipo]} — {actual ? `versión ${actual.doc_version + 1}` : 'versión 1'}
          </DialogTitle>
          <DialogDescription>
            Una vez publicada no se puede editar. Las inscripciones ya enviadas conservan la versión
            que aceptaron.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="doc-titulo">Título</Label>
            <Input id="doc-titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="doc-contenido">Texto</Label>
            <Textarea
              id="doc-contenido"
              value={contenido}
              onChange={(e) => setContenido(e.target.value)}
              className="min-h-[320px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Deja una línea en blanco entre párrafos. Una línea que empieza con{' '}
              <code className="rounded bg-muted px-1"># </code> es un subtítulo.
            </p>
          </div>

          {tipo === 'contrato' && (
            <div className="rounded-md border p-3 text-sm">
              <p className="mb-2 font-medium">Datos que se rellenan solos en cada contrato</p>
              <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {Object.entries(marcadores).map(([clave, descripcion]) => (
                  <li key={clave} className="min-w-0">
                    <code className="rounded bg-muted px-1 text-xs">{`{{${clave}}}`}</code>{' '}
                    <span className="text-muted-foreground">{descripcion}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted-foreground">
                Al final de cada contrato se añaden siempre los datos de la inscripción y la
                constancia de aceptación (fecha, hora e IP).
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={guardar}
            disabled={
              publicar.isPending || titulo.trim().length < 3 || contenido.trim().length < 20 || sinCambios
            }
          >
            {publicar.isPending ? 'Publicando…' : 'Publicar versión'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const VisorDocumento = ({ id, onClose }: { id: number | null; onClose: () => void }) => {
  const doc = useDocumentoLegal(id);
  return (
    <Dialog open={id !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{doc.data?.doc_titulo ?? 'Documento'}</DialogTitle>
          <DialogDescription>
            {doc.data &&
              `${NOMBRE_DOCUMENTO[doc.data.doc_tipo]} · versión ${doc.data.doc_version} · publicada el ${fechaCorta(doc.data.doc_fecha)}`}
          </DialogDescription>
        </DialogHeader>
        {doc.data && <TextoLegal texto={doc.data.doc_contenido} />}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentosLegales;
