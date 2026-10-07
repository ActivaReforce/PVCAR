import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Grafica from '@/components/graficas/Grafica';
import { TIPO } from '@/api/encuestas';
import { useResultados } from '@/hooks/useEncuestas';

interface Props {
  encuId: number | null;
}

/**
 * Los resultados de una encuesta.
 *
 * **Son anónimos.** Quién respondió está en `encuesta_respondida` —hace falta
 * para saber a quién le falta— pero los resultados no lo cruzan: se contesta con
 * más franqueza cuando la respuesta no lleva nombre, y quien lee un agregado no
 * necesita saberlo.
 *
 * Las de escala y las de sí/no se dibujan; las de texto, fecha y hora se listan.
 * Se reusa el mismo componente de gráfica de los reportes, así que los ejes, el
 * tooltip y la vista de tabla son exactamente los mismos de todo el sistema.
 */
const ResultadosEncuesta = ({ encuId }: Props) => {
  const resultados = useResultados(encuId);

  if (resultados.isLoading) {
    return <p className="py-8 text-center text-muted-foreground">Calculando resultados…</p>;
  }

  if (resultados.isError) {
    return (
      <p className="py-8 text-center text-destructive">{(resultados.error as Error).message}</p>
    );
  }

  const datos = resultados.data;
  if (!datos) return null;

  const { encuesta, preguntas } = datos;
  const proporcion =
    encuesta.representantes > 0
      ? Math.round((encuesta.respondidas / encuesta.representantes) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-2 p-4">
          <div>
            <div className="text-2xl font-semibold">{encuesta.respondidas}</div>
            <div className="text-sm text-muted-foreground">
              de {encuesta.representantes} representantes · {proporcion}%
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Las respuestas son anónimas: no se cruza quién contestó qué.
          </p>
        </CardContent>
      </Card>

      {encuesta.respondidas === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg">Todavía no la ha respondido nadie</p>
          </CardContent>
        </Card>
      )}

      {encuesta.respondidas > 0 &&
        preguntas.map((p) => {
          const esGrafica = p.encutiporesp_id === TIPO.ESCALA || p.encutiporesp_id === TIPO.SI_NO;

          if (esGrafica && p.conteos.length > 0) {
            return (
              <Grafica
                key={p.encupreg_id}
                grafica={{
                  id: `pregunta-${p.encupreg_id}`,
                  titulo: `${p.encupreg_orden}. ${p.encupreg_pregunta}`,
                  descripcion:
                    p.promedio !== null
                      ? `${p.respuestas} respuestas · promedio ${p.promedio}`
                      : `${p.respuestas} respuestas`,
                  forma: 'barras',
                  etiqueta: 'etiqueta',
                  series: [{ clave: 'valor', nombre: 'Respuestas' }],
                  formato: 'entero',
                  datos: p.conteos as unknown as Array<Record<string, unknown>>,
                }}
              />
            );
          }

          return (
            <Card key={p.encupreg_id}>
              <CardHeader className="pb-2">
                <CardTitle className="break-words text-base">
                  {p.encupreg_orden}. {p.encupreg_pregunta}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {p.encutiporesp_nombre} · {p.respuestas} respuesta
                  {p.respuestas === 1 ? '' : 's'}
                </p>
              </CardHeader>
              <CardContent>
                {p.textos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sin respuestas.</p>
                ) : (
                  <ul className="space-y-2">
                    {p.textos.map((texto, i) => (
                      <li key={i} className="break-words rounded-md bg-muted/50 px-3 py-2 text-sm">
                        {texto}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
    </div>
  );
};

export default ResultadosEncuesta;
