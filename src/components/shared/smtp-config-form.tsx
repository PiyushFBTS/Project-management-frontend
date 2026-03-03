'use client';

import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Loader2, Send, Save, Mail, Paperclip, X,
  Server, Lock, Trash2, Plus, Pencil, Inbox,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SaveSmtpConfigDto, SmtpConfig } from '@/types';
import { AxiosResponse } from 'axios';

interface SmtpConfigFormProps {
  queryKey: string[];
  fetchConfigs: () => Promise<AxiosResponse<SmtpConfig[]>>;
  createConfig: (dto: SaveSmtpConfigDto) => Promise<AxiosResponse<SmtpConfig>>;
  updateConfig: (smtpId: number, dto: SaveSmtpConfigDto) => Promise<AxiosResponse<SmtpConfig>>;
  deleteConfig: (smtpId: number) => Promise<AxiosResponse<{ message: string }>>;
  testConfig: (smtpId: number, dto: { recipientEmail: string }) => Promise<AxiosResponse<{ message: string }>>;
  sendEmail?: (smtpId: number, recipientEmail: string, subject: string, body: string, attachments?: File[]) => Promise<AxiosResponse<{ message: string }>>;
}

interface FormState {
  label: string;
  host: string;
  port: string;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  encryption: string;
  isActive: string;
}

const defaultForm: FormState = {
  label: '',
  host: '',
  port: '587',
  username: '',
  password: '',
  fromEmail: '',
  fromName: '',
  encryption: 'tls',
  isActive: 'active',
};

const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];

