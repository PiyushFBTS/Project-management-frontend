/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Loader2, Upload, X, Inbox, FileText, Type, AlignLeft, Users } from 'lucide-react';
import { requestsApi, RequestTeam } from '@/lib/api/requests';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';

export default function NewRequestPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [teamId, setTeamId] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const { data: teamsRaw } = useQuery({
    queryKey: ['request-teams'],
    queryFn: async () => {
      const r = await requestsApi.getTeams();
      return (r.data?.data ?? r.data ?? []) as RequestTeam[];
    },
  });
  const teams: RequestTeam[] = Array.isArray(teamsRaw) ? teamsRaw : [];

  const createMut = useMutation({
    mutationFn: async () => {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('teamId', teamId);
      if (description.trim()) fd.append('description', description.trim());
      if (file) fd.append('file', file);
      return requestsApi.create(fd);
    },
    onSuccess: (r: any) => {
      toast.success('Request raised');
      const id = r.data?.data?.id ?? r.data?.id;
      router.push(id ? `/requests/${id}` : '/requests');
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to raise request'),
  });

  const canSubmit = title.trim().length >= 3 && !!teamId && !createMut.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <button onClick={() => router.push('/requests')} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-1">
            <ArrowLeft className="h-4 w-4" /> Back to Requests
          </button>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-white" />
            </div>
            Raise a Request
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/requests')}>Cancel</Button>
          <Button disabled={!canSubmit} onClick={() => createMut.mutate()}>
            {createMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Inbox className="h-4 w-4 mr-1" />}
            Submit Request
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: title + description */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardContent className="p-6 space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Request Details</h3>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Users className="h-3.5 w-3.5 text-primary" /> Team <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  value={teamId}
                  onValueChange={setTeamId}
                  options={teams.map((t) => ({ value: String(t.id), label: t.name }))}
                  placeholder="Which team should handle this?"
                />
                {teams.length === 0 && (
                  <p className="mt-1 text-[11px] text-amber-600">No teams set up yet — ask an admin or HR to create one.</p>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <Type className="h-3.5 w-3.5 text-primary" /> Title <span className="text-red-500">*</span>
                </label>
                <Input
                  placeholder="Briefly summarise your request"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={255}
                />
                <p className="mt-1 text-[11px] text-muted-foreground">At least 3 characters.</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-2">
                  <AlignLeft className="h-3.5 w-3.5 text-primary" /> Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add any details that will help us action this request..."
                  rows={6}
                  className="w-full rounded-md border px-3 py-2.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-colors"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: attachment */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                <FileText className="h-3.5 w-3.5 inline mr-1 text-primary" /> Document
              </h3>

              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? 'border-primary/50 bg-primary/5' : 'hover:border-primary/40 hover:bg-muted/30'}`}
                onClick={() => fileRef.current?.click()}
              >
                {file ? (
                  <div className="space-y-2">
                    {file.type.startsWith('image/') ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={URL.createObjectURL(file)} alt="Preview" className="max-h-32 mx-auto rounded-lg" />
                    ) : (
                      <FileText className="h-12 w-12 mx-auto text-primary" />
                    )}
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                    <Button size="sm" variant="outline" className="text-red-500" onClick={(e) => { e.stopPropagation(); setFile(null); }}>
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="h-14 w-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
                      <Upload className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">Upload a document</p>
                    <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLS, JPG, PNG</p>
                    <p className="text-xs text-muted-foreground">Max 10MB · optional</p>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
