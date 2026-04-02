/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Plus, Pencil, Trash2, Calendar, PartyPopper } from 'lucide-react';
import { api } from '@/lib/api/axios-instance';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export default function HolidaysPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const isAdmin = user?._type === 'admin';
  const isHr = user?._type === 'employee' && !!(user as any)?.isHr;
  const canEdit = isAdmin || isHr;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');

  const prefix = isAdmin ? '/admin' : '/employee';

  const { data: holidaysRaw, isLoading } = useQuery({
    queryKey: ['holidays', isAdmin],
    queryFn: async () => {
      const r = await api.get(`${prefix}/holidays`);
      return r.data?.data ?? r.data ?? [];
    },
    enabled: !!user,
  });

  const holidays: any[] = Array.isArray(holidaysRaw) ? holidaysRaw : [];

  // Group by month
  const grouped: Record<string, any[]> = {};
  holidays.forEach((h) => {
    const d = h.holidayDate ?? h.holiday_date;
    if (!d) return;
    const key = format(new Date(d + 'T00:00:00'), 'MMMM yyyy');
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(h);
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editId) {
        return api.patch(`/admin/holidays/${editId}`, { name: formName, holidayDate: formDate, description: formDesc || null });
      }
      return api.post('/admin/holidays', { name: formName, holidayDate: formDate, description: formDesc || null });
    },
    onSuccess: () => {
      toast.success(editId ? 'Holiday updated' : 'Holiday added');
      qc.invalidateQueries({ queryKey: ['holidays'] });
      closeDialog();
    },
    onError: () => toast.error('Failed to save'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/holidays/${id}`),
    onSuccess: () => {
      toast.success('Holiday deleted');
      qc.invalidateQueries({ queryKey: ['holidays'] });
    },
  });

  const closeDialog = () => {
    setDialogOpen(false);
    setEditId(null);
    setFormName('');
    setFormDate('');
    setFormDesc('');
  };

  const openAdd = () => {
    setEditId(null);
    setFormName('');
    setFormDate('');
    setFormDesc('');
    setDialogOpen(true);
  };

  const openEdit = (h: any) => {
    setEditId(h.id);
    setFormName(h.name);
    setFormDate(h.holidayDate ?? h.holiday_date ?? '');
    setFormDesc(h.description ?? '');
    setDialogOpen(true);
  };

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <PartyPopper className="h-5 w-5 text-primary" /> Public Holidays
          </h1>
          <p className="text-sm text-muted-foreground">{holidays.length} holidays this year</p>
        </div>
        {canEdit && (
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" /> Add Holiday
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : holidays.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">No holidays found</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([month, items]) => (
          <div key={month}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{month}</h2>
            <div className="space-y-2">
              {items.map((h: any) => {
                const d = new Date((h.holidayDate ?? h.holiday_date) + 'T00:00:00');
                const isPast = d < now;
                return (
                  <Card key={h.id} className={isPast ? 'opacity-60' : ''}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
                        <span className="text-lg font-bold leading-none">{format(d, 'dd')}</span>
                        <span className="text-[10px] uppercase">{format(d, 'MMM')}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{h.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(d, 'EEEE')}
                          {h.description ? ` · ${h.description}` : ''}
                        </p>
                      </div>
                      {isPast && <Badge variant="outline" className="text-[10px] shrink-0">Past</Badge>}
                      {!isPast && (
                        <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0 shrink-0">
                          Upcoming
                        </Badge>
                      )}
                      {canEdit && (
                        <div className="flex gap-1 shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(h)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => {
                            if (confirm(`Delete "${h.name}"?`)) deleteMut.mutate(h.id);
                          }}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Holiday' : 'Add Holiday'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Name *</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Republic Day" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Date *</label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="Optional description" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!formName || !formDate || saveMut.isPending}>
                {saveMut.isPending ? 'Saving...' : editId ? 'Update' : 'Add'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
