import { useEffect, useState, type ReactNode } from 'react';
import { EditorContent, Node, mergeAttributes, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Columns3,
  Eye,
  Heading2,
  Heading3,
  Highlighter,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  MousePointerClick,
  Quote,
  Redo2,
  Rows3,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

/**
 * El cuerpo del comunicado: un editor tipo Word (negritas, colores, títulos,
 * listas, tablas, enlaces, botones, imágenes por enlace) y, con "HTML", el
 * código a mano para pegar o ajustar lo que el editor no hace.
 *
 * El área de escritura va siempre en claro, como el correo que se recibe.
 */

const COLOR_BOTON = '#dc2626';

/** Botón de correo: un enlace con aspecto de botón, centrado. */
const Boton = Node.create({
  name: 'boton',
  group: 'block',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      href: { default: '#' },
      texto: { default: 'Ver más' },
      color: { default: COLOR_BOTON },
    };
  },
  parseHTML() {
    return [
      {
        tag: 'p[data-boton]',
        priority: 1000,
        getAttrs: (el) => {
          const a = (el as HTMLElement).querySelector('a');
          return {
            href: a?.getAttribute('href') ?? '#',
            texto: a?.textContent ?? 'Ver más',
            color: (el as HTMLElement).getAttribute('data-color') ?? COLOR_BOTON,
          };
        },
      },
    ];
  },
  renderHTML({ node }) {
    const { href, texto, color } = node.attrs as { href: string; texto: string; color: string };
    return [
      'p',
      mergeAttributes({ 'data-boton': '', 'data-color': color, style: 'margin:20px 0;text-align:center' }),
      [
        'a',
        {
          href,
          target: '_blank',
          style: `display:inline-block;padding:12px 28px;background:${color};color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-family:Arial,Helvetica,sans-serif`,
        },
        texto,
      ],
    ];
  },
});

const extensiones = [
  StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
  Underline,
  Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { target: '_blank', rel: 'noopener' } }),
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  TextStyle,
  Color,
  Highlight.configure({ multicolor: true }),
  Image.configure({ inline: false, allowBase64: false }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Boton,
];

// ---------------------------------------------------------------------------

interface Campo {
  clave: string;
  etiqueta: string;
  tipo?: 'text' | 'url' | 'color';
  valor: string;
}

/** Diálogo corto para enlace, botón o imagen. */
const DialogoCampos = ({
  titulo,
  descripcion,
  campos,
  onAceptar,
  onCerrar,
}: {
  titulo: string;
  descripcion?: string;
  campos: Campo[];
  onAceptar: (v: Record<string, string>) => void;
  onCerrar: () => void;
}) => {
  const [valores, setValores] = useState<Record<string, string>>(
    Object.fromEntries(campos.map((c) => [c.clave, c.valor])),
  );
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            onAceptar(valores);
          }}
        >
          {campos.map((c) => (
            <div key={c.clave} className="space-y-1.5">
              <Label htmlFor={`campo-${c.clave}`}>{c.etiqueta}</Label>
              <Input
                id={`campo-${c.clave}`}
                type={c.tipo ?? 'text'}
                value={valores[c.clave] ?? ''}
                onChange={(e) => setValores((v) => ({ ...v, [c.clave]: e.target.value }))}
                className={c.tipo === 'color' ? 'h-11 w-20 p-1' : 'h-11 sm:h-10'}
                autoFocus={c === campos[0]}
              />
            </div>
          ))}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button type="submit">Aceptar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const conProtocolo = (url: string) => {
  const u = url.trim();
  if (!u) return '';
  if (/^(https?:|mailto:|tel:)/i.test(u)) return u;
  if (u.includes('@') && !u.includes('/')) return `mailto:${u}`;
  return `https://${u}`;
};

// ---------------------------------------------------------------------------

