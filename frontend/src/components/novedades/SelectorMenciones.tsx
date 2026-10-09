import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAlumnosMencionables, usePersonalMencionable } from '@/hooks/useNovedades';

interface MencionItem {
  id: number;
  nombre: string;
  detalle: string | null;
}

interface Props {
  tipo: 'personal' | 'alumno';
  seleccionados: number[];
  onCambio: (ids: number[]) => void;
}

/**
 * Selector múltiple con buscador. Lista los mencionables del backend, filtra
 * por búsqueda en el servidor (debounce ligero) y guarda a los elegidos como
 * chips arriba. Un v1 sin command-palette para no cargar más dependencias.
 */
const SelectorMenciones = ({ tipo, seleccionados, onCambio }: Props) => {
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setConsulta(buscar.trim()), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const personal = usePersonalMencionable(consulta, tipo === 'personal');
  const alumnos = useAlumnosMencionables(consulta, tipo === 'alumno');

  const items: MencionItem[] = useMemo(() => {
    if (tipo === 'personal') {
      return (personal.data ?? []).map((p) => ({
        id: p.usu_id,
        nombre: p.usu_nombre,
        detalle: p.rol,
      }));
    }
    return (alumnos.data ?? []).map((a) => ({
      id: a.nino_id,
      nombre: a.nino_nombre,
      detalle: [a.grado, a.col_nombre].filter(Boolean).join(' · ') || null,
    }));
  }, [tipo, personal.data, alumnos.data]);

  /** Mantener los seleccionados aunque no estén en el resultado filtrado. */
  const [memoria, setMemoria] = useState<Record<number, MencionItem>>({});
  useEffect(() => {
    setMemoria((prev) => {
      const siguiente = { ...prev };
      for (const it of items) siguiente[it.id] = it;
      return siguiente;
    });
  }, [items]);

  const toggle = (id: number) => {
    if (seleccionados.includes(id)) {
      onCambio(seleccionados.filter((x) => x !== id));
    } else {
      onCambio([...seleccionados, id]);
    }
  };

  const quitar = (id: number) => onCambio(seleccionados.filter((x) => x !== id));

  const cargando = tipo === 'personal' ? personal.isLoading : alumnos.isLoading;

  return (
    <div className="space-y-2">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const item = memoria[id];
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {item?.nombre ?? `#${id}`}
                <button
                  type="button"
                  onClick={() => quitar(id)}
                  aria-label={`Quitar ${item?.nombre ?? ''}`}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          placeholder={tipo === 'personal' ? 'Buscar personal…' : 'Buscar alumno…'}
          className="h-11 pl-9 sm:h-10"
        />
      </div>

      <ul className="max-h-56 overflow-y-auto rounded-md border">
        {cargando && (
          <li className="px-3 py-2 text-sm text-muted-foreground">Cargando…</li>
        )}
        {!cargando && items.length === 0 && (
          <li className="px-3 py-2 text-sm text-muted-foreground">
            {consulta ? 'Nadie coincide con la búsqueda.' : 'Escribe para buscar.'}
          </li>
        )}
        {!cargando &&
          items.map((it) => {
            const elegido = seleccionados.includes(it.id);
            return (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => toggle(it.id)}
                  className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                    elegido ? 'bg-primary/5' : ''
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{it.nombre}</span>
                    {it.detalle && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {it.detalle}
                      </span>
                    )}
                  </span>
                  <input
                    type="checkbox"
                    checked={elegido}
                    readOnly
                    className="mt-1 h-4 w-4 flex-shrink-0 accent-primary"
                    tabIndex={-1}
                  />
                </button>
              </li>
            );
          })}
      </ul>
    </div>
  );
};

export default SelectorMenciones;
