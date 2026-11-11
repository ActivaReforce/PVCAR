import { useState } from 'react';
import { AlertTriangle, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MAX_DESTINATARIOS, type Destino } from '@/api/comunicados';
import { nombreDestino } from './util';
import { useContarDestinos, useOpcionesComunicados, useSegmentos } from '@/hooks/useComunicados';
import { cn } from '@/lib/utils';

/**
 * "Para": uno o varios grupos. Se suman sin correos repetidos y el total se
 * ve en vivo, con el tope de 1.000 de Resend.
 */

const TODOS = 'todos';


const iguales = (a: Destino, b: Destino) => JSON.stringify(a) === JSON.stringify(b);

interface Props {
  destinos: Destino[];
  onChange: (d: Destino[]) => void;
}

const SelectorDestinos = ({ destinos, onChange }: Props) => {
  const opciones = useOpcionesComunicados();
  const segmentos = useSegmentos();
  const conteo = useContarDestinos(destinos);

  const [tipo, setTipo] = useState<'representantes' | 'contactos' | 'segmento'>('representantes');
  const [segmento, setSegmento] = useState<string>('');
  const [colegio, setColegio] = useState<string>(TODOS);
  const [curso, setCurso] = useState<string>(TODOS);
  const [disciplina, setDisciplina] = useState<string>(TODOS);

  const ops = opciones.data;
  const disciplinas = (ops?.disciplinas ?? []).filter((d) => colegio === TODOS || d.col_id === Number(colegio));

  const nuevo: Destino | null =
    tipo === 'contactos'
      ? { tipo: 'contactos' }
      : tipo === 'segmento'
        ? segmento
          ? { tipo: 'segmento', segmento: Number(segmento) }
          : null
        : {
            tipo: 'representantes',
            colegio: colegio === TODOS ? null : Number(colegio),
            curso: curso === TODOS ? null : Number(curso),
            disciplina: disciplina === TODOS ? null : Number(disciplina),
          };
  const repetido = nuevo !== null && destinos.some((d) => iguales(d, nuevo));

  const total = conteo.data?.total ?? 0;
  const pasado = total > MAX_DESTINATARIOS;

  return (
    <div className="space-y-3">
      {destinos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {destinos.map((d, i) => (
            <li
              key={JSON.stringify(d)}
              className="inline-flex max-w-full items-center gap-1 rounded-full border bg-muted/60 py-1 pl-3 pr-1 text-sm"
            >
              <span className="min-w-0 break-words">{nombreDestino(d, ops, segmentos.data)}</span>
              {conteo.data?.porGrupo[i] !== undefined && (
                <span className="shrink-0 text-xs text-muted-foreground">({conteo.data.porGrupo[i]})</span>
              )}
              <button
                type="button"
                aria-label="Quitar este grupo"
                onClick={() => onChange(destinos.filter((_, j) => j !== i))}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full hover:bg-background"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md border p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label>Añadir</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as typeof tipo)}>
              <SelectTrigger className="h-11 sm:h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="representantes">Representantes</SelectItem>
                <SelectItem value="contactos">Todos los contactos</SelectItem>
                <SelectItem value="segmento">Un segmento de contactos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === 'segmento' && (
            <div className="space-y-1.5 sm:col-span-1 lg:col-span-3">
              <Label>Segmento</Label>
              <Select value={segmento} onValueChange={setSegmento}>
                <SelectTrigger className="h-11 sm:h-10">
                  <SelectValue placeholder={segmentos.data?.length ? 'Elige un segmento' : 'Aún no hay segmentos'} />
                </SelectTrigger>
                <SelectContent>
                  {(segmentos.data ?? []).map((s) => (
                    <SelectItem key={s.comseg_id} value={String(s.comseg_id)}>
                      {s.comseg_nombre} ({s.contactos})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === 'representantes' && (
            <>
              <div className="space-y-1.5">
                <Label>Colegio</Label>
                <Select
                  value={colegio}
                  onValueChange={(v) => {
                    setColegio(v);
                    setDisciplina(TODOS);
                  }}
                >
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos los colegios</SelectItem>
                    {(ops?.colegios ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Curso</Label>
                <Select value={curso} onValueChange={setCurso}>
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos los cursos</SelectItem>
                    {(ops?.cursos ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Disciplina</Label>
                <Select value={disciplina} onValueChange={setDisciplina}>
                  <SelectTrigger className="h-11 sm:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todas las disciplinas</SelectItem>
                    {disciplinas.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.nombre}
                        {d.horario ? ` · ${d.horario}` : ''}
                        {colegio === TODOS
                          ? ` · ${ops?.colegios.find((c) => c.id === d.col_id)?.nombre ?? ''}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-11 sm:h-10"
            disabled={!nuevo || repetido}
            onClick={() => nuevo && onChange([...destinos, nuevo])}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Añadir este grupo
          </Button>
          {repetido && <span className="text-xs text-muted-foreground">Ese grupo ya está en la lista.</span>}
        </div>
      </div>

      {destinos.length > 0 && (
        <p
          className={cn(
            'flex items-center gap-2 text-sm',
            pasado ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
          aria-live="polite"
        >
          {conteo.isFetching && <Loader2 className="h-4 w-4 animate-spin" />}
          {pasado && <AlertTriangle className="h-4 w-4" />}
          Le llegará a <strong className="text-foreground">{total.toLocaleString('es-EC')}</strong> correos ·{' '}
          {total.toLocaleString('es-EC')} / {MAX_DESTINATARIOS.toLocaleString('es-EC')}
          {pasado && ' — pasa del máximo por envío; quita algún grupo.'}
        </p>
      )}
    </div>
  );
};

export default SelectorDestinos;
