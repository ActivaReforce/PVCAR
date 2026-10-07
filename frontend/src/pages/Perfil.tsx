import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Baby, CalendarDays, Mail, Phone, School, Settings, UserCog, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConfiguracionPerfil from "@/components/perfil/ConfiguracionPerfil";
import { useAuth } from "@/contexts/AuthContext";
import { perfilApi } from "@/api/perfil";
import { ZONA } from "@/lib/fecha";

const fecha = (iso?: string | null) => {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("es-EC", { dateStyle: "long", timeZone: ZONA }).format(new Date(iso));
  } catch {
    return "—";
  }
};

const iniciales = (nombre: string) =>
  nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";

const Seccion = ({ titulo, icono, children }: { titulo: string; icono: ReactNode; children: ReactNode }) => (
  <section className="space-y-3 rounded-lg border bg-card p-4 sm:p-5">
    <h2 className="flex items-center gap-2 font-semibold">
      {icono}
      {titulo}
    </h2>
    {children}
  </section>
);

/**
 * Perfil (rehecho el 2026-10-07): quién soy, mis datos y lo que tengo a cargo
 * según mis roles —colegios, disciplinas, a quién respaldo, mis hijos—. Lo
 * editable (foto, nombre, teléfono y contraseña) vive en Configuración.
 *
 * Todos los roles, no solo el "principal": quien es coordinador y entrenador
 * a la vez lo es de verdad (decisión D2).
 */
const Perfil = () => {
  const { user } = useAuth();
  const [configurando, setConfigurando] = useState(false);

  /** El bucket de fotos es privado: GET /perfil trae la URL ya firmada. */
  const perfil = useQuery({ queryKey: ["perfil"], queryFn: () => perfilApi.obtener() });
  const resumen = useQuery({ queryKey: ["perfil", "resumen"], queryFn: () => perfilApi.resumen() });

  const p = perfil.data;
  const r = resumen.data;

  if (perfil.isLoading) {
    return <p className="py-16 text-center text-muted-foreground">Cargando…</p>;
  }
  if (!p) {
    return <p className="py-16 text-center text-destructive">No se pudo cargar el perfil.</p>;
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-4 p-4 lg:p-6">
      <section className="flex flex-col items-center gap-4 rounded-lg border bg-card p-5 text-center sm:flex-row sm:text-left">
        <Avatar className="h-24 w-24 border-4 border-primary sm:h-28 sm:w-28">
          <AvatarImage src={p.usu_foto_url ?? undefined} alt="" />
          <AvatarFallback className="text-2xl">{iniciales(p.usu_nombre)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="break-words text-2xl font-bold">{p.usu_nombre}</h1>
          <p className="break-all text-muted-foreground">{p.usu_correo}</p>
          <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {(user?.roles ?? []).map((rol) => (
              <Badge key={rol.rol_id} variant="secondary">
                {rol.rol_titulo}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" className="h-11 w-full sm:h-10 sm:w-auto" onClick={() => setConfigurando(true)}>
          <Settings className="mr-2 h-4 w-4" />
          Configuración
        </Button>
      </section>

      <Seccion titulo="Mis datos" icono={<UserCog className="h-4 w-4 text-muted-foreground" />}>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <dd className="break-all">{p.usu_correo}</dd>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <dd>{p.usu_telefono || "Sin teléfono"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cédula</dt>
            <dd>{p.usu_cedula || "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Cuenta creada</dt>
            <dd>{fecha(p.usu_fecha_creacion)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Última actualización</dt>
            <dd>{fecha(p.usu_fecha_modificacion)}</dd>
          </div>
        </dl>
      </Seccion>

      {r && r.colegios.length > 0 && (
        <Seccion titulo="Colegios que coordino" icono={<School className="h-4 w-4 text-muted-foreground" />}>
          <ul className="flex flex-wrap gap-2">
            {r.colegios.map((c) => (
              <li key={c.col_id}>
                <Badge variant="outline">{c.col_nombre}</Badge>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {r && r.disciplinas.length > 0 && (
        <Seccion titulo="Disciplinas que doy" icono={<CalendarDays className="h-4 w-4 text-muted-foreground" />}>
          <ul className="divide-y text-sm">
            {r.disciplinas.map((d) => (
              <li key={d.colacthor_id} className="py-2">
                <p className="font-medium">{d.act_nombre}</p>
                <p className="break-words text-muted-foreground">
                  {d.col_nombre} · {d.horario ?? "sin horario"} · {d.alumnos} alumnos
                </p>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {r && r.titulares.length > 0 && (
        <Seccion titulo="Entrenadores a los que respaldo" icono={<Users className="h-4 w-4 text-muted-foreground" />}>
          <ul className="flex flex-wrap gap-2">
            {r.titulares.map((t) => (
              <li key={t.ent_id}>
                <Badge variant="outline">{t.usu_nombre}</Badge>
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      {r && r.hijos.length > 0 && (
        <Seccion titulo="Mis hijos" icono={<Baby className="h-4 w-4 text-muted-foreground" />}>
          <ul className="divide-y text-sm">
            {r.hijos.map((h) => (
              <li key={h.nino_id} className="py-2">
                <p className="font-medium">{h.nombre}</p>
                <p className="text-muted-foreground">{h.col_nombre}</p>
                {h.disciplinas.length > 0 ? (
                  <ul className="mt-1 space-y-0.5">
                    {h.disciplinas.map((d) => (
                      <li key={`${d.actividad}-${d.horario}`} className="break-words">
                        {d.actividad} · <span className="text-muted-foreground">{d.horario}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">Sin disciplinas activas</p>
                )}
              </li>
            ))}
          </ul>
        </Seccion>
      )}

      <ConfiguracionPerfil abierto={configurando} perfil={p} onCerrar={() => setConfigurando(false)} />
    </div>
  );
};

export default Perfil;
