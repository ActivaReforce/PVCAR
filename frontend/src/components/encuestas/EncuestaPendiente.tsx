import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Send } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { TIPO, type RespuestaInput } from '@/api/encuestas';
import {
  useEncuestaParaResponder,
  useMisEncuestas,
  useResponderEncuesta,
} from '@/hooks/useEncuestas';
import { usePermissions } from '@/hooks/usePermissions';

interface Valor {
  texto: string;
  numero: number | null;
  fecha: string;
  hora: string;
  sino: boolean | null;
}

const vacio = (): Valor => ({ texto: '', numero: null, fecha: '', hora: '', sino: null });

/**
 * La encuesta pendiente de un representante.
 *
 * ---------------------------------------------------------------------------
 * Dónde se monta, y por qué importa
 *
 * El modal viejo se montaba en `App.tsx`, **fuera de la ruta**, así que
 * consultaba `encuesta` y `encuesta_respondida` directo a Supabase en **todas
 * las pantallas del sistema** — y con RLS eso son errores de permiso en la
 * consola de todas ellas. Estaba desmontado desde la Fase 4 por ese motivo.
 *
 * Ahora vive dentro del layout, pregunta una sola vez al API y **solo si quien
 * mira es representante**: sin el rol, ni siquiera se hace la llamada.
 *
 * ---------------------------------------------------------------------------
 * Una pregunta por pantalla
 *
 * Es un formulario que se contesta desde el teléfono, así que va de una en una
 * con su barra de avance, como el de evaluar alumnos. El viejo pintaba las seis
 * de golpe.
 *
 * No se puede cerrar hasta responder —de ahí lo de "obligatoria"— pero sí se
 * puede dejar para luego con el botón de abajo: obligar de verdad a alguien a
 * contestar para poder usar el sistema no es una encuesta, es un peaje.
 */
