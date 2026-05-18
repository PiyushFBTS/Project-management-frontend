'use client';

import { useState } from 'react';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { aiApi, AiTextFeature } from '@/lib/api/ai';

interface AiImproveButtonProps {
  /** Current value of the editor — accepts HTML (from RichTextEditor) or plain text. */
  value: string;
  /** Called with the AI-rewritten text once the user clicks Accept. Returns HTML or plain text depending on `valueIsHtml`. */
  onAccept: (rewritten: string) => void;
  /** When true, strips HTML before sending and re-wraps the output in <p>...</p>. */
  valueIsHtml?: boolean;
  /** Optional minimum characters to enable the button. */
  minChars?: number;
  size?: 'sm' | 'default' | 'lg' | 'icon';
  variant?: 'default' | 'ghost' | 'outline' | 'secondary';
  className?: string;
  disabled?: boolean;
}

interface Suggestion {
  feature: AiTextFeature;
  title: string;
  blurb: string;
  output: string | null;
  loading: boolean;
  error: string | null;
  cached: boolean;
}

function stripHtml(html: string): string {
  if (typeof window === 'undefined') return html;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || '').trim();
}

const INITIAL_SUGGESTIONS: Suggestion[] = [
  {
    feature: 'improve_writing',
    title: 'Grammar & spelling',
    blurb: 'Fix mistakes only — keep your wording and voice.',
    output: null,
    loading: true,
    error: null,
    cached: false,
  },
  {
    feature: 'tone_professional',
    title: 'Professional rewrite',
    blurb: 'Polished workplace tone with cleaner phrasing.',
    output: null,
    loading: true,
    error: null,
    cached: false,
  },
];

export function AiImproveButton({
  value,
  onAccept,
  valueIsHtml = false,
  minChars = 4,
  size = 'sm',
  variant = 'outline',
  className,
  disabled,
}: AiImproveButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [original, setOriginal] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>(INITIAL_SUGGESTIONS);

  const plain = valueIsHtml ? stripHtml(value) : value.trim();
  const isDisabled = disabled || busy || plain.length < minChars;

  async function handleClick() {
    setBusy(true);
    setOriginal(plain);
    setSuggestions(INITIAL_SUGGESTIONS.map((s) => ({ ...s, output: null, loading: true, error: null })));
    setOpen(true);

    // Fire both calls in parallel. Cached calls return ~instantly, so a
    // repeat on the same input feels free.
    await Promise.all(
      INITIAL_SUGGESTIONS.map(async (s) => {
        try {
          const res = await aiApi.text({ feature: s.feature, input: plain });
          setSuggestions((prev) =>
            prev.map((p) =>
              p.feature === s.feature
                ? { ...p, output: res.data.data.output, cached: res.data.data.cached, loading: false }
                : p,
            ),
          );
        } catch (err) {
          const e = err as { response?: { data?: { message?: string }; status?: number } };
          const status = e.response?.status;
          const msg =
            e.response?.data?.message ??
            (status === 429 ? 'Daily AI limit reached.' : 'AI service error.');
          setSuggestions((prev) =>
            prev.map((p) =>
              p.feature === s.feature
                ? { ...p, error: typeof msg === 'string' ? msg : 'AI error', loading: false }
                : p,
            ),
          );
        }
      }),
    );

    setBusy(false);
  }

  function handleAccept(s: Suggestion) {
    if (!s.output) return;
    const out = valueIsHtml ? `<p>${escapeHtml(s.output)}</p>` : s.output;
    onAccept(out);
    setOpen(false);
    toast.success('Suggestion applied');
  }

  return (
    <>
      <Button
        type="button"
        size={size}
        variant={variant}
        className={className}
        disabled={isDisabled}
        onClick={handleClick}
        title={plain.length < minChars ? 'Type at least a few characters first' : 'Get AI suggestions'}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Sparkles className="h-3.5 w-3.5" />
        )}
        <span className="ml-1.5">Improve writing</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              AI suggestions
            </DialogTitle>
            <DialogDescription>
              Two options below. Pick whichever fits — your original is kept until you click <strong>Use this</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <section>
              <p className="text-xs font-medium text-muted-foreground mb-1">Original</p>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap">
                {original}
              </div>
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              {suggestions.map((s) => (
                <SuggestionCard key={s.feature} suggestion={s} onUse={() => handleAccept(s)} />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SuggestionCard({ suggestion, onUse }: { suggestion: Suggestion; onUse: () => void }) {
  const { title, blurb, output, loading, error, cached } = suggestion;
  return (
    <div className="flex flex-col rounded-md border border-violet-200 bg-violet-50/40">
      <div className="flex items-start justify-between gap-2 px-3 pt-3">
        <div>
          <p className="text-sm font-semibold text-violet-800">{title}</p>
          <p className="text-xs text-muted-foreground">{blurb}</p>
        </div>
        {cached && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">cached</span>
        )}
      </div>
      <div className="px-3 py-2 text-sm whitespace-pre-wrap min-h-20">
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Generating…
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          output
        )}
      </div>
      <div className="px-3 pb-3">
        <Button
          size="sm"
          className="w-full bg-linear-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white"
          disabled={loading || !!error || !output}
          onClick={onUse}
        >
          <Check className="h-3.5 w-3.5 mr-1.5" />
          Use this
        </Button>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
