/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Target, Loader2 } from 'lucide-react';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Timeframe = 'monthly' | 'quarterly' | 'half_yearly' | 'yearly';
type Status = 'not_started' | 'started' | 'in_progress' | 'finished';

const STATUSES: { key: Status; label: string; grad: string }[] = [
  { key: 'not_started', label: 'Not Started', grad: 'from-slate-500 to-slate-700' },
  { key: 'started', label: 'Started', grad: 'from-blue-500 to-blue-700' },
  { key: 'in_progress', label: 'In Progress', grad: 'from-amber-500 to-orange-600' },
  { key: 'finished', label: 'Finished', grad: 'from-emerald-500 to-emerald-700' },
];

type Context =
  | { kind: 'self' }
  | { kind: 'employee'; employeeId: number };

interface Props {
  context: Context;
  goalId?: number;
}

const TIMEFRAMES: { key: Timeframe; label: string; grad: string }[] = [
  { key: 'monthly', label: 'Monthly', grad: 'from-indigo-500 to-indigo-700' },
  { key: 'quarterly', label: 'Quarterly', grad: 'from-teal-500 to-teal-700' },
  { key: 'half_yearly', label: 'Half-Yearly', grad: 'from-amber-500 to-orange-600' },
  { key: 'yearly', label: 'Yearly', grad: 'from-pink-500 to-rose-600' },
];

export function GoalEditor({ context, goalId }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?._type === 'admin';
  const isEditing = typeof goalId === 'number';

  const endpoint = useMemo(() => {
    if (context.kind === 'self') {
      if (isAdmin) return '/employees/me/goals';
      const selfId = (user as any)?.id;
      return `/employee/employees/${selfId}/goals`;
    }
    if (isAdmin) return `/employees/${context.employeeId}/goals`;
    return `/employee/employees/${context.employeeId}/goals`;
  }, [context, isAdmin, user]);

  const backHref = context.kind === 'self'
    ? '/profile?tab=goals'
    : `/employees/${context.employeeId}?tab=goals`;

  const queryKeyId = context.kind === 'self' ? 'me' : String(context.employeeId);

  const [form, setForm] = useState({
    title: '',
    description: '',
    timeframe: 'monthly' as Timeframe,
    progressPercent: 0,
    targetDate: '',
    status: 'not_started' as Status,
  });
  const [saving, setSaving] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ['employee-goal', queryKeyId, goalId],
    queryFn: async () => {
      const res = await api.get(endpoint);
      const body = res.data as any;
      const inner = body?.data ?? body;
      const list: any[] = Array.isArray(inner) ? inner : (Array.isArray(inner?.data) ? inner.data : []);
      return list.find((g) => g.id === goalId) ?? null;
    },
    enabled: isEditing,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        title: existing.title ?? '',
        description: existing.description ?? '',
        timeframe: (existing.timeframe ?? 'monthly') as Timeframe,
        progressPercent: Number(existing.progressPercent ?? 0),
        targetDate: existing.targetDate ? String(existing.targetDate).slice(0, 10) : '',
        status: (existing.status ?? 'not_started') as Status,
      });
    }
  }, [existing]);

  async function save() {
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        timeframe: form.timeframe,
        progressPercent: form.progressPercent,
        targetDate: form.targetDate || undefined,
        ...(isEditing ? { status: form.status } : {}),
      };
      if (isEditing) {
        await api.patch(`${endpoint}/${goalId}`, payload);
        toast.success('Goal updated');
      } else {
        await api.post(endpoint, payload);
        toast.success('Goal created');
      }
      qc.invalidateQueries({ queryKey: ['employee-goals'] });
      router.push(backHref);
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to save goal');
    } finally {
      setSaving(false);
    }
  }

  if (isEditing && isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(backHref)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-sm">
            <Target className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold">
            {isEditing ? 'Edit Goal' : 'New Goal'}
          </h1>
        </div>
      </div>

      <Card className="shadow-sm gap-2">
        <CardContent className="space-y-5 p-5 sm:p-6">
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Title <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. Complete React certification"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Description
            </label>
            <Textarea
              placeholder="Describe the goal, milestones, or details"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={5}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Timeframe
            </label>
            <Select
              value={form.timeframe}
              onValueChange={(v) => setForm({ ...form, timeframe: v as Timeframe })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select timeframe" />
              </SelectTrigger>
              <SelectContent>
                {TIMEFRAMES.map((opt) => (
                  <SelectItem key={opt.key} value={opt.key}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEditing && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Status
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {STATUSES.map((opt) => {
                  const selected = form.status === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setForm({ ...form, status: opt.key })}
                      className={`relative rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                        selected
                          ? `border-transparent bg-gradient-to-br ${opt.grad} text-white shadow-md`
                          : 'border-border bg-background hover:border-muted-foreground/40'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {isEditing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Progress
                </label>
                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {form.progressPercent}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={form.progressPercent}
                onChange={(e) => setForm({ ...form, progressPercent: Number(e.target.value) })}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] font-semibold text-muted-foreground mt-0.5">
                <span>0%</span>
                <span>100%</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Target Date <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              type="date"
              value={form.targetDate}
              onChange={(e) => setForm({ ...form, targetDate: e.target.value })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => router.push(backHref)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-emerald-700 hover:from-emerald-600 hover:to-emerald-800 text-white"
            >
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Create Goal'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