export function SmtpConfigForm({
  queryKey, fetchConfigs, createConfig, updateConfig, deleteConfig, testConfig, sendEmail,
}: SmtpConfigFormProps) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>({ ...defaultForm });
  const [testEmail, setTestEmail] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null); // null = creating new

  // Compose email state
  const [selectedSmtpId, setSelectedSmtpId] = useState<string>('');
  const [composeEmail, setComposeEmail] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: fetchConfigs,
  });

  const raw = data?.data;
  const configs: SmtpConfig[] = Array.isArray(raw) ? raw : (raw as any)?.data ?? [];

  // Auto-select first config for compose when configs load
  useEffect(() => {
    if (configs.length > 0 && !selectedSmtpId) {
      setSelectedSmtpId(String(configs[0].id));
    }
  }, [configs, selectedSmtpId]);

  const saveMutation = useMutation({
    mutationFn: (params: { id: number | null; dto: SaveSmtpConfigDto }) =>
      params.id !== null
        ? updateConfig(params.id, params.dto)
        : createConfig(params.dto),
    onSuccess: () => {
      toast.success(editingId !== null ? 'SMTP configuration updated' : 'SMTP configuration created');
      setDialogOpen(false);
      setEditingId(null);
      setForm({ ...defaultForm });
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message;
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg ?? 'Failed to save SMTP config');
    },
  });

  const testMutation = useMutation({
    mutationFn: (params: { smtpId: number; email: string }) =>
      testConfig(params.smtpId, { recipientEmail: params.email }),
    onSuccess: () => toast.success('Test email sent successfully'),
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Failed to send test email');
    },
  });

  const sendMutation = useMutation({
    mutationFn: (params: { smtpId: number; email: string; subject: string; body: string; files: File[] }) =>
      sendEmail!(params.smtpId, params.email, params.subject, params.body, params.files.length > 0 ? params.files : undefined),
    onSuccess: () => {
      toast.success('Email sent successfully');
      setComposeEmail('');
      setComposeSubject('');
      setComposeBody('');
      setAttachments([]);
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Failed to send email');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (smtpId: number) => deleteConfig(smtpId),
    onSuccess: () => {
      toast.success('SMTP configuration deleted');
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: unknown) => {
      const err = e as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message ?? 'Failed to delete SMTP config');
    },
  });

  function handleDelete(smtpId: number) {
    if (!confirm('Are you sure you want to delete this SMTP configuration?')) return;
    deleteMutation.mutate(smtpId);
  }

  function handleSave() {
    if (!form.host || !form.username || !form.password || !form.fromEmail) {
      toast.error('Host, username, password, and from email are required');
      return;
    }
    const dto: SaveSmtpConfigDto = {
      label: form.label || undefined,
      host: form.host,
      port: parseInt(form.port) || 587,
      username: form.username,
      password: form.password,
      fromEmail: form.fromEmail,
      fromName: form.fromName || undefined,
      encryption: form.encryption as 'tls' | 'ssl' | 'none',
      isActive: form.isActive === 'active',
    };
    saveMutation.mutate({ id: editingId, dto });
  }

  function handleTest() {
    if (!testEmail) {
      toast.error('Enter a recipient email');
      return;
    }
    if (editingId === null) {
      toast.error('Save the configuration first to test it');
      return;
    }
    testMutation.mutate({ smtpId: editingId, email: testEmail });
  }

  function handleSend() {
    if (!selectedSmtpId) { toast.error('Select an SMTP configuration'); return; }
    if (!composeEmail) { toast.error('Enter a recipient email'); return; }
    if (!composeSubject) { toast.error('Enter a subject'); return; }
    if (!composeBody) { toast.error('Enter a message body'); return; }
    sendMutation.mutate({
      smtpId: parseInt(selectedSmtpId),
      email: composeEmail,
      subject: composeSubject,
      body: composeBody,
      files: attachments,
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const valid: File[] = [];
    for (const file of files) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" is not allowed. Only PDF, Word, and image files are accepted.`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`"${file.name}" exceeds 10 MB limit.`);
        continue;
      }
      valid.push(file);
    }
    setAttachments((prev) => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function openAddDialog() {
    setEditingId(null);
    setForm({ ...defaultForm });
    setTestEmail('');
    setDialogOpen(true);
  }

  function openEditDialog(config: SmtpConfig) {
    setEditingId(config.id);
    setForm({
      label: config.label ?? '',
      host: config.host ?? '',
      port: String(config.port ?? 587),
      username: config.username ?? '',
      password: config.password ?? '',
      fromEmail: config.fromEmail ?? '',
      fromName: config.fromName ?? '',
      encryption: config.encryption ?? 'tls',
      isActive: config.isActive ? 'active' : 'inactive',
    });
    setTestEmail('');
    setDialogOpen(true);
  }

  const selectedConfig = configs.find((c) => String(c.id) === selectedSmtpId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add button — always visible */}
      <Button type="button" className="bg-violet-600 hover:bg-violet-700 text-white" onClick={openAddDialog}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add SMTP Configuration
      </Button>

      {/* Empty state */}
      {configs.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Inbox className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium text-muted-foreground">No SMTP configured</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add an SMTP configuration to start sending emails.
          </p>
        </div>
      )}

      {/* SMTP configs — table-style list */}
      {configs.length > 0 && (
        <div className="rounded-lg border overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_80px_90px_1fr_80px_90px] gap-2 px-4 py-2 bg-muted/60 text-xs font-medium text-muted-foreground uppercase tracking-wider">
            <span>Host</span>
            <span>Port</span>
            <span>Encryption</span>
            <span>From Email</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>
          {/* Table rows */}
          {configs.map((config) => (
            <div key={config.id} className="grid grid-cols-[1fr_80px_90px_1fr_80px_90px] gap-2 px-4 py-3 items-center text-sm border-t">
              <div className="flex items-center gap-1.5 truncate">
                <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate font-medium">
                  {config.label ? `${config.label} (${config.host})` : config.host}
                </span>
              </div>
              <span>{config.port}</span>
              <div className="flex items-center gap-1">
                <Lock className="h-3 w-3 text-muted-foreground" />
                <span className="uppercase">{config.encryption}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{config.fromEmail}</span>
              </div>
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium w-fit ${
                config.isActive
                  ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300'
              }`}>
                {config.isActive ? 'Active' : 'Inactive'}
              </span>
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(config)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={deleteMutation.isPending}
                  onClick={() => handleDelete(config.id)}
                  title="Delete"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SMTP Config Dialog — Add / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-violet-500" />
              {editingId !== null ? 'Edit SMTP Configuration' : 'Add SMTP Configuration'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {/* Label */}
            <div className="space-y-1.5">
              <Label>Label</Label>
              <Input
                value={form.label || ''}
                onChange={(e) => setForm((p) => ({ ...p, label: e.target.value }))}
                placeholder="e.g. Marketing, Notifications, Support"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>SMTP Host *</Label>
                <Input
                  value={form.host || ''}
                  onChange={(e) => setForm((p) => ({ ...p, host: e.target.value }))}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Port *</Label>
                <Input
                  type="number"
                  value={form.port || ''}
                  onChange={(e) => setForm((p) => ({ ...p, port: e.target.value }))}
                  placeholder="587"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Username *</Label>
                <Input
                  value={form.username || ''}
                  onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Password *</Label>
                <Input
                  type="password"
                  value={form.password || ''}
                  onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-1.5">
                <Label>From Email *</Label>
                <Input
                  value={form.fromEmail || ''}
                  onChange={(e) => setForm((p) => ({ ...p, fromEmail: e.target.value }))}
                  placeholder="noreply@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>From Name</Label>
                <Input
                  value={form.fromName || ''}
                  onChange={(e) => setForm((p) => ({ ...p, fromName: e.target.value }))}
                  placeholder="IT Project Manager"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Encryption</Label>
                <Select
                  value={form.encryption || 'tls'}
                  onValueChange={(v) => setForm((p) => ({ ...p, encryption: v }))}
                >
                  <SelectTrigger  className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tls">TLS</SelectItem>
                    <SelectItem value="ssl">SSL</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.isActive || 'active'}
                  onValueChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                >
                  <SelectTrigger  className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Test email inside dialog — only when editing existing config */}
            {editingId !== null && (
              <div className="border-t pt-3 space-y-2">
                <Label className="text-sm font-medium">Send Test Email</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={testEmail || ''}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1"
                  />
                  <Button type="button" variant="outline" size="sm" disabled={testMutation.isPending} onClick={handleTest}>
                    {testMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1.5 h-4 w-4" />
                    )}
                    Test
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-violet-600 hover:bg-violet-700 text-white"
                disabled={saveMutation.isPending}
                onClick={handleSave}
              >
                {saveMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-4 w-4" />
                )}
                {editingId !== null ? 'Update Configuration' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Compose & Send Email — visible when configs exist and sendEmail prop is provided */}
      {configs.length > 0 && sendEmail && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-500" />
            <Label className="text-sm font-semibold">Compose Email</Label>
          </div>

          {/* SMTP selector — show when multiple configs */}
          {configs.length > 1 ? (
            <div className="space-y-1.5">
              <Label>Send from *</Label>
              <Select value={selectedSmtpId} onValueChange={setSelectedSmtpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select SMTP to send from" />
                </SelectTrigger>
                <SelectContent>
                  {configs.filter((c) => c.isActive).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.label
                        ? `${c.label} — ${c.fromEmail}`
                        : `${c.fromEmail} (${c.host})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">From:</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 dark:bg-sky-950 px-2 py-0.5 text-sky-700 dark:text-sky-300 text-xs font-medium">
                <Mail className="h-3 w-3" />
                {configs[0].fromName
                  ? `${configs[0].fromName} <${configs[0].fromEmail}>`
                  : configs[0].fromEmail}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>To *</Label>
            <Input
              type="email"
              value={composeEmail || ''}
              onChange={(e) => setComposeEmail(e.target.value)}
              placeholder="recipient@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Subject *</Label>
            <Input
              value={composeSubject || ''}
              onChange={(e) => setComposeSubject(e.target.value)}
              placeholder="Enter email subject"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Message *</Label>
            <Textarea
              value={composeBody || ''}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="Write your email message here..."
              rows={5}
            />
          </div>

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm">Attachments</Label>
              <span className="text-xs text-muted-foreground">(PDF, Word, Images — max 10 MB each)</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.webp"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="mr-1.5 h-3.5 w-3.5" />
              Attach Files
            </Button>
            {attachments.length > 0 && (
              <div className="space-y-1">
                {attachments.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                    <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                    <button type="button" onClick={() => removeAttachment(i)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button className="bg-sky-600 hover:bg-sky-700 text-white" disabled={sendMutation.isPending} onClick={handleSend}>
            {sendMutation.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Send className="mr-1.5 h-4 w-4" />}
            Send Email
          </Button>
        </div>
      )}
    </div>
  );
}
