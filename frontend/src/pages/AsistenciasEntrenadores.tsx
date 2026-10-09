import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarClock, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import BarraGuardar from '@/components/asistencias/BarraGuardar';
import MiDiaEntrenadores from '@/components/asistencias/MiDiaEntrenadores';
import { usePermissions } from '@/hooks/usePermissions';
import FilaAsistencia from '@/components/asistencias/FilaAsistencia';
import ResumenAsistencia from '@/components/asistencias/ResumenAsistencia';
import { useColegios } from '@/hooks/useColegios';
import {
  useAsistenciaEntrenadores,
  useContextoAsistencias,
  useGuardarAsistenciaEntrenadores,
} from '@/hooks/useAsistencias';
import { useBorradorAsistencia, type FilaOriginal } from '@/hooks/useBorradorAsistencia';
import type { MarcaPersona } from '@/api/asistencias';
import { ESTADO_ASISTENCIA } from '@/api/asistencias';

const enLetras = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-EC', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

const sinTildes = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Asistencia de entrenadores y auxiliares.
 *
 * Entrada en dos modos: **Mi día** (tarjetas por colegio del alcance, un tap
 * para entrar con fecha de hoy) y **Selects** (colegio + fecha, para repasar
 * fechas pasadas). Dentro de la lista, buscador siempre arriba, barra arriba
 * y abajo.
 *
 * Sustituye a las 743 líneas de un solo archivo que tenía toda la lógica
 * dentro: dos cargas a Supabase por pantalla, el filtro por colegio del
 * coordinador resuelto en el navegador y un guardado fila a fila.
 */
