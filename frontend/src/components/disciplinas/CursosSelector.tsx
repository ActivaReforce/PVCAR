import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useGradosDisciplina } from '@/hooks/useDisciplinas';
import { cursoCorto } from '@/lib/cursos';

interface Props {
  value: number[];
  onChange: (grados: number[]) => void;
}

/**
 * Para qué cursos es la disciplina, con botones como los días. El formulario
 * público solo se la ofrece a los alumnos de esos cursos. Siempre hay al
 * menos uno: no hay "ninguno".
 */
const CursosSelector = ({ value, onChange }: Props) => {
  const grados = useGradosDisciplina();
  const todos = (grados.data ?? []).map((g) => g.catninograd_id);
  const estanTodos = todos.length > 0 && todos.every((id) => value.includes(id));

  const alternar = (id: number) =>
    onChange(
      value.includes(id) ? value.filter((g) => g !== id) : [...value, id].sort((a, b) => a - b),
    );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Cursos *</Label>
        {!estanTodos && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(todos)}>
            Marcar todos
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {(grados.data ?? []).map((g) => {
          const activo = value.includes(g.catninograd_id);
          return (
            <button
              key={g.catninograd_id}
              type="button"
              onClick={() => alternar(g.catninograd_id)}
              aria-pressed={activo}
              title={g.catninograd_nombre}
              className={`min-h-11 rounded-md border px-3 py-2 text-sm transition-colors ${
                activo
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {cursoCorto(g.catninograd_nombre)}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        En la inscripción solo se ofrece a los alumnos de los cursos marcados.
      </p>
    </div>
  );
};

export default CursosSelector;
