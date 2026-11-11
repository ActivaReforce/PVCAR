import { cn } from '@/lib/utils';

/**
 * Vista previa de un correo. Va en un iframe aislado (`sandbox` sin
 * scripts): el HTML de una plantilla no puede tocar la página ni leer la
 * sesión. Siempre en claro, como lo ve la mayoría en su correo.
 */

interface Props {
  html: string;
  titulo?: string;
  className?: string;
}

const VistaCorreo = ({ html, titulo = 'Vista previa del correo', className }: Props) => (
  <iframe
    title={titulo}
    sandbox=""
    srcDoc={html}
    className={cn('w-full rounded-md border bg-white', className ?? 'h-[480px]')}
  />
);

export default VistaCorreo;
