/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Tags, Loader2, Check, X, Hash, FileText } from 'lucide-react';
import { projectsApi } from '@/lib/api/projects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function NewProjectTypePage() {
  const router = useRouter();
  const qc = useQueryClient();

  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [description, setDescription] = useState('');
  const [valueTouched, setValueTouched] = useState(false);

  // Auto-generate slug from label until the user edits the value manually.
  const handleLabelChange = (v: string) => {
    setLabel(v);
    if (!valueTouched) {
      setValue(v.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
    }
  };

  const createMut = useMutation({
    mutationFn: () =>
      projectsApi.createProjectType({
        value: (value || label).trim(),
        label: label.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-types'] });
      toast.success(`"${label.trim()}" added`);
      router.push('/project-types');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message ?? 'Failed to create project type'),
  });

  const canSave = label.trim().length > 0 && !createMut.isPending;

  const handleSave = () => {
    if (!label.trim()) {
      toast.error('Label is required');
      return;
    }
    createMut.mutate();
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Tags className="h-5 w-5 text-blue-600" />
            New Project Type
          </h1>
          <p className="text-sm text-muted-foreground">
            Add a reusable type that projects can be tagged with.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            <X className="mr-1 h-3.5 w-3.5" /> Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSave}
            onClick={handleSave}
            className="bg-linear-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90 border-0"
          >
            {createMut.isPending ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1 h-3.5 w-3.5" />
            )}
            Create
          </Button>
        </div>
      </div>

      {/* Top-row cards */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-cyan-600 dark:text-cyan-400 mb-1.5">
            <Tags className="h-3 w-3" /> Label <span className="text-red-500">*</span>
          </div>
          <Input
            value={label}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. Staff Augmentation"
            className="h-9 text-sm"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Human-readable name shown throughout the app.
          </p>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-indigo-600 dark:text-indigo-400 mb-1.5">
            <Hash className="h-3 w-3" /> Value (slug)
          </div>
          <Input
            value={value}
            onChange={(e) => {
              setValueTouched(true);
              setValue(e.target.value);
            }}
            placeholder="staff_augmentation"
            className="h-9 text-sm font-mono"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            Stored identifier. Auto-generated from the label — edit only if needed.
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold text-violet-600 dark:text-violet-400 mb-1.5">
          <FileText className="h-3 w-3" /> Description
        </div>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Briefly describe when this project type should be used…"
          rows={4}
          className="text-sm"
        />
      </div>

      {/* Live preview */}
      <div className="rounded-xl border bg-card p-4">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
          Preview
        </div>
        <div className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <span className="rounded-md bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-400 px-2 py-0.5 text-xs font-semibold">
            {label.trim() || 'Label goes here'}
          </span>
          {value && (
            <span className="text-[10px] text-muted-foreground font-mono">
              {value}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
