import { useEffect, useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
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

/**
 * Asistencia de entrenadores y auxiliares.
 *
 * Sustituye a las 743 líneas de un solo archivo que tenía toda la lógica
 * dentro: dos cargas a Supabase por pantalla, el filtro por colegio del
 * coordinador resuelto en el navegador y un guardado fila a fila.
 *
 * Aquí solo hacen falta dos filtros —colegio y fecha— porque **el día lo
 * deduce la fecha**. El sistema viejo pedía los dos y luego comprobaba que
 * cuadraran, con la comparación de días rota para el domingo.
 *
 * Los auxiliares salen en la misma lista que sus titulares, marcados con el
 * nombre de quién respaldan, y su asistencia va a su propia tabla. El lote los
 * lleva juntos en una sola transacción.
 */
const AsistenciasEntrenadores = () => {
  const contexto = useContextoAsistencias();
  const hoy = contexto.data?.hoy ?? '';

  const [colegio, setColegio] = useState('');
  const [fecha, setFecha] = useState('');

  const colegios = useColegios({ limit: 200, orden: 'nombre' });

  const items = colegios.data?.items;
  useEffect(() => {
    if (!colegio && items?.length === 1) setColegio(String(items[0].col_id));
  }, [colegio, items]);

  /** La fecha arranca en hoy, según el servidor, no según el navegador. */
  useEffect(() => {
    if (hoy && fecha === '') setFecha(hoy);
  }, [hoy, fecha]);

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

  const enviar = () => {
    if (!colegio) return;

    const marcas: MarcaPersona[] = borrador.sucias.flatMap((clave) => {
      const marca = borrador.marcas[clave];
      if (!marca || marca.asisest_id === null) return [];

      const [tipo, id] = clave.split(':');
      return [
        {
          tipo: tipo as 'entrenador' | 'auxiliar',
          id: Number(id),
          asisest_id: marca.asisest_id,
          hora_tarde: marca.asisest_id === ESTADO_ASISTENCIA.TARDE ? marca.hora : null,
          razon:
            marca.asisest_id === ESTADO_ASISTENCIA.JUSTIFICADO ? marca.razon.trim() : null,
        },
      ];
    });

    if (marcas.length === 0) return;
    guardar.mutate({ colId: Number(colegio), fecha, marcas });
  };

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

      {!colegio && (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 opacity-50" />
          <p className="text-lg">Elige un colegio para pasar lista</p>
        </div>
      )}

      {colegio && fecha && (
        <>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">
              {lista.data?.colegio.col_nombre ?? ''}
            </h2>
            <p className="text-sm text-muted-foreground">{enLetras(fecha)}</p>
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
                <ul className="divide-y overflow-hidden rounded-lg border">
                  {personas.map((persona) => {
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
                        registro={{ por: persona.registrado_por, en: persona.registrado_en }}
                        horaServidor={lista.data.hora_servidor}
                        onEstado={borrador.elegirEstado}
                        onHora={borrador.escribirHora}
                        onRazon={borrador.escribirRazon}
                      />
                    );
                  })}
                </ul>
              )}

              {personas.length > 0 && (
                <BarraGuardar
                  sinMarcar={
                    Object.values(borrador.marcas).filter((m) => m.asisest_id === null).length
                  }
                  cambios={borrador.sucias.length}
                  incompletas={borrador.incompletas.length}
                  guardando={guardar.isPending}
                  onPresenteATodos={borrador.presenteALosQueFaltan}
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
