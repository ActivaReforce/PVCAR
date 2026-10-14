import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useGradosDisciplina } from '@/hooks/useDisciplinas';
import { cursoCorto } from '@/lib/cursos';

interface Props {
  value: number[];
  onChange: (grados: number[]) => void;
}

/**
 * Para qué cursos es la disciplina. El formulario público solo se la ofrece
 * a los alumnos de esos cursos.
 */
const CursosSelector = ({ value, onChange }: Props) => {
  const grados = useGradosDisciplina();
  const todos = (grados.data ?? []).map((g) => g.catninograd_id);

  const alternar = (id: number, marcado: boolean) =>
    onChange(marcado ? [...value, id].sort((a, b) => a - b) : value.filter((g) => g !== id));

  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium">Cursos *</legend>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(todos)}>
            Todos
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
            Ninguno
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        En la inscripción solo se ofrece a los alumnos de los cursos marcados.
      </p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {(grados.data ?? []).map((g) => {
          const id = `curso-${g.catninograd_id}`;
          return (
            <Label
              key={g.catninograd_id}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-2 font-normal sm:min-h-9"
            >
              <Checkbox
                id={id}
                checked={value.includes(g.catninograd_id)}
                onCheckedChange={(v) => alternar(g.catninograd_id, v === true)}
              />
              <span title={g.catninograd_nombre}>{cursoCorto(g.catninograd_nombre)}</span>
            </Label>
          );
        })}
      </div>
    </fieldset>
  );
};

export default CursosSelector;
