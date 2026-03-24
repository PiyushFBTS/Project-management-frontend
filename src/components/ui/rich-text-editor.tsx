'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextStyle, Color, FontFamily } from '@tiptap/extension-text-style';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Mention } from '@tiptap/extension-mention';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Heading1, Heading2, Heading3,
  Undo, Redo, Palette, Highlighter, Search,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface MentionUser {
  id: number;
  empName: string;
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  /** Provide employees list to enable @-mention in the editor */
  employees?: MentionUser[];
  onMentionAdded?: (emp: MentionUser) => void;
}

const FONT_FAMILIES = [
  { label: 'Default', value: '' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
  { label: 'Palatino', value: '"Palatino Linotype", serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Impact', value: 'Impact, sans-serif' },
  { label: 'Comic Sans', value: '"Comic Sans MS", cursive' },
  { label: 'Lucida Console', value: '"Lucida Console", monospace' },
  { label: 'Segoe UI', value: '"Segoe UI", sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' },
  { label: 'Open Sans', value: '"Open Sans", sans-serif' },
  { label: 'Lato', value: 'Lato, sans-serif' },
  { label: 'Montserrat', value: 'Montserrat, sans-serif' },
  { label: 'Poppins', value: 'Poppins, sans-serif' },
];

const COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#cccccc',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6',
  '#8b5cf6', '#ec4899', '#14b8a6', '#6366f1', '#a855f7',
];

const BG_COLORS = [
  'transparent', '#fef3c7', '#dcfce7', '#dbeafe', '#fce7f3',
  '#f3e8ff', '#ccfbf1', '#fee2e2', '#e0e7ff', '#fef9c3',
];

function ToolbarButton({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      {children}
    </button>
  );
}

function FontFamilySelect({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const current = FONT_FAMILIES.find((f) => f.value === value)?.label || 'Default';
  const filtered = FONT_FAMILIES.filter((f) =>
    f.label.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="h-7 text-xs rounded border bg-background px-2 mr-1 flex items-center gap-1 min-w-[110px] hover:bg-muted transition-colors"
        title="Font Family"
      >
        <span className="truncate">{current}</span>
        <svg className="h-3 w-3 shrink-0 opacity-50" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b">
            <Search className="h-3 w-3 text-muted-foreground shrink-0" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search font..."
              className="flex-1 text-xs bg-transparent outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">No match</p>
            )}
            {filtered.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => {
                  onSelect(f.value);
                  setOpen(false);
                }}
                className={`w-full text-left text-xs px-2 py-1.5 hover:bg-muted transition-colors ${
                  f.value === value ? 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' : ''
                }`}
                style={{ fontFamily: f.value || 'inherit' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Build tiptap extensions outside component to avoid ref-during-render issues ── */
type MentionStoreData = { employees: MentionUser[]; onMentionAdded?: (emp: MentionUser) => void };
type MentionStore = { current: MentionStoreData };

// Module-scoped mutable stores keyed by unique ID — completely outside React's ref/state system
const mentionStores = new Map<number, MentionStoreData>();
let _nextId = 0;
function allocStore(data: MentionStoreData): number {
  const id = ++_nextId;
  mentionStores.set(id, data);
  return id;
}
function getStore(id: number): MentionStore {
  return { get current() { return mentionStores.get(id)!; } };
}


// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildExtensions(withMention: boolean, store: MentionStore): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base: any[] = [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      bulletList: { keepMarks: true, keepAttributes: false },
      orderedList: { keepMarks: true, keepAttributes: false },
    }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    FontFamily,
  ];

  if (withMention) {
    base.push(
      Mention.configure({
        HTMLAttributes: { class: 'mention' },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        renderLabel: ({ node }: any) => `@${node.attrs.label}`,
        suggestion: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: ({ query }: any) => {
            const list = store.current.employees;
            const deduped = list.filter((e, i, a) => a.findIndex((x) => x.id === e.id) === i);
            return deduped.filter((e) => e.empName.toLowerCase().includes(query.toLowerCase())).slice(0, 8);
          },
          render: () => {
            let container: HTMLDivElement | null = null;
            let selectedIndex = 0;
            let items: MentionUser[] = [];
            let commandFn: ((item: { id: string; label: string }) => void) | null = null;

            function updateList() {
              if (!container) return;
              container.innerHTML = '';
              if (items.length === 0) {
                container.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#999">No matches</div>';
                return;
              }
              items.forEach((item, idx) => {
                const btn = document.createElement('button');
                btn.className = `mention-item${idx === selectedIndex ? ' is-selected' : ''}`;
                btn.textContent = item.empName;
                btn.addEventListener('mousedown', (e) => {
                  e.preventDefault();
                  commandFn?.({ id: String(item.id), label: item.empName });
                  store.current.onMentionAdded?.({ id: item.id, empName: item.empName });
                });
                container!.appendChild(btn);
              });
            }

            return {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onStart: (props: any) => {
                container = document.createElement('div');
                container.className = 'mention-suggestions';
                items = props.items;
                commandFn = props.command;
                selectedIndex = 0;
                updateList();
                const rect = props.clientRect?.();
                if (rect && container) {
                  container.style.position = 'fixed';
                  container.style.left = `${rect.left}px`;
                  container.style.top = `${rect.bottom + 4}px`;
                  document.body.appendChild(container);
                }
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onUpdate: (props: any) => {
                items = props.items;
                commandFn = props.command;
                selectedIndex = 0;
                updateList();
                const rect = props.clientRect?.();
                if (rect && container) {
                  container.style.left = `${rect.left}px`;
                  container.style.top = `${rect.bottom + 4}px`;
                }
              },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onKeyDown: (props: any) => {
                if (props.event.key === 'ArrowDown') {
                  selectedIndex = (selectedIndex + 1) % items.length;
                  updateList();
                  return true;
                }
                if (props.event.key === 'ArrowUp') {
                  selectedIndex = (selectedIndex - 1 + items.length) % items.length;
                  updateList();
                  return true;
                }
                if (props.event.key === 'Enter') {
                  if (items[selectedIndex]) {
                    commandFn?.({ id: String(items[selectedIndex].id), label: items[selectedIndex].empName });
                    store.current.onMentionAdded?.(items[selectedIndex]);
                  }
                  return true;
                }
                if (props.event.key === 'Escape') {
                  container?.remove();
                  container = null;
                  return true;
                }
                return false;
              },
              onExit: () => {
                container?.remove();
                container = null;
              },
            };
          },
        },
      }),
    );
  }

  return base;
}

