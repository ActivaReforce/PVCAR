import { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { ROL } from '@/hooks/useUserForm';
import { useConfigCorreo, useGuardarConfigCorreo } from '@/hooks/useCorreos';
import type { TipoCorreo } from '@/api/correos';

interface Props {
  tipo: TipoCorreo;
  titulo: string;
  /** Qué correos salen con esta configuración, en una frase. */
  descripcion: string;
  /** Aviso interno: va a una lista fija de destinatarios ("Para"). */
  conPara?: boolean;
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USUARIO = /^[a-z0-9][a-z0-9._-]{0,63}$/;

const lineas = (texto: string) =>
  texto
    .split(/[\n,;]/)
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

/**
 * Quién envía un tipo de correo y a quién va en copia (2026-10-07).
 *
 * Solo la ve el Propietario. El dominio es fijo (el verificado en Resend) y
 * no se escribe: un dominio distinto haría que los correos dejaran de salir
 * sin avisar. Las copias son visibles: el destinatario ve a quién más llegó.
 */
const ConfigCorreo = ({ tipo, titulo, descripcion, conPara = false }: Props) => {
  const { user } = useAuth();
  const esPropietario = user?.roles.some((r) => r.rol_id === ROL.PROPIETARIO) ?? false;
  const config = useConfigCorreo(tipo, esPropietario);
  const guardar = useGuardarConfigCorreo(tipo);

  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [destinatarios, setDestinatarios] = useState('');
  const [copias, setCopias] = useState('');
  const [responderA, setResponderA] = useState('');

  const datos = config.data;
  useEffect(() => {
    if (!datos) return;
    setNombre(datos.nombre);
    setUsuario(datos.usuario);
    setDestinatarios(datos.para.join('\n'));
    setCopias(datos.cc.join('\n'));
    setResponderA(datos.responder_a ?? '');
  }, [datos]);

  if (!esPropietario || !datos) return null;

  const para = conPara ? lineas(destinatarios) : [];
  const paraMalos = para.filter((c) => !CORREO.test(c));
  const cc = lineas(copias);
  const ccMalos = cc.filter((c) => !CORREO.test(c));
  const usuarioLimpio = usuario.trim().toLowerCase();
  const responder = responderA.trim().toLowerCase();
  const errores = [
    nombre.trim().length === 0 && 'Escribe el nombre del remitente.',
    !USUARIO.test(usuarioLimpio) && 'La dirección solo admite letras, números, punto, guion y guion bajo, sin @.',
    conPara && para.length === 0 && 'Escribe al menos un destinatario: sin él, el aviso no sale.',
    paraMalos.length > 0 && `Correo mal escrito en "Para": ${paraMalos.join(', ')}.`,
    para.length > 10 && 'Como mucho 10 destinatarios.',
    ccMalos.length > 0 && `Correo mal escrito en copia: ${ccMalos.join(', ')}.`,
    cc.length > 10 && 'Como mucho 10 correos en copia.',
    responder !== '' && !CORREO.test(responder) && 'El correo de "responder a" está mal escrito.',
  ].filter(Boolean) as string[];

  const cambiado =
    nombre.trim() !== datos.nombre ||
    usuarioLimpio !== datos.usuario ||
    para.join('\n') !== datos.para.join('\n') ||
    cc.join('\n') !== datos.cc.join('\n') ||
    responder !== (datos.responder_a ?? '');

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-lg font-semibold">{titulo}</h2>
      <p className="text-sm text-muted-foreground">{descripcion}</p>

      {!datos.dominio && (
        <p className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Falta la variable CORREO_DOMINIO en Railway: mientras no esté, no sale ningún correo.
        </p>
      )}

      <div className="grid max-w-xl gap-4">
        <div className="space-y-1.5">
          <Label htmlFor={`correo-nombre-${tipo}`}>Nombre del remitente</Label>
          <Input
            id={`correo-nombre-${tipo}`}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`correo-usuario-${tipo}`}>Se envía desde</Label>
          <div className="flex min-w-0 items-center gap-1.5">
            <Input
              id={`correo-usuario-${tipo}`}
              className="min-w-0 flex-1"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              maxLength={64}
              autoCapitalize="none"
              spellCheck={false}
            />
            <span className="shrink-0 text-sm text-muted-foreground">@{datos.dominio ?? '…'}</span>
          </div>
        </div>

        {conPara && (
          <div className="space-y-1.5">
            <Label htmlFor={`correo-para-${tipo}`}>Para</Label>
            <Textarea
              id={`correo-para-${tipo}`}
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              rows={3}
              placeholder={'inscripciones@activareforce.com'}
              autoCapitalize="none"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">Un correo por línea, hasta 10.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor={`correo-cc-${tipo}`}>Con copia a</Label>
          <Textarea
            id={`correo-cc-${tipo}`}
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            rows={3}
            placeholder={'gerencia@activareforce.com'}
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Un correo por línea, hasta 10. Quien recibe el correo ve estas direcciones.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`correo-responder-${tipo}`}>Las respuestas van a</Label>
          <Input
            id={`correo-responder-${tipo}`}
            type="email"
            value={responderA}
            onChange={(e) => setResponderA(e.target.value)}
            placeholder="Opcional"
            autoCapitalize="none"
            spellCheck={false}
          />
          <p className="text-xs text-muted-foreground">
            Vacío: las respuestas van a la dirección de envío, que no tiene buzón.
          </p>
        </div>
      </div>

      {errores.length > 0 && cambiado && (
        <ul className="space-y-1 text-sm text-destructive">
          {errores.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}

      <Button
        className="h-11 sm:h-10"
        disabled={!cambiado || errores.length > 0 || guardar.isPending}
        onClick={() =>
          guardar.mutate({ nombre: nombre.trim(), usuario: usuarioLimpio, para, cc, responder_a: responder || null })
        }
      >
        <Save className="mr-2 h-4 w-4" />
        {guardar.isPending ? 'Guardando…' : 'Guardar'}
      </Button>
    </section>
  );
};

export default ConfigCorreo;
