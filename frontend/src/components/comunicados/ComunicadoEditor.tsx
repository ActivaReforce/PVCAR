import { useEffect, useMemo, useState } from 'react';
import { Eye, Loader2, Save, Send, TestTube2 } from 'lucide-react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useConfigCorreo } from '@/hooks/useCorreos';
import {
  useAccionComunicados,
  useComunicado,
  useContarDestinos,
  useOpcionesComunicados,
  usePlantillas,
  useSegmentos,
} from '@/hooks/useComunicados';
import { comunicadosApi, MAX_DESTINATARIOS, type ComunicadoInput, type Destino } from '@/api/comunicados';
import EditorCorreo from './EditorCorreo';
import SelectorDestinos from './SelectorDestinos';
import { nombreDestino } from './util';
import VistaCorreo from './VistaCorreo';
import { previsualizar } from './util';

/**
 * Crear o seguir un comunicado: Para, plantilla, asunto y cuerpo, con la
 * vista previa al lado. Guardar borrador, enviar una prueba, o enviar con
 * una confirmación que repite todo lo importante.
 */

const SIN_PLANTILLA = 'ninguna';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const vacio = (html: string) =>
  !/<(img|table)\b/i.test(html) && html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim() === '';

interface Props {
  /** null = nuevo. */
  id: number | null;
  onCerrar: () => void;
}

