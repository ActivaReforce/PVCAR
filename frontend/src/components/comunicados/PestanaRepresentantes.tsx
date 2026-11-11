import { useState } from 'react';
import { Loader2, Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOpcionesComunicados, useRepresentantesCom } from '@/hooks/useComunicados';

/**
 * Representantes, solo para ver: salen de las inscripciones y se gestionan
 * en su módulo. Los filtros son los mismos que al elegir a quién enviar.
 */

const TODOS = 'todos';
const num = (v: string) => (v === TODOS ? null : Number(v));

const PestanaRepresentantes = () => {
  const opciones = useOpcionesComunicados();
  const [buscar, setBuscar] = useState('');
  const [colegio, setColegio] = useState(TODOS);
  const [curso, setCurso] = useState(TODOS);
  const [disciplina, setDisciplina] = useState(TODOS);

  const lista = useRepresentantesCom({
    colegio: num(colegio),
    curso: num(curso),
    disciplina: num(disciplina),
    buscar: buscar.trim(),
  });
  const ops = opciones.data;
  const disciplinas = (ops?.disciplinas ?? []).filter((d) => colegio === TODOS || d.col_id === Number(colegio));
  const filas = lista.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Solo lectura. Aparecen al inscribirse y salen al darse de baja; se gestionan en Representantes.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="relative sm:col-span-2 xl:col-span-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        <Select
          value={colegio}
          onValueChange={(v) => {
            setColegio(v);
            setDisciplina(TODOS);
          }}
        >
          <SelectTrigger className="h-11 sm:h-10" aria-label="Colegio">
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
        <Select value={curso} onValueChange={setCurso}>
          <SelectTrigger className="h-11 sm:h-10" aria-label="Curso">
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
        <Select value={disciplina} onValueChange={setDisciplina}>
          <SelectTrigger className="h-11 sm:h-10" aria-label="Disciplina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las disciplinas</SelectItem>
            {disciplinas.map((d) => (
              <SelectItem key={d.id} value={String(d.id)}>
                {d.nombre}
                {d.horario ? ` · ${d.horario}` : ''}
                {colegio === TODOS ? ` · ${ops?.colegios.find((c) => c.id === d.col_id)?.nombre ?? ''}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <div className="border-b bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {lista.isFetching && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
          {filas.length.toLocaleString('es-EC')} representantes
        </div>
        {!lista.isLoading && filas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <UserRound className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>Nadie coincide con el filtro.</p>
          </div>
        ) : (
          <ul className="divide-y">
            {filas.map((r) => (
              <li key={r.usu_id} className="space-y-1 px-3 py-2.5">
                <p className="break-words text-sm font-medium">{r.usu_nombre}</p>
                <p className="break-all text-sm text-muted-foreground">{r.correo}</p>
                {r.hijos.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {r.hijos.map((h) => `${h.nombre} (${[h.curso, h.colegio].filter(Boolean).join(', ')})`).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default PestanaRepresentantes;
