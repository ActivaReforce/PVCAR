import { useState } from 'react';
import { KeyRound, LogIn, UserPlus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { ApiError } from '@/lib/api';
import { inscripcionesApi, type HijoDelRepresentante } from '@/api/inscripciones';
import { horarioLargo } from '@/lib/horarios';

/**
 * Representante que ya tiene cuenta (fase14b-contratos.md §9).
 *
 * Con la cédula sola no se enseña nada —son datos de menores—: solo se dice
 * si hay cuenta. Sus datos y sus hijos aparecen después de iniciar sesión.
 */

const CEDULA = /^\d{10}$/;

/** Correo y contraseña, y el mismo "Olvidé mi contraseña" del login. */
export const AccesoCuenta = ({ pista, onEntrar }: { pista: string | null; onEntrar: () => void }) => {
  const { login } = useAuth();
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setEntrando(true);
    const { error: fallo } = await login(correo.trim(), clave);
    setEntrando(false);
    if (fallo) {
      setError('El correo o la contraseña no coinciden.');
      return;
    }
    onEntrar();
  };

  return (
    <form onSubmit={entrar} className="space-y-3 rounded-md border border-primary/40 bg-primary/5 p-4">
      <p className="flex items-center gap-2 font-medium">
        <LogIn className="h-4 w-4" /> Ya tienes una cuenta: entra para no volver a llenar tus datos
      </p>
      {pista && (
        <p className="text-sm text-muted-foreground">
          Tu cuenta es la del correo <strong>{pista}</strong>. Si no cambiaste la contraseña, es tu cédula.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="acceso-correo">Correo electrónico</Label>
        <Input
          id="acceso-correo"
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className="h-11"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="acceso-clave">Contraseña</Label>
        <Input
          id="acceso-clave"
          type="password"
          autoComplete="current-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          className="h-11"
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <a
          href="/forgot-password"
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          <KeyRound className="h-4 w-4" /> Olvidé mi contraseña
        </a>
        <Button type="submit" className="h-11" disabled={entrando || !correo.trim() || !clave}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
      </div>
    </form>
  );
};

/**
 * La puerta del formulario: "Es mi primera vez" o "Ya inscribí antes". Si ya
 * hay una sesión abierta en este navegador, se pregunta si es esa persona:
 * quien del personal abra el formulario no debe inscribirse como él sin querer.
 */
export const EntradaInscripcion = ({
  onNuevo,
  onCuenta,
}: {
  /** Sigue como nuevo; la cédula, si ya la escribió buscando su cuenta. */
  onNuevo: (cedula: string) => void;
  onCuenta: () => void;
}) => {
  const { user } = useAuth();
  const [buscando, setBuscando] = useState(false);
  const [cedula, setCedula] = useState('');
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<
    { estado: 'cuenta'; pista: string } | { estado: 'inactiva' } | { estado: 'nuevo' } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  if (user) {
    return (
      <div className="space-y-4 rounded-lg border bg-background p-4 sm:p-6">
        <p className="flex items-center gap-2 text-lg font-semibold">
          <UserRound className="h-5 w-5" /> Hola, {user.usu_nombre}
        </p>
        <p className="text-sm text-muted-foreground">
          Ya iniciaste sesión en este navegador. ¿Inscribes con tu cuenta o a otra persona?
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button className="h-12 sm:h-10" onClick={onCuenta}>
            Continuar con mi cuenta
          </Button>
          {/* Sin cerrar su sesión: el formulario va como anónimo (sinSesion). */}
          <Button variant="outline" className="h-12 sm:h-10" onClick={() => onNuevo('')}>
            Inscribir a otra persona
          </Button>
        </div>
      </div>
    );
  }

  const buscar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!CEDULA.test(cedula)) {
      setError('La cédula debe tener 10 números.');
      return;
    }
    setError(null);
    setConsultando(true);
    try {
      const r = await inscripcionesApi.identificar(cedula);
      setResultado(r.estado === 'cuenta' ? { estado: 'cuenta', pista: r.correo_pista } : r);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo consultar. Revisa tu conexión.');
    } finally {
      setConsultando(false);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border bg-background p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Inscripción</h1>
      {!buscando ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Button variant="outline" className="h-auto min-h-16 justify-start gap-3 py-3 text-left" onClick={() => onNuevo('')}>
            <UserPlus className="h-5 w-5 flex-shrink-0" />
            <span>
              <span className="block font-medium">Es mi primera vez</span>
              <span className="block text-xs font-normal text-muted-foreground">Nunca inscribí a nadie en Activa Reforce</span>
            </span>
          </Button>
          <Button variant="outline" className="h-auto min-h-16 justify-start gap-3 py-3 text-left" onClick={() => setBuscando(true)}>
            <LogIn className="h-5 w-5 flex-shrink-0" />
            <span>
              <span className="block font-medium">Ya inscribí antes</span>
              <span className="block text-xs font-normal text-muted-foreground">Quiero añadir disciplinas o inscribir a otro hijo</span>
            </span>
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <form onSubmit={buscar} className="space-y-2">
            <Label htmlFor="buscar-cedula">Tu cédula (la del representante)</Label>
            <div className="flex gap-2">
              <Input
                id="buscar-cedula"
                inputMode="numeric"
                maxLength={10}
                autoComplete="off"
                value={cedula}
                onChange={(e) => {
                  setCedula(e.target.value.replace(/\D/g, ''));
                  setResultado(null);
                }}
                className="h-11"
              />
              <Button type="submit" className="h-11" disabled={consultando}>
                {consultando ? 'Buscando…' : 'Buscar'}
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </form>

          {resultado?.estado === 'cuenta' && <AccesoCuenta pista={resultado.pista} onEntrar={onCuenta} />}
          {resultado?.estado === 'inactiva' && (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <p>
                Tu cuenta está <strong>dada de baja</strong>. Puedes inscribir igual: llena el formulario y,
                cuando aprobemos la inscripción, tu cuenta se reactivará.
              </p>
              <Button className="h-11" onClick={() => onNuevo(cedula)}>
                Continuar
              </Button>
            </div>
          )}
          {resultado?.estado === 'nuevo' && (
            <div className="space-y-3 rounded-md border p-4 text-sm">
              <p>No encontramos una cuenta con esa cédula. Puedes inscribir como nuevo.</p>
              <Button className="h-11" onClick={() => onNuevo(cedula)}>
                Inscribir como nuevo
              </Button>
            </div>
          )}
          <Button variant="ghost" className="h-11" onClick={() => setBuscando(false)}>
            Volver
          </Button>
        </div>
      )}
    </div>
  );
};

/** Sus hijos, para añadirle disciplinas a uno sin volver a llenar nada. */
export const MisHijos = ({
  hijos,
  elegidos,
  onElegir,
}: {
  hijos: HijoDelRepresentante[];
  elegidos: number[];
  onElegir: (h: HijoDelRepresentante) => void;
}) => {
  const libres = hijos.filter((h) => !elegidos.includes(h.nino_id));
  if (hijos.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Tus hijos</p>
      {libres.length === 0 && (
        <p className="text-sm text-muted-foreground">Ya están todos en esta inscripción.</p>
      )}
      {libres.map((h) => (
        <div
          key={h.nino_id}
          className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 text-sm">
            <p className="font-medium">{h.nombre}</p>
            <p className="text-muted-foreground">{h.col_nombre}</p>
            {h.activas.length > 0 ? (
              <p className="break-words text-xs text-muted-foreground">
                Ya inscrito en: {h.activas.map((a) => `${a.actividad} (${horarioLargo(a.horarios)})`).join(', ')}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Sin disciplinas activas</p>
            )}
          </div>
          <Button variant="outline" className="h-11 flex-shrink-0" onClick={() => onElegir(h)}>
            Añadir disciplinas
          </Button>
        </div>
      ))}
    </div>
  );
};