/* ── Custom styles to make headings, lists visible without @tailwindcss/typography ── */
const EDITOR_STYLES = `
.rich-editor .ProseMirror {
  outline: none;
  padding: 0.5rem 0.75rem;
}
.rich-editor .ProseMirror h1 { font-size: 1.75em; font-weight: 700; margin: 0.5em 0 0.25em; line-height: 1.2; }
.rich-editor .ProseMirror h2 { font-size: 1.4em; font-weight: 600; margin: 0.4em 0 0.2em; line-height: 1.3; }
.rich-editor .ProseMirror h3 { font-size: 1.15em; font-weight: 600; margin: 0.3em 0 0.15em; line-height: 1.4; }
.rich-editor .ProseMirror p { margin: 0.25em 0; }
.rich-editor .ProseMirror ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
.rich-editor .ProseMirror ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
.rich-editor .ProseMirror li { margin: 0.1em 0; }
.rich-editor .ProseMirror li p { margin: 0; }
.rich-editor .ProseMirror blockquote { border-left: 3px solid #8b5cf6; padding-left: 0.75em; margin: 0.5em 0; color: #666; }
.rich-editor .ProseMirror mark { border-radius: 2px; padding: 0 2px; }
.rich-editor .ProseMirror .mention {
  background-color: rgba(139,92,246,0.15);
  border-radius: 9999px;
  padding: 0 6px;
  font-size: 0.75rem;
  font-weight: 500;
  color: #7c3aed;
  white-space: nowrap;
}
.rich-editor .mention-suggestions {
  background: var(--popover, #fff);
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 0.5rem;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  padding: 0.25rem 0;
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
}
.rich-editor .mention-suggestions .mention-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.375rem 0.75rem;
  font-size: 0.8125rem;
  cursor: pointer;
  border: none;
  background: transparent;
}
.rich-editor .mention-suggestions .mention-item:hover,
.rich-editor .mention-suggestions .mention-item.is-selected {
  background: rgba(139,92,246,0.1);
  color: #7c3aed;
}
`;