const AsistenciasEntrenadores = () => {
  const { hasPermission } = usePermissions();
  const puedePasarLista = hasPermission('asistencias_entrenadores', 'editar');
  const contexto = useContextoAsistencias();
  const hoy = contexto.data?.hoy ?? '';

  const [colegio, setColegio] = useState('');
  const [fecha, setFecha] = useState('');
  const [vistaInicio, setVistaInicio] = useState<'mi-dia' | 'selects'>('mi-dia');
  const [buscar, setBuscar] = useState('');

  const colegios = useColegios({ limit: 200, orden: 'nombre' });

  const items = colegios.data?.items;
  useEffect(() => {
    if (!colegio && items?.length === 1) {
      setColegio(String(items[0].col_id));
      if (hoy) setFecha(hoy);
    }
  }, [colegio, items, hoy]);

  /** La fecha arranca en hoy, según el servidor, no según el navegador. */
  useEffect(() => {
    if (hoy && fecha === '') setFecha(hoy);
  }, [hoy, fecha]);

  const elegirDeMiDia = (c: { col_id: number; col_nombre: string }) => {
    setColegio(String(c.col_id));
    setFecha(hoy);
    setBuscar('');
  };

  const volverAMiDia = () => {
    if ((items?.length ?? 0) <= 1) return;
    setColegio('');
    setBuscar('');
    setVistaInicio('mi-dia');
  };

  const lista = useAsistenciaEntrenadores(colegio ? Number(colegio) : null, fecha || null);

  const personas = useMemo(() => lista.data?.personas ?? [], [lista.data]);

  const filas: FilaOriginal[] = useMemo(
    () =>
      personas.map((p) => ({
        clave: `${p.tipo}:${p.id}`,
        asisest_id: p.asisest_id,
        hora_tarde: p.hora_tarde,
        razon: p.razon,
      })),
    [personas],
  );

  const borrador = useBorradorAsistencia(filas, `${colegio}|${fecha}`);
  const guardar = useGuardarAsistenciaEntrenadores();

  const personasFiltradas = useMemo(() => {
    const q = sinTildes(buscar.trim());
    if (q === '') return personas;
    return personas.filter((p) => {
      const nombre = sinTildes(p.usu_nombre);
      const titular = sinTildes(p.titular ?? '');
      const imparte = sinTildes(p.imparte.join(' · '));
      return nombre.includes(q) || titular.includes(q) || imparte.includes(q);
    });
  }, [personas, buscar]);

  const enviar = (marcarRestantes: boolean) => {
    if (!colegio) return;

    const marcas: MarcaPersona[] = borrador.envio(marcarRestantes).map(({ clave, marca }) => {
      const [tipo, id] = clave.split(':');
      return {
        tipo: tipo as 'entrenador' | 'auxiliar',
        id: Number(id),
        asisest_id: marca.asisest_id as number,
        hora_tarde: marca.asisest_id === ESTADO_ASISTENCIA.TARDE ? marca.hora : null,
        razon:
          marca.asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO ? marca.razon.trim() : null,
      };
    });

    if (marcas.length === 0) return;
    if (marcarRestantes) borrador.presenteALosQueFaltan();
    guardar.mutate({ colId: Number(colegio), fecha, marcas });
  };

  const haVariosColegios = (items?.length ?? 0) > 1;
  const mostrarMiDia = !colegio && vistaInicio === 'mi-dia' && haVariosColegios;
  const mostrarSelects = !mostrarMiDia && !colegio;

  return (
    <div className="container mx-auto min-w-0 space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          Asistencia de Entrenadores
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quien da clase en ese colegio ese día, con sus auxiliares.
        </p>
      </div>

      {mostrarMiDia && (
        <MiDiaEntrenadores
          colegios={items ?? []}
          cargando={colegios.isLoading}
          onElegir={elegirDeMiDia}
          onOtroColegio={() => setVistaInicio('selects')}
        />
      )}

      {(mostrarSelects || colegio) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-w-2xl">
          <div className="space-y-1">
            <Label htmlFor="colegio">Colegio</Label>
            <Select value={colegio} onValueChange={setColegio}>
              <SelectTrigger id="colegio" className="h-11 sm:h-10">
                <SelectValue placeholder="Seleccionar colegio" />
              </SelectTrigger>
              <SelectContent>
                {(colegios.data?.items ?? []).map((c) => (
                  <SelectItem key={c.col_id} value={String(c.col_id)}>
                    {c.col_nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="fecha">Fecha</Label>
            <Input
              id="fecha"
              type="date"
              value={fecha}
              max={hoy || undefined}
              onChange={(evento) => setFecha(evento.target.value)}
              className="h-11 sm:h-10"
            />
          </div>
        </div>
      )}

      {mostrarSelects && haVariosColegios && (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setVistaInicio('mi-dia')}
            className="h-9 px-2 text-muted-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver a mis colegios
          </Button>
        </div>
      )}

      {!colegio && !mostrarMiDia && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">Elige un colegio para pasar lista</p>
        </div>
      )}

      {colegio && fecha && (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold">
                {lista.data?.colegio.col_nombre ?? ''}
              </h2>
              <p className="text-sm text-muted-foreground">{enLetras(fecha)}</p>
            </div>

            {haVariosColegios && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 sm:h-10"
                onClick={volverAMiDia}
                title="Volver a mis colegios"
              >
                <ArrowLeft className="mr-1 h-4 w-4" />
                Colegios
              </Button>
            )}
          </div>

          {lista.isLoading && (
            <p className="py-12 text-center text-muted-foreground">Cargando la lista…</p>
          )}

          {lista.isError && (
            <p className="py-12 text-center text-destructive">
              {(lista.error as Error).message}
            </p>
          )}

          {lista.data && (
            <>
              <ResumenAsistencia resumen={lista.data.resumen} />

              {personas.length === 0 ? (
                <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
                  <p className="text-lg">Nadie da clase en ese colegio ese día</p>
                  <p className="mt-2 text-sm">
                    Prueba con otra fecha: la lista sale de las asignaciones vigentes ese día.
                  </p>
                </div>
              ) : (
                <>
                  {puedePasarLista && (
                    <BarraGuardar
                      posicion="arriba"
                      sinMarcar={
                        Object.values(borrador.marcas).filter((m) => m.asisest_id === null).length
                      }
                      cambios={borrador.sucias.length}
                      incompletas={borrador.incompletas.length}
                      guardando={guardar.isPending}
                      onDeshacer={borrador.deshacer}
                      onGuardar={enviar}
                    />
                  )}

                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="search"
                      value={buscar}
                      onChange={(evento) => setBuscar(evento.target.value)}
                      placeholder="Buscar por nombre o disciplina"
                      aria-label="Buscar persona"
                      className="h-11 pl-9 sm:h-10"
                    />
                  </div>

                  <fieldset disabled={!puedePasarLista} className="min-w-0">
                    {!puedePasarLista && (
                      <p className="mb-2 text-sm text-muted-foreground">
                        Solo consulta: no tienes permiso para pasar lista.
                      </p>
                    )}
                    <ul className="divide-y overflow-hidden rounded-lg border">
                      {personasFiltradas.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                          Nadie coincide con «{buscar}».
                        </li>
                      ) : (
                        personasFiltradas.map((persona) => {
                          const clave = `${persona.tipo}:${persona.id}`;
                          const marca = borrador.marcas[clave];
                          if (!marca) return null;

                          const detalle =
                            persona.tipo === 'auxiliar'
                              ? `Auxiliar de ${persona.titular ?? 'un entrenador'}`
                              : persona.imparte.join(' · ') || null;

                          return (
                            <FilaAsistencia
                              key={clave}
                              clave={clave}
                              nombre={persona.usu_nombre}
                              fotoUrl={persona.usu_foto_url}
                              detalle={detalle}
                              aviso={
                                persona.activo_hoy
                                  ? null
                                  : 'Ese día ya no tenía asignación aquí; sale porque tiene asistencia registrada'
                              }
                              marca={marca}
                              sucia={borrador.sucias.includes(clave)}
                              incompleta={borrador.incompletas.includes(clave)}
                              registro={{
                                por: persona.registrado_por,
                                en: persona.registrado_en,
                              }}
                              horaServidor={lista.data.hora_servidor}
                              onEstado={borrador.elegirEstado}
                              onHora={borrador.escribirHora}
                              onRazon={borrador.escribirRazon}
                            />
                          );
                        })
                      )}
                    </ul>
                  </fieldset>
                </>
              )}

              {puedePasarLista && personas.length > 0 && (
                <BarraGuardar
                  posicion="abajo"
                  sinMarcar={
                    Object.values(borrador.marcas).filter((m) => m.asisest_id === null).length
                  }
                  cambios={borrador.sucias.length}
                  incompletas={borrador.incompletas.length}
                  guardando={guardar.isPending}
                  onDeshacer={borrador.deshacer}
                  onGuardar={enviar}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default AsistenciasEntrenadores;