const BotonBarra = ({
  titulo,
  activo,
  onClick,
  disabled,
  children,
}: {
  titulo: string;
  activo?: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) => (
  <button
    type="button"
    title={titulo}
    aria-label={titulo}
    aria-pressed={activo}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={cn(
      'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-2 text-sm text-foreground hover:bg-muted disabled:opacity-40',
      activo && 'bg-muted text-primary',
    )}
  >
    {children}
  </button>
);

const Separador = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />;

type Dialogo = 'enlace' | 'boton' | 'imagen' | null;

const Barra = ({ editor, onHtml }: { editor: Editor; onHtml: () => void }) => {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const enTabla = editor.isActive('table');
  const c = () => editor.chain().focus();

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 border-b bg-card p-1">
      <BotonBarra titulo="Deshacer" onClick={() => c().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Rehacer" onClick={() => c().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-4 w-4" />
      </BotonBarra>
      <Separador />
      <BotonBarra titulo="Título" activo={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Subtítulo" activo={editor.isActive('heading', { level: 3 })} onClick={() => c().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Negrita" activo={editor.isActive('bold')} onClick={() => c().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Cursiva" activo={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Subrayado" activo={editor.isActive('underline')} onClick={() => c().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Tachado" activo={editor.isActive('strike')} onClick={() => c().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </BotonBarra>
      <label
        title="Color del texto"
        className="relative inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
      >
        <span className="text-sm font-bold underline decoration-[3px]" style={{ textDecorationColor: (editor.getAttributes('textStyle').color as string) ?? '#000' }}>
          A
        </span>
        <input
          type="color"
          aria-label="Color del texto"
          className="absolute inset-0 cursor-pointer opacity-0"
          value={(editor.getAttributes('textStyle').color as string) ?? '#000000'}
          onChange={(e) => c().setColor(e.target.value).run()}
        />
      </label>
      <label
        title="Resaltar"
        className="relative inline-flex h-9 min-w-9 cursor-pointer items-center justify-center rounded-md hover:bg-muted"
      >
        <Highlighter className="h-4 w-4" />
        <input
          type="color"
          aria-label="Color de resaltado"
          className="absolute inset-0 cursor-pointer opacity-0"
          defaultValue="#fef08a"
          onChange={(e) => c().setHighlight({ color: e.target.value }).run()}
        />
      </label>
      <Separador />
      <BotonBarra titulo="Lista" activo={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Lista numerada" activo={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Cita" activo={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Alinear a la izquierda" activo={editor.isActive({ textAlign: 'left' })} onClick={() => c().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Centrar" activo={editor.isActive({ textAlign: 'center' })} onClick={() => c().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Alinear a la derecha" activo={editor.isActive({ textAlign: 'right' })} onClick={() => c().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </BotonBarra>
      <Separador />
      <BotonBarra titulo="Enlace" activo={editor.isActive('link')} onClick={() => setDialogo('enlace')}>
        <Link2 className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Botón" onClick={() => setDialogo('boton')}>
        <MousePointerClick className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra titulo="Imagen (por enlace)" onClick={() => setDialogo('imagen')}>
        <ImageIcon className="h-4 w-4" />
      </BotonBarra>
      <BotonBarra
        titulo="Insertar tabla"
        onClick={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon className="h-4 w-4" />
      </BotonBarra>
      {enTabla && (
        <>
          <BotonBarra titulo="Añadir fila" onClick={() => c().addRowAfter().run()}>
            <Rows3 className="h-4 w-4" />
            <span className="ml-0.5 text-xs">+</span>
          </BotonBarra>
          <BotonBarra titulo="Añadir columna" onClick={() => c().addColumnAfter().run()}>
            <Columns3 className="h-4 w-4" />
            <span className="ml-0.5 text-xs">+</span>
          </BotonBarra>
          <BotonBarra titulo="Quitar fila" onClick={() => c().deleteRow().run()}>
            <Rows3 className="h-4 w-4" />
            <span className="ml-0.5 text-xs">−</span>
          </BotonBarra>
          <BotonBarra titulo="Quitar columna" onClick={() => c().deleteColumn().run()}>
            <Columns3 className="h-4 w-4" />
            <span className="ml-0.5 text-xs">−</span>
          </BotonBarra>
          <BotonBarra titulo="Borrar tabla" onClick={() => c().deleteTable().run()}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </BotonBarra>
        </>
      )}
      <span className="ml-auto" />
      <BotonBarra titulo="Editar el HTML" onClick={onHtml}>
        <Code2 className="h-4 w-4" />
        <span className="ml-1 text-xs font-medium">HTML</span>
      </BotonBarra>

      {dialogo === 'enlace' && (
        <DialogoCampos
          titulo="Enlace"
          descripcion="Selecciona antes el texto que quieres convertir en enlace. Vacío quita el enlace."
          campos={[{ clave: 'url', etiqueta: 'Dirección', tipo: 'url', valor: (editor.getAttributes('link').href as string) ?? '' }]}
          onCerrar={() => setDialogo(null)}
          onAceptar={({ url }) => {
            const href = conProtocolo(url ?? '');
            if (!href) c().extendMarkRange('link').unsetLink().run();
            else if (editor.state.selection.empty && !editor.isActive('link')) {
              c().insertContent(`<a href="${href.replace(/"/g, '&quot;')}">${href}</a>`).run();
            } else c().extendMarkRange('link').setLink({ href }).run();
            setDialogo(null);
          }}
        />
      )}
      {dialogo === 'boton' && (
        <DialogoCampos
          titulo="Botón"
          descripcion="Un botón centrado que abre un enlace."
          campos={[
            { clave: 'texto', etiqueta: 'Texto del botón', valor: 'Ver más' },
            { clave: 'url', etiqueta: 'Abre esta dirección', tipo: 'url', valor: '' },
            { clave: 'color', etiqueta: 'Color', tipo: 'color', valor: COLOR_BOTON },
          ]}
          onCerrar={() => setDialogo(null)}
          onAceptar={({ texto, url, color }) => {
            const href = conProtocolo(url ?? '');
            if (!href || !texto?.trim()) return;
            c().insertContent({ type: 'boton', attrs: { href, texto: texto.trim(), color: color || COLOR_BOTON } }).run();
            setDialogo(null);
          }}
        />
      )}
      {dialogo === 'imagen' && (
        <DialogoCampos
          titulo="Imagen"
          descripcion="Pega el enlace de una imagen ya publicada en internet (los correos no llevan imágenes pegadas)."
          campos={[{ clave: 'url', etiqueta: 'Enlace de la imagen', tipo: 'url', valor: '' }]}
          onCerrar={() => setDialogo(null)}
          onAceptar={({ url }) => {
            const src = conProtocolo(url ?? '');
            if (!src) return;
            c().setImage({ src }).run();
            setDialogo(null);
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------

interface Props {
  valor: string;
  modo: 'visual' | 'html';
  onChange: (html: string) => void;
  onModo: (modo: 'visual' | 'html') => void;
}

const EditorCorreo = ({ valor, modo, onChange, onModo }: Props) => {
  const [confirmarVisual, setConfirmarVisual] = useState(false);

  const editor = useEditor({
    extensions: extensiones,
    content: modo === 'visual' ? valor : '',
    editorProps: {
      attributes: {
        class: 'editor-correo min-h-[320px] px-4 py-3 focus:outline-none',
        'aria-label': 'Cuerpo del correo',
      },
      // Imágenes pegadas como archivo: no caben en un correo. Fuera.
      handlePaste: (_view, event) => Boolean(event.clipboardData?.files.length),
      handleDrop: (_view, event) => Boolean((event as DragEvent).dataTransfer?.files.length),
    },
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
  });

  // Al abrir otro borrador, el contenido cambia desde fuera.
  useEffect(() => {
    if (editor && modo === 'visual' && valor !== editor.getHTML()) {
      editor.commands.setContent(valor, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo cuando cambia desde fuera
  }, [editor, modo]);

  if (modo === 'html') {
    return (
      <div className="overflow-hidden rounded-md border">
        <div className="flex flex-wrap items-center gap-2 border-b bg-card p-1 pl-3">
          <span className="text-xs text-muted-foreground">HTML del cuerpo (va dentro de la plantilla)</span>
          <span className="ml-auto" />
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={() => setConfirmarVisual(true)}>
            <Eye className="mr-1.5 h-4 w-4" />
            Editor visual
          </Button>
        </div>
        <Textarea
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          className="min-h-[360px] rounded-none border-0 font-mono text-xs focus-visible:ring-0"
          aria-label="HTML del cuerpo"
        />
        <AlertDialog open={confirmarVisual} onOpenChange={setConfirmarVisual}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Volver al editor visual?</AlertDialogTitle>
              <AlertDialogDescription>
                El editor visual solo conoce lo suyo (textos, títulos, listas, tablas, enlaces, botones e imágenes). Si
                escribiste HTML con otros estilos o bloques, al volver se puede perder. Si no estás seguro, sigue en HTML:
                la vista previa enseña cómo queda.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Seguir en HTML</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  editor?.commands.setContent(valor, false);
                  onChange(editor?.getHTML() ?? valor);
                  onModo('visual');
                }}
              >
                Volver al visual
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      {editor && <Barra editor={editor} onHtml={() => onModo('html')} />}
      <div className="max-h-[60vh] overflow-y-auto bg-white text-slate-900">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default EditorCorreo;