export function RichTextEditor({
  value,
  onChange,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  placeholder = 'Start typing...',
  className = '',
  minHeight = '200px',
  employees,
  onMentionAdded,
}: RichTextEditorProps) {
  const isInternalUpdate = useRef(false);

  // Allocate a module-scoped mutable store (outside React's tracking)
  const [storeId] = useState(() => allocStore({ employees: employees ?? [], onMentionAdded }));
  const store = getStore(storeId);

  // Keep store in sync with latest props
  useEffect(() => {
    const s = mentionStores.get(storeId);
    if (s) {
      s.employees = employees ?? [];
      s.onMentionAdded = onMentionAdded;
    }
  });

  // Cleanup on unmount
  useEffect(() => () => { mentionStores.delete(storeId); }, [storeId]);

  const hasMentions = !!employees;
  const [extensions] = useState(() => buildExtensions(hasMentions, store));

  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    content: value || '',
    editorProps: {
      attributes: {
        style: `min-height: ${minHeight}`,
      },
    },
    onUpdate: ({ editor: e }) => {
      isInternalUpdate.current = true;
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && !isInternalUpdate.current && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
    isInternalUpdate.current = false;
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className={`border rounded-lg overflow-hidden bg-background rich-editor ${className}`}>
      <style dangerouslySetInnerHTML={{ __html: EDITOR_STYLES }} />
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30">
        {/* Font Family (searchable) */}
        <FontFamilySelect
          value={editor.getAttributes('textStyle').fontFamily || ''}
          onSelect={(v) => {
            if (v) {
              editor.chain().focus().setFontFamily(v).run();
            } else {
              editor.chain().focus().unsetFontFamily().run();
            }
          }}
        />

        <div className="w-px h-5 bg-border mx-1" />

        {/* Headings */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="Underline (Ctrl+U)"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <Strikethrough className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Text Color */}
        <div className="relative group">
          <ToolbarButton onClick={() => {}} title="Text Color">
            <Palette className="h-4 w-4" />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:grid grid-cols-5 gap-1 p-2 bg-popover border rounded-lg shadow-lg z-50">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Highlight Color */}
        <div className="relative group">
          <ToolbarButton onClick={() => {}} title="Highlight">
            <Highlighter className="h-4 w-4" />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:grid grid-cols-5 gap-1 p-2 bg-popover border rounded-lg shadow-lg z-50">
            {BG_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => {
                  if (color === 'transparent') {
                    editor.chain().focus().unsetHighlight().run();
                  } else {
                    editor.chain().focus().toggleHighlight({ color }).run();
                  }
                }}
                className="w-5 h-5 rounded border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color === 'transparent' ? '#fff' : color }}
                title={color === 'transparent' ? 'None' : color}
              />
            ))}
          </div>
        </div>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          active={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          active={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          active={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('justify').run()}
          active={editor.isActive({ textAlign: 'justify' })}
          title="Justify"
        >
          <AlignJustify className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarButton>

        <div className="w-px h-5 bg-border mx-1" />

        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)">
          <Undo className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)">
          <Redo className="h-4 w-4" />
        </ToolbarButton>
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />
    </div>
  );
}

/* ── Read-only display styles ── */
const DISPLAY_STYLES = `
.rich-display h1 { font-size: 1.75em; font-weight: 700; margin: 0.5em 0 0.25em; line-height: 1.2; }
.rich-display h2 { font-size: 1.4em; font-weight: 600; margin: 0.4em 0 0.2em; line-height: 1.3; }
.rich-display h3 { font-size: 1.15em; font-weight: 600; margin: 0.3em 0 0.15em; line-height: 1.4; }
.rich-display p { margin: 0.25em 0; }
.rich-display ul { list-style-type: disc; padding-left: 1.5em; margin: 0.25em 0; }
.rich-display ol { list-style-type: decimal; padding-left: 1.5em; margin: 0.25em 0; }
.rich-display li { margin: 0.1em 0; }
.rich-display blockquote { border-left: 3px solid #8b5cf6; padding-left: 0.75em; margin: 0.5em 0; color: #666; }
.rich-display mark { border-radius: 2px; padding: 0 2px; }
`;

/** Read-only renderer for saved HTML content */
export function RichTextDisplay({ html, className = '' }: { html: string; className?: string }) {
  if (!html) return <p className="text-muted-foreground text-sm italic">No description</p>;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DISPLAY_STYLES }} />
      <div
        className={`rich-display text-sm leading-relaxed ${className}`}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
