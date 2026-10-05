import { Circle, CircleDot, Square, SquareCheck } from 'lucide-react';
import type { TipoDocumento } from '@/api/inscripciones';
import {
  analizar,
  filasDe,
  trozos,
  valorCasilla,
  type Bloque,
  type DatosDocumento,
  type Firmante,
} from './documento';

interface Props {
  tipo: TipoDocumento;
  titulo: string;
  contenido: string;
  datos: DatosDocumento;
  /** Resalta los datos puestos por el sistema (vista previa del módulo interno). */
  resaltar?: boolean;
  /** El enlace [politica] abre la política. Sin esto se pinta como texto. */
  onVerPolitica?: () => void;
}

/**
 * Un documento rellenado, como queda en el PDF: título, párrafos, casillas,
 * tablas de la ficha y bloques de firma. Solo se pinta: lo que el
 * representante contesta lo contesta en los pasos del formulario.
 */
const DocumentoVista = ({ tipo, titulo, contenido, datos, resaltar = false, onVerPolitica }: Props) => {
  const bloques = analizar(contenido);
  const conDatos = (texto: string) =>
    trozos(texto, datos.valores).map((t, i) =>
      t.dato === null ? (
        <span key={i}>{t.texto}</span>
      ) : t.dato === 'no' ? (
        <mark key={i} className="rounded bg-destructive/20 px-0.5 text-destructive" title="Este dato no existe">
          {t.texto}
        </mark>
      ) : resaltar ? (
        <mark key={i} className="rounded bg-sky-200/70 px-0.5 text-foreground dark:bg-sky-500/30">
          {t.texto}
        </mark>
      ) : (
        <span key={i}>{t.texto}</span>
      ),
    );

  // Firmas seguidas van lado a lado, como en el Word.
  const grupos: Array<Bloque | Array<Extract<Bloque, { t: 'firma' }>>> = [];
  for (const b of bloques) {
    const ultimo = grupos[grupos.length - 1];
    if (b.t === 'firma' && Array.isArray(ultimo)) ultimo.push(b);
    else grupos.push(b.t === 'firma' ? [b] : b);
  }

  return (
    <article className="space-y-3 text-sm leading-relaxed">
      <h3 className="text-center text-base font-bold">{conDatos(titulo)}</h3>
      {grupos.map((g, i) => {
        if (Array.isArray(g)) {
          return (
            <div key={i} className="grid grid-cols-1 gap-4 pt-2 sm:auto-cols-fr sm:grid-flow-col">
              {g.map((f, j) => (
                <Firma key={j} quien={f.quien} leyenda={f.leyenda} datos={datos} conDatos={conDatos} />
              ))}
            </div>
          );
        }
        switch (g.t) {
          case 'parrafo':
            return (
              <p key={i} className="whitespace-pre-line text-justify">
                {conDatos(g.texto)}
              </p>
            );
          case 'subtitulo':
            return (
              <h4 key={i} className="pt-1 font-bold">
                {conDatos(g.texto)}
              </h4>
            );
          case 'centrado':
            return (
              <p key={i} className="text-center font-bold">
                {conDatos(g.texto)}
              </p>
            );
          case 'casilla': {
            const marcada = valorCasilla(tipo, g.clave, datos);
            return (
              <p key={i} className="flex items-start gap-2 font-semibold">
                {marcada ? (
                  <SquareCheck className="mt-0.5 h-4 w-4 flex-shrink-0" aria-label="Marcada" />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 flex-shrink-0" aria-label="Sin marcar" />
                )}
                <span className="text-justify">{conDatos(g.texto)}</span>
              </p>
            );
          }
          case 'salud': {
            const s = datos.alumno.salud;
            const Opcion = ({ activa, children }: { activa: boolean; children: React.ReactNode }) => (
              <span className="inline-flex items-center gap-1.5">
                {activa ? <CircleDot className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                {children}
              </span>
            );
            return (
              <div key={i} className="space-y-1.5">
                {g.texto && <p className="text-justify">{conDatos(g.texto)}</p>}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <Opcion activa={s.tiene === false}>No</Opcion>
                  <Opcion activa={s.tiene === true}>
                    Sí. Especifique: <span className="italic">{s.detalle}</span>
                  </Opcion>
                </p>
              </div>
            );
          }
          case 'datos':
            return (
              <table key={i} className="w-full border-collapse text-xs">
                <tbody>
                  {filasDe(g.seccion, datos).map(([etiqueta, celda]) => (
                    <tr key={etiqueta}>
                      <th
                        scope="row"
                        className="w-[45%] border border-foreground/40 bg-muted px-2 py-1 text-left align-top font-semibold"
                      >
                        {etiqueta}
                      </th>
                      <td className="break-words border border-foreground/40 px-2 py-1 align-top">
                        {typeof celda === 'string' ? (
                          celda
                        ) : (
                          <span className="flex flex-wrap gap-x-4 gap-y-1">
                            {celda.opciones.map(([o, v]) => (
                              <span key={o} className="inline-flex items-center gap-1">
                                {v ? <SquareCheck className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                                {o}
                              </span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          case 'politica':
            return onVerPolitica ? (
              <button
                key={i}
                type="button"
                onClick={onVerPolitica}
                className="text-left text-primary underline underline-offset-2"
              >
                [{conDatos(g.texto)}]
              </button>
            ) : (
              <p key={i}>[{conDatos(g.texto)}]</p>
            );
          case 'desconocido':
            return (
              <p key={i} className="text-destructive">
                {g.directiva} {g.texto}
              </p>
            );
          default:
            return null;
        }
      })}
    </article>
  );
};

const Firma = ({
  quien,
  leyenda,
  datos,
  conDatos,
}: {
  quien: Firmante;
  leyenda: string[];
  datos: DatosDocumento;
  conDatos: (t: string) => React.ReactNode;
}) => {
  if (quien === 'activa') {
    return (
      <div className="flex flex-col items-center text-center">
        <p className="min-h-5 text-xs italic text-muted-foreground">{datos.aprobacion ?? ''}</p>
        <div className="my-1 w-full max-w-60 border-t border-foreground/60" />
        {leyenda.map((l) => (
          <p key={l} className="font-bold">
            {conDatos(l)}
          </p>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center text-center">
      <p className="min-h-5 text-xs italic">Aceptado electrónicamente</p>
      <div className="my-1 w-full max-w-60 border-t border-foreground/60" />
      {leyenda.map((l) => (
        <p key={l} className="font-bold">
          {conDatos(l)}
        </p>
      ))}
      <p>Nombre: {datos.representante.nombre}</p>
      <p>C.C.: {datos.representante.cedula}</p>
      <p>Fecha: {datos.fechaFirma}</p>
    </div>
  );
};

export default DocumentoVista;
