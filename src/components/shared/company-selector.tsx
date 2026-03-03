'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Building2, Search, X, ChevronDown, LogIn } from 'lucide-react';
import { useCompany, SelectedCompany } from '@/providers/company-provider';
import { companiesApi } from '@/lib/api/companies';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function CompanySelector() {
  const { selectedCompany, selectCompany, clearCompany, isSuperAdmin } = useCompany();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['platform-companies-selector', search],
    queryFn: () => companiesApi.getAll({ search: search || undefined, limit: 50 }),
    enabled: isSuperAdmin && open,
  });

  if (!isSuperAdmin) return null;

  const companies = data?.data?.data ?? [];

  const handleSelect = (company: SelectedCompany) => {
    selectCompany(company);
    setOpen(false);
    setSearch('');
    router.push('/dashboard');
  };

  if (selectedCompany) {
    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 transition-colors"
        >
          <Building2 className="h-3 w-3" />
          <span className="max-w-32 truncate">{selectedCompany.name}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
        <button
          onClick={() => { clearCompany(); router.push('/dashboard'); }}
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Back to platform"
        >
          <X className="h-3 w-3" />
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-500" />
                Switch Company
              </DialogTitle>
            </DialogHeader>
            <CompanyList
              search={search}
              onSearchChange={setSearch}
              companies={companies}
              isLoading={isLoading}
              onSelect={handleSelect}
              selectedId={selectedCompany.id}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 border-dashed text-xs"
      >
        <Building2 className="h-3.5 w-3.5" />
        Select Company
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-indigo-500" />
              Select Company
            </DialogTitle>
          </DialogHeader>
          <CompanyList
            search={search}
            onSearchChange={setSearch}
            companies={companies}
            isLoading={isLoading}
            onSelect={handleSelect}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompanyList({
  search,
  onSearchChange,
  companies,
  isLoading,
  onSelect,
  selectedId,
}: {
  search: string;
  onSearchChange: (v: string) => void;
  companies: Array<{ id: number; name: string; slug: string; isActive: boolean; subscriptionPlan: string }>;
  isLoading: boolean;
  onSelect: (c: SelectedCompany) => void;
  selectedId?: number;
}) {
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search companies..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8"
        />
      </div>
      <div className="max-h-64 overflow-y-auto space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : companies.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No companies found</p>
        ) : (
          companies.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect({ id: c.id, name: c.name, slug: c.slug })}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
                selectedId === c.id ? 'bg-indigo-500/10 ring-1 ring-indigo-500/30' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15">
                  <Building2 className="h-4 w-4 text-indigo-500" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] ${c.isActive ? 'border-emerald-500/30 text-emerald-600' : 'border-red-500/30 text-red-500'}`}
                >
                  {c.isActive ? 'Active' : 'Inactive'}
                </Badge>
                <LogIn className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
