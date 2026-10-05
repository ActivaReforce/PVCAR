import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFichaRepresentante } from '@/hooks/useEncuestas';
import { iniciales } from '@/components/evaluaciones/metodos';

const Fila = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-0.5 break-words text-sm">{children}</dd>
  </div>
);

/**
 * La ficha completa de un representante: sus datos (los de su cuenta), a
 * quién se le factura y de qué alumnos responde. Solo lectura: los
 * representados se cambian con su propio botón y la factura desde ahí.
 */
const FichaRepresentanteDialog = ({ usuId, onClose }: { usuId: number | null; onClose: () => void }) => {
  const ficha = useFichaRepresentante(usuId);
  const r = ficha.data?.representante;
  const hijos = ficha.data?.hijos ?? [];

  return (
    <Dialog open={usuId !== null} onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">{r?.usu_nombre ?? 'Representante'}</DialogTitle>
          <DialogDescription>Ficha del representante</DialogDescription>
        </DialogHeader>

        {ficha.isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}
        {ficha.isError && (
          <p className="text-sm text-destructive">No se pudo cargar: {(ficha.error as Error).message}</p>
        )}

        {r && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14">
                <AvatarImage src={r.usu_foto_url ?? undefined} alt="" />
                <AvatarFallback>{iniciales(r.usu_nombre)}</AvatarFallback>
              </Avatar>
              <Badge variant={r.est_id === 1 ? 'default' : 'secondary'}>
                {r.est_id === 1 ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>

            <section className="space-y-3">
              <h3 className="font-semibold">Datos</h3>
              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Fila etiqueta="Nombre">{r.usu_nombre}</Fila>
                <Fila etiqueta="Cédula">{r.usu_cedula || '—'}</Fila>
                <Fila etiqueta="Correo">{r.usu_correo}</Fila>
                <Fila etiqueta="Teléfono">{r.usu_telefono || '—'}</Fila>
              </dl>
            </section>

            <section className="space-y-3 border-t pt-5">
              <h3 className="font-semibold">Facturación</h3>
              {r.padre_factura_nombre || r.padre_factura_identificacion ? (
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Fila etiqueta="A nombre de">{r.padre_factura_nombre || '—'}</Fila>
                  <Fila etiqueta="Cédula o RUC">{r.padre_factura_identificacion || '—'}</Fila>
                  <Fila etiqueta="Correo">{r.padre_factura_correo || '—'}</Fila>
                  <Fila etiqueta="Dirección">{r.padre_factura_direccion || '—'}</Fila>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Sin datos de facturación.</p>
              )}
            </section>

            <section className="space-y-3 border-t pt-5">
              <h3 className="font-semibold">
                Representados{' '}
                <span className="font-normal text-muted-foreground">({hijos.length})</span>
              </h3>
              {hijos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tiene representados.</p>
              ) : (
                <ul className="divide-y rounded-md border">
                  {hijos.map((h) => (
                    <li key={h.nino_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{h.nino_nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {h.col_nombre}
                          {h.catninograd_nombre && ` · ${h.catninograd_nombre}`} · {h.disciplinas}{' '}
                          {h.disciplinas === 1 ? 'disciplina' : 'disciplinas'}
                        </p>
                      </div>
                      {h.est_id !== 1 && <Badge variant="secondary">Inactivo</Badge>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {r.encuestasRespondidas > 0 && (
              <p className="text-sm text-muted-foreground">
                Respondió {r.encuestasRespondidas} encuesta{r.encuestasRespondidas === 1 ? '' : 's'}.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FichaRepresentanteDialog;
