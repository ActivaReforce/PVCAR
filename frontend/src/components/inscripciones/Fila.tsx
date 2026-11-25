/** Una etiqueta y su valor dentro de un `<dl>` de las fichas de Inscripciones. */
const Fila = ({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{etiqueta}</dt>
    <dd className="mt-0.5 break-words text-sm">{children}</dd>
  </div>
);

export default Fila;
