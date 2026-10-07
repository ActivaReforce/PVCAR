import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConditionalAction } from '@/components/ui/conditional-actions';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfigInscripciones, useGuardarMaxDisciplinas } from '@/hooks/useInscripciones';

/**
 * Cuántas disciplinas puede elegir cada alumno en el formulario público
 * (Disciplinas v2, cliente 2026-10-06). Es solo del formulario: desde
 * Estudiantes el personal puede inscribirlo en más.
 */
const MaxDisciplinas = () => {
  const config = useConfigInscripciones();
  const guardar = useGuardarMaxDisciplinas();
  const { hasPermission } = usePermissions();
  const [valor, setValor] = useState('');

  const guardado = config.data?.max_disciplinas ?? 2;
  useEffect(() => {
    setValor(String(guardado));
  }, [guardado]);

  if (!config.data) return null;

  const numero = Number(valor);
  const valido = Number.isInteger(numero) && numero >= 1 && numero <= 10;

  return (
    <section className="space-y-3 border-t pt-6">
      <h2 className="text-lg font-semibold">Disciplinas por alumno</h2>
      <p className="text-sm text-muted-foreground">
        Cuántas puede elegir cada alumno en el formulario. Desde Estudiantes se le pueden dar más.
      </p>
      {hasPermission('inscripciones', 'editar') ? (
        <div className="max-w-[10rem] space-y-1.5">
          <Label htmlFor="max-disciplinas">Máximo</Label>
          <Input
            id="max-disciplinas"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            aria-invalid={!valido}
            className="h-11 sm:h-10"
          />
        </div>
      ) : (
        <p className="text-sm">{guardado}</p>
      )}
      <ConditionalAction module="inscripciones" action="editar">
        <Button
          className="h-11 sm:h-10"
          disabled={!valido || numero === guardado || guardar.isPending}
          onClick={() => guardar.mutate(numero)}
        >
          <Save className="mr-2 h-4 w-4" />
          {guardar.isPending ? 'Guardando…' : 'Guardar'}
        </Button>
      </ConditionalAction>
    </section>
  );
};

export default MaxDisciplinas;
