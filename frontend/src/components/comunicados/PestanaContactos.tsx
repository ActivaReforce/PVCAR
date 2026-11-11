import { useMemo, useState } from 'react';
import { FolderPlus, Loader2, Pencil, Plus, Search, Tag, Trash2, Upload, Users, X } from 'lucide-react';
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
import { ApiError } from '@/lib/api';
import { comunicadosApi, type Contacto, type Segmento } from '@/api/comunicados';
import { useAccionComunicados, useContactos, useSegmentos } from '@/hooks/useComunicados';
import { cn } from '@/lib/utils';
import ImportarContactos from './ImportarContactos';

/**
 * Contactos: gente interesada que no es representante, con sus segmentos.
 * Los segmentos viven en la plataforma, sin límite; en Resend solo existe
 * uno temporal mientras se envía.
 */

const TODOS = 'todos';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------------------
// Alta y edición de un contacto
// ---------------------------------------------------------------------------

const FormContacto = ({ contacto, onCerrar }: { contacto: Contacto | null; onCerrar: () => void }) => {
  const [nombre, setNombre] = useState(contacto?.comcon_nombre ?? '');
  const [correo, setCorreo] = useState(contacto?.comcon_correo ?? '');
  const [esRepresentante, setEsRepresentante] = useState<string | null>(null);

  const guardar = useAccionComunicados(
    (forzar: boolean) => {
      const d = { nombre: nombre.trim(), correo: correo.trim().toLowerCase(), forzar };
      return contacto ? comunicadosApi.editarContacto(contacto.comcon_id, d) : comunicadosApi.crearContacto(d);
    },
    () => (contacto ? 'Contacto guardado' : 'Contacto agregado'),
  );

  const enviar = (forzar: boolean) =>
    guardar.mutate(forzar, {
      onSuccess: onCerrar,
      onError: (err) => {
        if (err instanceof ApiError && (err.details as { codigo?: string } | undefined)?.codigo === 'ES_REPRESENTANTE') {
          setEsRepresentante(err.message);
        }
      },
    });

  const valido = CORREO.test(correo.trim());

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onCerrar()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{contacto ? 'Editar contacto' : 'Agregar contacto'}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (valido) enviar(false);
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="con-nombre">Nombre</Label>
              <Input id="con-nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className="h-11 sm:h-10" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="con-correo">Correo</Label>
              <Input
                id="con-correo"
                type="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="h-11 sm:h-10"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button type="submit" disabled={!valido || guardar.isPending}>
                {guardar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={esRepresentante !== null} onOpenChange={(v) => !v && setEsRepresentante(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ese correo ya es de un representante</AlertDialogTitle>
            <AlertDialogDescription>
              {esRepresentante} ¿Lo agregas igual como contacto? En un mismo envío nunca le llega dos veces.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setEsRepresentante(null);
                enviar(true);
              }}
            >
              Agregar igual
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

// ---------------------------------------------------------------------------
// Segmentos
// ---------------------------------------------------------------------------

const FormSegmento = ({ segmento, onCerrar }: { segmento: Segmento | null; onCerrar: () => void }) => {
  const [nombre, setNombre] = useState(segmento?.comseg_nombre ?? '');
  const guardar = useAccionComunicados(
    (n: string) => (segmento ? comunicadosApi.renombrarSegmento(segmento.comseg_id, n) : comunicadosApi.crearSegmento(n)),
    () => (segmento ? 'Segmento renombrado' : 'Segmento creado'),
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{segmento ? 'Renombrar segmento' : 'Nuevo segmento'}</DialogTitle>
          {!segmento && (
            <DialogDescription>
              Después marca contactos en la lista y usa «Añadir a segmento».
            </DialogDescription>
          )}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (nombre.trim()) guardar.mutate(nombre.trim(), { onSuccess: onCerrar });
          }}
        >
          <Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={80} className="h-11 sm:h-10" autoFocus aria-label="Nombre del segmento" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!nombre.trim() || guardar.isPending}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------

type Confirmar =
  | { tipo: 'borrar-contactos'; ids: number[] }
  | { tipo: 'borrar-segmento'; segmento: Segmento }
  | null;

const PestanaContactos = () => {
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState<string>(TODOS);
  const segmentoFiltro = filtro === TODOS ? null : Number(filtro);
  const contactos = useContactos(buscar.trim(), segmentoFiltro);
  const segmentos = useSegmentos();

  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [destinoSegmento, setDestinoSegmento] = useState<string>('');
  const [editar, setEditar] = useState<Contacto | null | 'nuevo'>(null);
  const [segmentoForm, setSegmentoForm] = useState<Segmento | null | 'nuevo'>(null);
  const [importar, setImportar] = useState(false);
  const [confirmar, setConfirmar] = useState<Confirmar>(null);

  const lista = useMemo(() => contactos.data?.contactos ?? [], [contactos.data]);
  const visibles = new Set(lista.map((c) => c.comcon_id));
  const seleccion = [...marcados].filter((id) => visibles.has(id));
  const todosMarcados = lista.length > 0 && seleccion.length === lista.length;

  const limpiar = () => setMarcados(new Set());

  const borrarContactos = useAccionComunicados(comunicadosApi.borrarContactos, (r) => `${r.borrados} contactos borrados`);
  const borrarSegmento = useAccionComunicados(comunicadosApi.borrarSegmento, () => 'Segmento borrado');
  const anadir = useAccionComunicados(
    ({ id, ids }: { id: number; ids: number[] }) => comunicadosApi.anadirASegmento(id, ids),
    (r) => `${r.anadidos} añadidos al segmento`,
  );
  const quitar = useAccionComunicados(
    ({ id, ids }: { id: number; ids: number[] }) => comunicadosApi.quitarDeSegmento(id, ids),
    (r) => `${r.quitados} quitados del segmento`,
  );

  const alternar = (id: number) =>
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-5">
      {/* Segmentos */}
      <section className="space-y-2 rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold">Segmentos</h2>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setSegmentoForm('nuevo')}>
            <FolderPlus className="mr-1.5 h-4 w-4" />
            Nuevo segmento
          </Button>
        </div>
        {(segmentos.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay segmentos. Sirven para enviar solo a un grupo de contactos.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {(segmentos.data ?? []).map((s) => {
              const activo = filtro === String(s.comseg_id);
              return (
                <li
                  key={s.comseg_id}
                  className={cn(
                    'inline-flex max-w-full items-center rounded-full border text-sm',
                    activo && 'border-primary bg-primary/10',
                  )}
                >
                  <button
                    type="button"
                    className="min-h-9 min-w-0 truncate py-1 pl-3 pr-1 text-left"
                    onClick={() => setFiltro(activo ? TODOS : String(s.comseg_id))}
                    title={activo ? 'Ver todos los contactos' : 'Ver solo este segmento'}
                  >
                    <Tag className="mr-1 inline h-3.5 w-3.5" />
                    {s.comseg_nombre} <span className="text-xs text-muted-foreground">({s.contactos})</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Renombrar ${s.comseg_nombre}`}
                    className="inline-flex h-9 w-8 items-center justify-center hover:text-primary"
                    onClick={() => setSegmentoForm(s)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Borrar ${s.comseg_nombre}`}
                    className="inline-flex h-9 w-8 items-center justify-center rounded-r-full hover:text-destructive"
                    onClick={() => setConfirmar({ tipo: 'borrar-segmento', segmento: s })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Barra de la lista */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre o correo…"
            className="h-11 pl-9 sm:h-10"
          />
        </div>
        <Select value={filtro} onValueChange={(v) => { setFiltro(v); limpiar(); }}>
          <SelectTrigger className="h-11 sm:h-10 lg:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos los contactos</SelectItem>
            {(segmentos.data ?? []).map((s) => (
              <SelectItem key={s.comseg_id} value={String(s.comseg_id)}>
                {s.comseg_nombre}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button variant="outline" className="h-11 sm:h-10" onClick={() => setImportar(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button className="h-11 sm:h-10" onClick={() => setEditar('nuevo')}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar
          </Button>
        </div>
      </div>

      {/* Acciones sobre lo marcado */}
      {seleccion.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 sm:flex-row sm:flex-wrap sm:items-center">
          <span className="text-sm font-medium sm:mr-2">{seleccion.length} marcados</span>
          <div className="flex min-w-0 gap-2">
            <Select value={destinoSegmento} onValueChange={setDestinoSegmento}>
              <SelectTrigger className="h-10 min-w-0 sm:w-48">
                <SelectValue placeholder="Añadir a segmento…" />
              </SelectTrigger>
              <SelectContent>
                {(segmentos.data ?? []).map((s) => (
                  <SelectItem key={s.comseg_id} value={String(s.comseg_id)}>
                    {s.comseg_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="secondary"
              className="h-10 shrink-0"
              disabled={!destinoSegmento || anadir.isPending}
              onClick={() => anadir.mutate({ id: Number(destinoSegmento), ids: seleccion }, { onSuccess: limpiar })}
            >
              Añadir
            </Button>
          </div>
          {segmentoFiltro && (
            <Button
              variant="outline"
              className="h-10"
              disabled={quitar.isPending}
              onClick={() => quitar.mutate({ id: segmentoFiltro, ids: seleccion }, { onSuccess: limpiar })}
            >
              Quitar de este segmento
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 text-destructive hover:bg-destructive/10 hover:text-destructive sm:ml-auto"
            onClick={() => setConfirmar({ tipo: 'borrar-contactos', ids: seleccion })}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Borrar
          </Button>
          <Button variant="ghost" size="icon" className="hidden h-10 w-10 sm:inline-flex" aria-label="Desmarcar" onClick={limpiar}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Lista */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-3 border-b bg-muted/40 px-3 py-2 text-sm">
          <input
            type="checkbox"
            aria-label="Marcar todos"
            className="h-5 w-5 accent-primary"
            checked={todosMarcados}
            disabled={lista.length === 0}
            onChange={() => setMarcados(todosMarcados ? new Set() : new Set(lista.map((c) => c.comcon_id)))}
          />
          <span className="text-muted-foreground">
            {contactos.isFetching && <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin" />}
            {lista.length.toLocaleString('es-EC')}
            {segmentoFiltro || buscar.trim() ? ` de ${(contactos.data?.total ?? 0).toLocaleString('es-EC')}` : ''} contactos
          </span>
        </div>
        {!contactos.isLoading && lista.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-10 w-10 opacity-50" />
            <p>{buscar || segmentoFiltro ? 'Nadie coincide con el filtro.' : 'Aún no hay contactos. Agrégalos o importa un Excel.'}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {lista.map((c) => (
              <li key={c.comcon_id} className="flex items-start gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  aria-label={`Marcar ${c.comcon_correo}`}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
                  checked={marcados.has(c.comcon_id)}
                  onChange={() => alternar(c.comcon_id)}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="break-words text-sm font-medium">{c.comcon_nombre || <span className="text-muted-foreground">(sin nombre)</span>}</p>
                  <p className="break-all text-sm text-muted-foreground">{c.comcon_correo}</p>
                  {(c.segmentos.length > 0 || c.representante) && (
                    <div className="flex flex-wrap gap-1">
                      {c.segmentos.map((s) => (
                        <span key={s.id} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                          {s.nombre}
                        </span>
                      ))}
                      {c.representante && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                          También es representante: {c.representante}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Editar" onClick={() => setEditar(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label="Borrar"
                    onClick={() => setConfirmar({ tipo: 'borrar-contactos', ids: [c.comcon_id] })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editar && <FormContacto contacto={editar === 'nuevo' ? null : editar} onCerrar={() => setEditar(null)} />}
      {segmentoForm && <FormSegmento segmento={segmentoForm === 'nuevo' ? null : segmentoForm} onCerrar={() => setSegmentoForm(null)} />}
      {importar && <ImportarContactos onCerrar={() => setImportar(false)} />}

      <AlertDialog open={confirmar !== null} onOpenChange={(v) => !v && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.tipo === 'borrar-segmento'
                ? `¿Borrar el segmento «${confirmar.segmento.comseg_nombre}»?`
                : confirmar?.tipo === 'borrar-contactos' && confirmar.ids.length > 1
                  ? `¿Borrar ${confirmar.ids.length} contactos?`
                  : '¿Borrar este contacto?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmar?.tipo === 'borrar-segmento'
                ? `Sus ${confirmar.segmento.contactos} contactos no se borran: solo dejan de estar agrupados. Un borrador que lo use tendrá que elegir otro grupo.`
                : 'Se borran de la plataforma y de sus segmentos. No se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmar?.tipo === 'borrar-segmento') {
                  borrarSegmento.mutate(confirmar.segmento.comseg_id);
                  if (filtro === String(confirmar.segmento.comseg_id)) setFiltro(TODOS);
                } else if (confirmar?.tipo === 'borrar-contactos') {
                  borrarContactos.mutate(confirmar.ids, { onSuccess: limpiar });
                }
                setConfirmar(null);
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

export default PestanaContactos;
