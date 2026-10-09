import { useEffect, useState } from 'react';
import { GraduationCap, Megaphone, Save, UserCog } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useCrearNovedad } from '@/hooks/useNovedades';
import type { TipoNovedad } from '@/api/novedades';
import SelectorMenciones from './SelectorMenciones';

interface Props {
  abierto: boolean;
  onCerrar: () => void;
}

const TIPOS: Array<{ id: TipoNovedad; etiqueta: string; icono: typeof Megaphone; descripcion: string }> = [
  { id: 'general', etiqueta: 'General', icono: Megaphone, descripcion: 'Avisa a Activa Reforce sin ligarlo a nadie.' },
  { id: 'personal', etiqueta: 'Personal de Activa Reforce', icono: UserCog, descripcion: 'Novedad sobre una o varias personas.' },
  { id: 'alumno', etiqueta: 'Alumnos', icono: GraduationCap, descripcion: 'Novedad sobre uno o varios alumnos.' },
];

const CrearNovedadDialog = ({ abierto, onCerrar }: Props) => {
  const [tipo, setTipo] = useState<TipoNovedad>('general');
  const [texto, setTexto] = useState('');
  const [personas, setPersonas] = useState<number[]>([]);
  const [alumnos, setAlumnos] = useState<number[]>([]);
  const crear = useCrearNovedad();

  useEffect(() => {
    if (abierto) {
      setTipo('general');
      setTexto('');
      setPersonas([]);
      setAlumnos([]);
    }
  }, [abierto]);

  const textoLimpio = texto.trim();
  const faltaTexto = textoLimpio.length === 0;
  const faltanMenciones =
    (tipo === 'personal' && personas.length === 0) ||
    (tipo === 'alumno' && alumnos.length === 0);
  const bloqueado = faltaTexto || faltanMenciones || crear.isPending;

  const enviar = async () => {
    if (bloqueado) return;
    try {
      if (tipo === 'general') {
        await crear.mutateAsync({ tipo: 'general', texto: textoLimpio });
      } else if (tipo === 'personal') {
        await crear.mutateAsync({ tipo: 'personal', texto: textoLimpio, usu_ids: personas });
      } else {
        await crear.mutateAsync({ tipo: 'alumno', texto: textoLimpio, nino_ids: alumnos });
      }
      onCerrar();
    } catch {
      // El hook ya enseña el toast.
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(v) => (!v ? onCerrar() : undefined)}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Nueva novedad</DialogTitle>
          <DialogDescription>
            Escríbela una vez y le llegará al correo configurado por el administrador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-2 sm:grid-cols-3">
            {TIPOS.map((t) => {
              const activo = tipo === t.id;
              const Icono = t.icono;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  className={`flex min-h-20 flex-col items-start gap-1 rounded-lg border p-3 text-left text-sm transition hover:border-primary ${
                    activo ? 'border-primary bg-primary/5' : 'bg-background'
                  }`}
                >
                  <Icono className={`h-5 w-5 ${activo ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium leading-tight">{t.etiqueta}</span>
                  <span className="text-xs text-muted-foreground leading-snug">{t.descripcion}</span>
                </button>
              );
            })}
          </div>

          {tipo === 'personal' && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">¿Sobre quién?</h3>
              <SelectorMenciones tipo="personal" seleccionados={personas} onCambio={setPersonas} />
            </div>
          )}
          {tipo === 'alumno' && (
            <div className="space-y-1.5">
              <h3 className="text-sm font-medium">¿Sobre qué alumno(s)?</h3>
              <SelectorMenciones tipo="alumno" seleccionados={alumnos} onCambio={setAlumnos} />
            </div>
          )}

          <div className="space-y-1.5">
            <h3 className="text-sm font-medium">¿Qué pasó?</h3>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={5}
              maxLength={1000}
              placeholder="Describe la novedad…"
            />
            <p className="text-xs text-muted-foreground">
              {textoLimpio.length}/1000
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCerrar} disabled={crear.isPending}>
            Cancelar
          </Button>
          <Button onClick={enviar} disabled={bloqueado}>
            <Save className="mr-2 h-4 w-4" />
            {crear.isPending ? 'Guardando…' : 'Enviar novedad'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CrearNovedadDialog;
