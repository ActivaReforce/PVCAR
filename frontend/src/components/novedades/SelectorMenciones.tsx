import { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  useAlumnosMencionables,
  usePersonalMencionable,
  useRepresentantesMencionables,
} from '@/hooks/useNovedades';

interface MencionItem {
  id: number;
  nombre: string;
  detalle: string | null;
  /** Colegio por el que se agrupa; null en Personal. */
  grupo: string | null;
}

interface Props {
  tipo: 'personal' | 'representante' | 'alumno';
  seleccionados: number[];
  onCambio: (ids: number[]) => void;
}

const SIN_COLEGIO = 'Sin colegio';

const PLACEHOLDER: Record<Props['tipo'], string> = {
  personal: 'Buscar personal…',
  representante: 'Buscar representante…',
  alumno: 'Buscar alumno…',
};

/**
 * Selector múltiple con buscador. Lista los mencionables del backend, filtra
 * por búsqueda en el servidor (debounce ligero) y guarda a los elegidos como
 * chips arriba. Alumnos y representantes van agrupados por colegio cuando hay
 * más de uno; un representante con hijos en dos colegios sale en los dos.
 *
 * Ningún texto se corta en una línea: los nombres y los hijos se parten, para
 * que un nombre largo no ensanche el modal en el móvil.
 */
const SelectorMenciones = ({ tipo, seleccionados, onCambio }: Props) => {
  const [buscar, setBuscar] = useState('');
  const [consulta, setConsulta] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setConsulta(buscar.trim()), 250);
    return () => clearTimeout(t);
  }, [buscar]);

  const personal = usePersonalMencionable(consulta, tipo === 'personal');
  const representantes = useRepresentantesMencionables(consulta, tipo === 'representante');
  const alumnos = useAlumnosMencionables(consulta, tipo === 'alumno');

  const items: MencionItem[] = useMemo(() => {
    if (tipo === 'personal') {
      return (personal.data ?? []).map((p) => ({
        id: p.usu_id,
        nombre: p.usu_nombre,
        detalle: p.rol,
        grupo: null,
      }));
    }
    if (tipo === 'representante') {
      return (representantes.data ?? []).flatMap((r) => {
        const porColegio = new Map<string, string[]>();
        for (const h of r.hijos) {
          const col = h.colegio ?? SIN_COLEGIO;
          porColegio.set(col, [...(porColegio.get(col) ?? []), h.nombre]);
        }
        if (porColegio.size === 0) {
          return [{ id: r.usu_id, nombre: r.usu_nombre, detalle: null, grupo: SIN_COLEGIO }];
        }
        return [...porColegio].map(([grupo, hijos]) => ({
          id: r.usu_id,
          nombre: r.usu_nombre,
          detalle: `Representante de ${hijos.join(', ')}`,
          grupo,
        }));
      });
    }
    return (alumnos.data ?? []).map((a) => ({
      id: a.nino_id,
      nombre: a.nino_nombre,
      detalle: a.grado,
      grupo: a.col_nombre ?? SIN_COLEGIO,
    }));
  }, [tipo, personal.data, representantes.data, alumnos.data]);

  /** Bloques por colegio, en orden alfabético; uno solo sin título si no hay varios. */
  const grupos = useMemo(() => {
    const mapa = new Map<string, MencionItem[]>();
    for (const it of items) {
      const g = it.grupo ?? '';
      mapa.set(g, [...(mapa.get(g) ?? []), it]);
    }
    return [...mapa].sort(([a], [b]) => a.localeCompare(b, 'es'));
  }, [items]);
  const conTitulos = grupos.length > 1;

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

  const cargando = { personal, representante: representantes, alumno: alumnos }[tipo].isLoading;

  return (
    <div className="min-w-0 space-y-2">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((id) => {
            const item = memoria[id];
            return (
              <span
                key={id}
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                <span className="min-w-0 break-words">{item?.nombre ?? `#${id}`}</span>
                <button
                  type="button"
                  onClick={() => quitar(id)}
                  aria-label={`Quitar ${item?.nombre ?? ''}`}
                  className="flex-shrink-0 hover:text-destructive"
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
          placeholder={PLACEHOLDER[tipo]}
          className="h-11 pl-9 sm:h-10"
        />
      </div>

      <div className="max-h-64 overflow-y-auto rounded-md border">
        {cargando && <p className="px-3 py-2 text-sm text-muted-foreground">Cargando…</p>}
        {!cargando && items.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {consulta ? 'Nadie coincide con la búsqueda.' : 'No hay a quién mencionar.'}
          </p>
        )}
        {!cargando &&
          grupos.map(([grupo, lista]) => (
            <section key={grupo}>
              {conTitulos && (
                <h4 className="sticky top-0 z-10 border-b bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                  {grupo}
                </h4>
              )}
              <ul>
                {lista.map((it) => {
                  const elegido = seleccionados.includes(it.id);
                  return (
                    <li key={`${grupo}-${it.id}`}>
                      <button
                        type="button"
                        onClick={() => toggle(it.id)}
                        className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent ${
                          elegido ? 'bg-primary/5' : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block break-words font-medium">{it.nombre}</span>
                          {it.detalle && (
                            <span className="block break-words text-xs text-muted-foreground">
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
            </section>
          ))}
      </div>
    </div>
  );
};

export default SelectorMenciones;