const ComunicadoEditor = ({ id, onCerrar }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const existente = useComunicado(id);
  const plantillas = usePlantillas();
  const opciones = useOpcionesComunicados();
  const segmentos = useSegmentos();
  const remitente = useConfigCorreo('comunicados', true);

  const [guardadoId, setGuardadoId] = useState<number | null>(id);
  const [asunto, setAsunto] = useState('');
  const [cuerpo, setCuerpo] = useState('');
  const [modo, setModo] = useState<'visual' | 'html'>('visual');
  const [plantilla, setPlantilla] = useState<string>(SIN_PLANTILLA);
  const [destinos, setDestinos] = useState<Destino[]>([]);
  const [cargado, setCargado] = useState(id === null);
  const [guardadoComo, setGuardadoComo] = useState(
    id === null ? JSON.stringify({ asunto: '', cuerpo: '', modo: 'visual', plantilla: null, destinos: [] }) : '',
  );

  const [verPrevia, setVerPrevia] = useState(false);
  const [prueba, setPrueba] = useState<string | null>(null);
  const [confirmarEnvio, setConfirmarEnvio] = useState(false);
  const [confirmarSalir, setConfirmarSalir] = useState(false);

  const datos: ComunicadoInput = useMemo(
    () => ({
      asunto: asunto.trim(),
      cuerpo,
      modo,
      plantilla: plantilla === SIN_PLANTILLA ? null : Number(plantilla),
      destinos,
    }),
    [asunto, cuerpo, modo, plantilla, destinos],
  );
  const firma = JSON.stringify(datos);
  const cambiado = cargado && firma !== guardadoComo;

  useEffect(() => {
    const c = existente.data;
    if (!c || cargado) return;
    setAsunto(c.com_asunto);
    setCuerpo(c.com_cuerpo);
    setModo(c.com_modo);
    setPlantilla(c.complan_id ? String(c.complan_id) : SIN_PLANTILLA);
    setDestinos(c.com_destinos ?? []);
    setGuardadoComo(
      JSON.stringify({
        asunto: c.com_asunto.trim(),
        cuerpo: c.com_cuerpo,
        modo: c.com_modo,
        plantilla: c.complan_id,
        destinos: c.com_destinos ?? [],
      }),
    );
    setCargado(true);
  }, [existente.data, cargado]);

  const conteo = useContarDestinos(destinos);
  const total = conteo.data?.total ?? 0;

  const htmlPlantilla =
    plantilla === SIN_PLANTILLA
      ? null
      : (plantillas.data?.find((p) => p.complan_id === Number(plantilla))?.complan_html ?? null);
  const previa = previsualizar(cuerpo, htmlPlantilla);

  const guardar = useAccionComunicados(async (d: ComunicadoInput) => {
    if (guardadoId) await comunicadosApi.editar(guardadoId, d);
    else {
      const r = await comunicadosApi.crear(d);
      setGuardadoId(r.id);
    }
    setGuardadoComo(JSON.stringify(d));
  });

  const enviarPrueba = useAccionComunicados(comunicadosApi.prueba, () => 'Prueba enviada. Revisa la bandeja (y spam).');

  const enviar = useAccionComunicados(
    async (d: ComunicadoInput) => {
      let idFinal = guardadoId;
      if (idFinal) await comunicadosApi.editar(idFinal, d);
      else idFinal = (await comunicadosApi.crear(d)).id;
      setGuardadoId(idFinal);
      setGuardadoComo(JSON.stringify(d));
      return comunicadosApi.enviar(idFinal);
    },
    (r) => `Enviando a ${r.total.toLocaleString('es-EC')} correos`,
  );

  const faltas = [
    destinos.length === 0 && 'Elige a quién se envía.',
    total > MAX_DESTINATARIOS && `Son ${total} correos; el máximo por envío es ${MAX_DESTINATARIOS}.`,
    destinos.length > 0 && !conteo.isFetching && total === 0 && 'Con lo elegido no le llega a nadie.',
    !asunto.trim() && 'Escribe el asunto.',
    vacio(cuerpo) && 'Escribe el correo.',
  ].filter(Boolean) as string[];

  const remitenteTexto = remitente.data
    ? `${remitente.data.nombre} <${remitente.data.usuario}@${remitente.data.dominio ?? '…'}>`
    : '…';

  const cerrar = () => (cambiado ? setConfirmarSalir(true) : onCerrar());

  const nombrePlantilla =
    plantilla === SIN_PLANTILLA
      ? 'Sin plantilla'
      : (plantillas.data?.find((p) => p.complan_id === Number(plantilla))?.complan_nombre ?? '—');

  return (
    <Dialog open onOpenChange={(v) => !v && cerrar()}>
      <DialogContent
        className="max-h-[96vh] w-[calc(100vw-1rem)] max-w-7xl overflow-y-auto p-4 sm:p-6"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{id ? 'Comunicado' : 'Nuevo comunicado'}</DialogTitle>
          <DialogDescription>
            Se envía en el momento. Puedes guardarlo como borrador y seguir después.
          </DialogDescription>
        </DialogHeader>

        {!cargado ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Cargando…
          </div>
        ) : (
          <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
            <div className="min-w-0 space-y-5">
              <section className="space-y-2">
                <h3 className="text-sm font-semibold">Para</h3>
                <SelectorDestinos destinos={destinos} onChange={setDestinos} />
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Plantilla</Label>
                  <Select value={plantilla} onValueChange={setPlantilla}>
                    <SelectTrigger className="h-11 sm:h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_PLANTILLA}>Sin plantilla (correo simple)</SelectItem>
                      {(plantillas.data ?? []).map((p) => (
                        <SelectItem key={p.complan_id} value={String(p.complan_id)}>
                          {p.complan_nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="com-asunto">Asunto</Label>
                  <Input
                    id="com-asunto"
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    maxLength={200}
                    className="h-11 sm:h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Correo</Label>
                <EditorCorreo valor={cuerpo} modo={modo} onChange={setCuerpo} onModo={setModo} />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full lg:hidden"
                onClick={() => setVerPrevia((v) => !v)}
              >
                <Eye className="mr-2 h-4 w-4" />
                {verPrevia ? 'Ocultar vista previa' : 'Ver vista previa'}
              </Button>
            </div>

            <aside className={verPrevia ? 'min-w-0 space-y-2' : 'hidden min-w-0 space-y-2 lg:block'}>
              <h3 className="text-sm font-semibold">Vista previa</h3>
              <p className="truncate text-xs text-muted-foreground">
                <span className="font-medium">Asunto:</span> {asunto || '—'}
              </p>
              <VistaCorreo html={previa} className="h-[70vh] min-h-[420px]" />
            </aside>
          </div>
        )}

        {cargado && (
          <DialogFooter className="flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center">
            {faltas.length > 0 && (
              <p className="text-xs text-muted-foreground sm:mr-auto">{faltas[0]}</p>
            )}
            <Button
              variant="outline"
              className="h-11 sm:h-10"
              disabled={guardar.isPending || !cambiado}
              onClick={() => guardar.mutate(datos, { onSuccess: () => toast({ title: 'Borrador guardado' }) })}
            >
              {guardar.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Guardar borrador
            </Button>
            <Button
              variant="outline"
              className="h-11 sm:h-10"
              disabled={!asunto.trim() || vacio(cuerpo)}
              onClick={() => setPrueba(user?.usu_correo ?? '')}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              Enviar prueba
            </Button>
            <Button className="h-11 sm:h-10" disabled={faltas.length > 0 || conteo.isFetching} onClick={() => setConfirmarEnvio(true)}>
              <Send className="mr-2 h-4 w-4" />
              Enviar
            </Button>
          </DialogFooter>
        )}

        {/* Prueba a una sola dirección */}
        <Dialog open={prueba !== null} onOpenChange={(v) => !v && setPrueba(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Enviar una prueba</DialogTitle>
              <DialogDescription>
                Sale solo a este correo, con «[Prueba]» delante del asunto. No cuenta como envío.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!prueba || !CORREO.test(prueba.trim())) return;
                enviarPrueba.mutate(
                  { asunto: asunto.trim(), cuerpo, plantilla: datos.plantilla, correo: prueba.trim().toLowerCase() },
                  { onSuccess: () => setPrueba(null) },
                );
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="com-prueba">Correo</Label>
                <Input
                  id="com-prueba"
                  type="email"
                  value={prueba ?? ''}
                  onChange={(e) => setPrueba(e.target.value)}
                  className="h-11 sm:h-10"
                  autoFocus
                />
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setPrueba(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={enviarPrueba.isPending || !CORREO.test((prueba ?? '').trim())}>
                  {enviarPrueba.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Enviar prueba
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmación del envío */}
        <AlertDialog open={confirmarEnvio} onOpenChange={setConfirmarEnvio}>
          <AlertDialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Enviar este comunicado?</AlertDialogTitle>
              <AlertDialogDescription>Revisa que todo esté bien. Un correo enviado no se puede retirar.</AlertDialogDescription>
            </AlertDialogHeader>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 rounded-md bg-muted/50 p-3 text-sm">
              <dt className="font-medium text-muted-foreground">Asunto</dt>
              <dd className="break-words">{asunto}</dd>
              <dt className="font-medium text-muted-foreground">Para</dt>
              <dd className="break-words">
                {destinos.map((d) => nombreDestino(d, opciones.data, segmentos.data)).join(' + ')}
              </dd>
              <dt className="font-medium text-muted-foreground">Total</dt>
              <dd>
                <strong>{total.toLocaleString('es-EC')}</strong> correos
              </dd>
              <dt className="font-medium text-muted-foreground">Plantilla</dt>
              <dd className="break-words">{nombrePlantilla}</dd>
              <dt className="font-medium text-muted-foreground">De</dt>
              <dd className="break-words">{remitenteTexto}</dd>
            </dl>
            <VistaCorreo html={previa} className="h-64" titulo="Miniatura del correo" />
            <AlertDialogFooter>
              <AlertDialogCancel disabled={enviar.isPending}>Revisar otra vez</AlertDialogCancel>
              <AlertDialogAction
                disabled={enviar.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  enviar.mutate(datos, {
                    onSuccess: () => {
                      setConfirmarEnvio(false);
                      onCerrar();
                    },
                  });
                }}
              >
                {enviar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sí, enviar a {total.toLocaleString('es-EC')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Salir con cambios */}
        <AlertDialog open={confirmarSalir} onOpenChange={setConfirmarSalir}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Salir sin guardar?</AlertDialogTitle>
              <AlertDialogDescription>Hay cambios sin guardar en este comunicado.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir editando</AlertDialogCancel>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirmarSalir(false);
                  onCerrar();
                }}
              >
                Salir sin guardar
              </Button>
              <AlertDialogAction
                onClick={() =>
                  guardar.mutate(datos, {
                    onSuccess: () => {
                      toast({ title: 'Borrador guardado' });
                      onCerrar();
                    },
                  })
                }
              >
                Guardar y salir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default ComunicadoEditor;