const EncuestaPendiente = () => {
  const { hasPermission } = usePermissions();

  /**
   * Solo los representantes. `reporte_estudiante:ver` es el permiso que solo
   * tiene ese rol, y es la forma de saberlo sin pedir nada al servidor.
   */
  const esRepresentante = hasPermission('reporte_estudiante', 'ver');

  const mias = useMisEncuestas(esRepresentante);
  const pendiente = useMemo(
    () => (mias.data ?? []).find((e) => !e.respondida) ?? null,
    [mias.data],
  );

  const [aplazada, setAplazada] = useState<number | null>(null);
  const [paso, setPaso] = useState(0);
  const [valores, setValores] = useState<Record<number, Valor>>({});

  const abierta = pendiente !== null && aplazada !== pendiente.encu_id;

  const ficha = useEncuestaParaResponder(abierta ? pendiente.encu_id : null);
  const responder = useResponderEncuesta();

  const preguntas = useMemo(() => ficha.data?.preguntas ?? [], [ficha.data]);

  useEffect(() => {
    setValores(Object.fromEntries(preguntas.map((p) => [p.encupreg_id, vacio()])));
    setPaso(0);
  }, [preguntas]);

  if (!abierta || !pendiente) return null;

  const pregunta = preguntas[paso];
  const valor = pregunta ? (valores[pregunta.encupreg_id] ?? vacio()) : vacio();

  const cambiar = (cambios: Partial<Valor>) => {
    if (!pregunta) return;
    setValores((previos) => ({
      ...previos,
      [pregunta.encupreg_id]: { ...(previos[pregunta.encupreg_id] ?? vacio()), ...cambios },
    }));
  };

  const contestada = (encupregId: number, tipo: number): boolean => {
    const v = valores[encupregId];
    if (!v) return false;
    if (tipo === TIPO.TEXTO_CORTO || tipo === TIPO.TEXTO_LARGO) return v.texto.trim().length > 0;
    if (tipo === TIPO.ESCALA) return v.numero !== null;
    if (tipo === TIPO.FECHA) return v.fecha !== '';
    if (tipo === TIPO.HORA) return v.hora !== '';
    return v.sino !== null;
  };

  const hechas = preguntas.filter((p) => contestada(p.encupreg_id, p.encutiporesp_id)).length;
  const completa = hechas === preguntas.length && preguntas.length > 0;

  const enviar = async () => {
    const respuestas: RespuestaInput[] = preguntas.map((p) => {
      const v = valores[p.encupreg_id] ?? vacio();
      switch (p.encutiporesp_id) {
        case TIPO.TEXTO_CORTO:
        case TIPO.TEXTO_LARGO:
          return { encupreg_id: p.encupreg_id, texto: v.texto.trim() };
        case TIPO.ESCALA:
          return { encupreg_id: p.encupreg_id, numero: v.numero };
        case TIPO.FECHA:
          return { encupreg_id: p.encupreg_id, fecha: v.fecha };
        case TIPO.HORA:
          return { encupreg_id: p.encupreg_id, hora: v.hora };
        default:
          return { encupreg_id: p.encupreg_id, sino: v.sino };
      }
    });

    try {
      await responder.mutateAsync({ id: pendiente.encu_id, respuestas });
    } catch {
      // El hook ya enseña el motivo y el formulario conserva lo escrito.
    }
  };

  return (
    <Dialog open onOpenChange={() => undefined}>
      <DialogContent
        className="flex max-h-[90vh] flex-col sm:max-w-lg"
        /* Sin botón de cerrar ni cierre con Escape: se responde o se aplaza. */
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="break-words text-lg sm:text-xl">
            {pendiente.encu_titulo}
          </DialogTitle>
          {pendiente.encu_descripcion && (
            <DialogDescription className="break-words">
              {pendiente.encu_descripcion}
            </DialogDescription>
          )}
        </DialogHeader>

        {ficha.isLoading && (
          <p className="py-8 text-center text-muted-foreground">Cargando la encuesta…</p>
        )}

        {pregunta && (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Pregunta {paso + 1} de {preguntas.length}
                </span>
                <span>{hechas} contestadas</span>
              </div>
              <Progress value={(hechas / Math.max(1, preguntas.length)) * 100} />
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-2">
              <div>
                <h3 className="break-words font-medium">{pregunta.encupreg_pregunta}</h3>
                {pregunta.encupreg_nota && (
                  <p className="mt-1 text-sm text-muted-foreground">{pregunta.encupreg_nota}</p>
                )}
              </div>

              {pregunta.encutiporesp_id === TIPO.TEXTO_CORTO && (
                <Input
                  value={valor.texto}
                  onChange={(e) => cambiar({ texto: e.target.value })}
                  className="h-11 sm:h-10"
                  aria-label={pregunta.encupreg_pregunta}
                />
              )}

              {pregunta.encutiporesp_id === TIPO.TEXTO_LARGO && (
                <Textarea
                  value={valor.texto}
                  onChange={(e) => cambiar({ texto: e.target.value })}
                  rows={4}
                  className="resize-none"
                  aria-label={pregunta.encupreg_pregunta}
                />
              )}

              {pregunta.encutiporesp_id === TIPO.ESCALA && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(
                    {
                      length:
                        (pregunta.encupreg_escala_max ?? 5) -
                        (pregunta.encupreg_escala_min ?? 1) +
                        1,
                    },
                    (_, i) => (pregunta.encupreg_escala_min ?? 1) + i,
                  ).map((n) => (
                    <Button
                      key={n}
                      type="button"
                      variant={valor.numero === n ? 'default' : 'outline'}
                      className="h-11 w-11 p-0"
                      onClick={() => cambiar({ numero: n })}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              )}

              {pregunta.encutiporesp_id === TIPO.FECHA && (
                <Input
                  type="date"
                  value={valor.fecha}
                  onChange={(e) => cambiar({ fecha: e.target.value })}
                  className="h-11 sm:h-10"
                  aria-label={pregunta.encupreg_pregunta}
                />
              )}

              {pregunta.encutiporesp_id === TIPO.HORA && (
                <Input
                  type="time"
                  value={valor.hora}
                  onChange={(e) => cambiar({ hora: e.target.value })}
                  className="h-11 w-36 sm:h-10"
                  aria-label={pregunta.encupreg_pregunta}
                />
              )}

              {pregunta.encutiporesp_id === TIPO.SI_NO && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={valor.sino === true ? 'default' : 'outline'}
                    className="h-11"
                    onClick={() => cambiar({ sino: true })}
                  >
                    Sí
                  </Button>
                  <Button
                    type="button"
                    variant={valor.sino === false ? 'default' : 'outline'}
                    className="h-11"
                    onClick={() => cambiar({ sino: false })}
                  >
                    No
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 border-t pt-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 flex-1"
                  onClick={() => setPaso((p) => Math.max(0, p - 1))}
                  disabled={paso === 0}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Anterior
                </Button>

                {paso < preguntas.length - 1 ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 flex-1"
                    onClick={() => setPaso((p) => p + 1)}
                  >
                    Siguiente
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="brand"
                    className="h-11 flex-1"
                    onClick={enviar}
                    disabled={!completa || responder.isPending}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {responder.isPending ? 'Enviando…' : 'Enviar'}
                  </Button>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className="h-9 w-full text-sm text-muted-foreground"
                onClick={() => setAplazada(pendiente.encu_id)}
              >
                Ahora no, la respondo luego
              </Button>

              {!completa && paso === preguntas.length - 1 && (
                <p className="text-center text-xs text-muted-foreground">
                  Falta{preguntas.length - hechas === 1 ? '' : 'n'}{' '}
                  {preguntas.length - hechas} por contestar.
                </p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default EncuestaPendiente;
