import { useState } from 'react';
import { AlertTriangle, Archive, Info, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAnularInscripcion, usePreviaAnulacion } from '@/hooks/useInscripciones';
import { dinero, type InscripcionDetalle, type PlanAnulacion } from '@/api/inscripciones';

interface Props {
  inscripcion: InscripcionDetalle | null;
  onClose: () => void;
  onAnulada: () => void;
}

const sinTildes = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

const lista = (cosas: string[]) =>
  cosas.length <= 1 ? (cosas[0] ?? '') : `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;

/**
 * Anular una aprobada (pedido del cliente, 2026-10-26): el representante
 * vuelve a inscribirse desde cero. El panel enseña, cosa por cosa, lo que el
 * backend va a hacer: lo que se borra para siempre y lo que se conserva (con
 * el porqué), que es lo que ya tiene asistencias, evaluaciones o novedades.
 */
const AnularInscripcionDialog = ({ inscripcion, onClose, onAnulada }: Props) => {
  const [confirmacion, setConfirmacion] = useState('');
  const previa = usePreviaAnulacion(inscripcion?.ins_id ?? null);
  const anular = useAnularInscripcion();

  const nombre = inscripcion?.ins_representante.nombre ?? '';
  const coincide = sinTildes(confirmacion) === sinTildes(nombre) && nombre.length > 0;

  const cerrar = () => {
    setConfirmacion('');
    onClose();
  };

  const confirmar = async () => {
    if (!inscripcion) return;
    try {
      await anular.mutateAsync({ id: inscripcion.ins_id, confirmacion });
      setConfirmacion('');
      onAnulada();
    } catch {
      // El hook ya muestra el motivo.
    }
  };

  return (
    <Dialog open={inscripcion !== null} onOpenChange={(abierto) => !abierto && cerrar()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Anular inscripción{inscripcion ? ` Nº ${inscripcion.ins_id}` : ''}
          </DialogTitle>
          <DialogDescription className="break-words">
            Es para que <strong>{nombre}</strong> vuelva a inscribirse desde cero. Lo que trajo esta
            inscripción se borra para siempre. No se puede deshacer.
          </DialogDescription>
        </DialogHeader>

        {previa.isLoading && <p className="text-sm text-muted-foreground">Revisando qué tiene registrado…</p>}
        {previa.isError && (
          <p className="text-sm text-destructive">No se pudo revisar: {(previa.error as Error).message}</p>
        )}
        {previa.data && <Plan plan={previa.data} />}

        {previa.data && (
          <div className="space-y-2">
            <Label htmlFor="confirmacion-anulacion">
              Escribe <strong>{nombre}</strong> para confirmar
            </Label>
            <Input
              id="confirmacion-anulacion"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              autoComplete="off"
            />
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-0">
          <Button variant="outline" onClick={cerrar} className="h-11 sm:h-10">
            Cancelar
          </Button>
          <Button
            variant="destructive"
            className="h-11 sm:h-10"
            onClick={confirmar}
            disabled={!previa.data || !coincide || anular.isPending}
          >
            {anular.isPending ? 'Anulando…' : 'Anular inscripción'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Plan = ({ plan }: { plan: PlanAnulacion }) => {
  const seBorra: React.ReactNode[] = [];
  const seConserva: React.ReactNode[] = [];

  for (const a of plan.alumnos) {
    const borradas = a.disciplinas.filter((d) => d.accion === 'eliminar').map((d) => d.nombre);
    const deBaja = a.disciplinas.filter((d) => d.accion === 'baja').map((d) => d.nombre);
    const cerradas = a.disciplinas.filter((d) => d.accion === 'ya_cerrada').map((d) => d.nombre);

    if (a.destino === 'ya_no_existe') {
      seConserva.push(
        <li key={`a${a.insnino_id}`}>
          <strong>{a.nombre}</strong> ya no está en Estudiantes (lo borraron antes): no hay nada suyo que borrar.
        </li>,
      );
      continue;
    }
    if (a.destino === 'eliminar') {
      seBorra.push(
        <li key={`a${a.insnino_id}`}>
          <strong>{a.nombre}</strong>: el alumno entero (ficha, contactos de emergencia y de retiro, vínculo con el
          representante){borradas.length > 0 && <> y sus disciplinas: {lista(borradas)}</>}.
        </li>,
      );
      continue;
    }
    if (borradas.length > 0) {
      seBorra.push(
        <li key={`b${a.insnino_id}`}>
          De <strong>{a.nombre}</strong>: {borradas.length === 1 ? 'la disciplina' : 'las disciplinas'}{' '}
          {lista(borradas)}.
        </li>,
      );
    }
    if (a.soltar_padre) {
      seBorra.push(
        <li key={`p${a.insnino_id}`}>
          El vínculo de <strong>{a.nombre}</strong> con {plan.cuenta.nombre}.
        </li>,
      );
    }
    seConserva.push(
      <li key={`a${a.insnino_id}`}>
        {a.destino === 'baja' ? (
          <>
            <strong>{a.nombre}</strong> pasa a <strong>baja</strong>, no se borra: tiene {lista(a.motivos)}. Se
            conservan para que los reportes no cambien.
            {deBaja.length > 0 && <> Sus disciplinas con historia también pasan a baja: {lista(deBaja)}.</>}{' '}
            Si vuelve a inscribirse, al aprobar marca que es el mismo alumno y se reactiva.
          </>
        ) : (
          <>
            <strong>{a.nombre}</strong> se queda como está porque {lista(a.motivos)}.
            {deBaja.length > 0 && <> Las disciplinas de esta inscripción con historia pasan a baja: {lista(deBaja)}.</>}{' '}
            Los datos que esta inscripción le actualizó no vuelven atrás.
          </>
        )}
        {cerradas.length > 0 && <> Ya estaban de baja y se quedan así: {lista(cerradas)}.</>}
      </li>,
    );
  }

  const c = plan.cuenta;
  if (c.destino === 'eliminar') {
    seBorra.push(
      <li key="cuenta">
        La cuenta de <strong>{c.nombre}</strong> ({c.correo}): su acceso, su rol de representante y sus datos de
        factura. Podrá inscribirse otra vez con la misma cédula y el mismo correo.
      </li>,
    );
  } else if (c.destino === 'baja') {
    seConserva.push(
      <li key="cuenta">
        La cuenta de <strong>{c.nombre}</strong> pasa a <strong>baja</strong>, no se borra: {lista(c.motivos)}. No
        podrá entrar; si vuelve a inscribirse con su cédula, se reactiva al aprobar.
      </li>,
    );
  } else if (c.destino === 'se_queda') {
    seConserva.push(
      <li key="cuenta">
        La cuenta de <strong>{c.nombre}</strong> se queda como está: {lista(c.motivos)}. Solo se quita lo que trajo
        esta inscripción.
      </li>,
    );
  }

  seBorra.push(
    <li key="ins">
      La inscripción, el comprobante de pago y {plan.archivos - 1 === 1 ? 'el PDF firmado' : `los ${plan.archivos - 1} PDF firmados`}.
    </li>,
  );

  return (
    <div className="space-y-3 text-sm">
      <section className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
        <p className="mb-1 flex items-center gap-1.5 font-medium">
          <Trash2 className="h-4 w-4 text-destructive" /> Se borra para siempre
        </p>
        <ul className="list-disc space-y-1 pl-5">{seBorra}</ul>
      </section>

      {seConserva.length > 0 && (
        <section className="rounded-md border border-amber-500/50 bg-amber-50 p-3 dark:bg-amber-950/30">
          <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-900 dark:text-amber-200">
            <Archive className="h-4 w-4" /> No se borra
          </p>
          <ul className="list-disc space-y-1 pl-5">{seConserva}</ul>
        </section>
      )}

      <section className="rounded-md border p-3 text-muted-foreground">
        <p className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
          <Info className="h-4 w-4" /> Además
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Sus <strong>{dinero(plan.valor)}</strong> dejan de contar en el Total recaudado.
          </li>
          <li>En el reporte de Inscripciones queda como «Anulada», con quién la anuló y cuándo.</li>
          <li>
            <strong>No se le avisa</strong> al representante: avísale tú (y devuélvele el pago si corresponde).
          </li>
        </ul>
      </section>
    </div>
  );
};

export default AnularInscripcionDialog;
