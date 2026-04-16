import { Card, CardContent } from '@/components/ui/card';

/**
 * Map a Tailwind gradient class string to:
 *   - tinted icon-bubble background (`bubbleBg`)
 *   - bold icon foreground color (`iconFg`)
 *   - trend foreground color (`trendFg`)
 * Returns sensible defaults for unknown gradients.
 */
function gradientToAccent(gradient: string): { bubbleBg: string; iconFg: string; trendFg: string } {
  const g = gradient.toLowerCase();
  if (g.includes('slate')) return { bubbleBg: 'bg-slate-100 dark:bg-slate-800/60', iconFg: 'text-slate-600 dark:text-slate-300', trendFg: 'text-slate-600 dark:text-slate-300' };
  if (g.includes('blue') || g.includes('indigo')) return { bubbleBg: 'bg-blue-50 dark:bg-blue-950/40', iconFg: 'text-blue-600 dark:text-blue-400', trendFg: 'text-blue-600 dark:text-blue-400' };
  if (g.includes('emerald') || g.includes('teal') || g.includes('green')) return { bubbleBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconFg: 'text-emerald-600 dark:text-emerald-400', trendFg: 'text-emerald-600 dark:text-emerald-400' };
  if (g.includes('amber') || g.includes('orange') || g.includes('yellow')) return { bubbleBg: 'bg-amber-50 dark:bg-amber-950/40', iconFg: 'text-amber-600 dark:text-amber-400', trendFg: 'text-amber-600 dark:text-amber-400' };
  if (g.includes('violet') || g.includes('purple') || g.includes('fuchsia')) return { bubbleBg: 'bg-violet-50 dark:bg-violet-950/40', iconFg: 'text-violet-600 dark:text-violet-400', trendFg: 'text-violet-600 dark:text-violet-400' };
  if (g.includes('rose') || g.includes('pink') || g.includes('red')) return { bubbleBg: 'bg-rose-50 dark:bg-rose-950/40', iconFg: 'text-rose-600 dark:text-rose-400', trendFg: 'text-rose-600 dark:text-rose-400' };
  if (g.includes('cyan') || g.includes('sky')) return { bubbleBg: 'bg-cyan-50 dark:bg-cyan-950/40', iconFg: 'text-cyan-600 dark:text-cyan-400', trendFg: 'text-cyan-600 dark:text-cyan-400' };
  return { bubbleBg: 'bg-slate-100 dark:bg-slate-800/60', iconFg: 'text-slate-600 dark:text-slate-300', trendFg: 'text-slate-600 dark:text-slate-300' };
}

export interface KpiCardProps {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  /** Tailwind gradient class — used to derive the icon bubble accent color. */
  gradient: string;
  trendValue?: string | number;
  trendLabel?: string;
  trendPositive?: boolean;
  /** Legacy prop — accepted for backward compat, not used. */
  textColor?: string;
}

export function KpiCard({
  title, value, sub, icon: Icon, gradient, trendValue, trendLabel, trendPositive,
}: KpiCardProps) {
  const { bubbleBg, iconFg, trendFg } = gradientToAccent(gradient);
  const hasTrend = trendValue !== undefined && trendValue !== null && `${trendValue}`.length > 0;
  const isNeg = trendPositive === false;
  return (
    <Card className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 dark:border-slate-800/60 dark:bg-slate-900">
      <CardContent className="px-5 py-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${bubbleBg}`}>
            <Icon className={`h-6 w-6 ${iconFg}`} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
              {title}
            </p>
            <p className="mt-0.5 truncate text-2xl font-bold text-slate-900 dark:text-slate-50">
              {value}
            </p>
            {hasTrend ? (
              <p className="mt-0.5 flex items-center gap-1 text-xs">
                <span className={isNeg ? 'text-rose-500' : trendFg}>
                  {isNeg ? '↓' : '↑'} {trendValue}
                </span>
                {trendLabel && (
                  <span className="text-slate-500 dark:text-slate-400">{trendLabel}</span>
                )}
              </p>
            ) : sub ? (
              <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">{sub}</p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
