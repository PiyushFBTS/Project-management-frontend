/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, FolderKanban, Tags, Users, Receipt,
  ClipboardList, BarChart3, ChevronDown, X,
  ChevronLeft, ChevronRight, CalendarDays, Building2, LogOut, Settings, Ticket, Mail,
  Megaphone, Wallet, Layers, Laptop2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { useSidebar } from '@/providers/sidebar-provider';
import { useAuth } from '@/providers/auth-provider';
import { useCompany } from '@/providers/company-provider';
import { pmTaskApprovalsApi } from '@/lib/api/task-sheets';
import { ClipboardCheck } from 'lucide-react';

type NavChild = { label: string; href: string; dotColor: string; hrOrAdminOnly?: boolean };

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  activeBg: string;
  hoverBg: string;
  borderColor: string;
  dotColor: string;
  adminOnly?: boolean;
  /**
   * Visible only to users with managerial access (admin / HR / accounts).
   * Strictly broader than `adminOnly` — HR and Accounts can also see
   * these. Used for hubs like Salary Slips that backend gates with
   * @SalarySlipManagerOnly().
   */
  managerOnly?: boolean;
  children?: NavChild[];
};

const navItems: NavItem[] = [
  {
    label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard,
    iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/20',
    activeBg: 'bg-indigo-500/20', hoverBg: 'hover:bg-indigo-500/10',
    borderColor: 'border-l-indigo-400', dotColor: 'bg-indigo-400',
  },
  {
    label: 'Project Types', href: '/project-types', icon: Tags,
    iconColor: 'text-cyan-400', iconBg: 'bg-cyan-500/20',
    activeBg: 'bg-cyan-500/20', hoverBg: 'hover:bg-cyan-500/10',
    borderColor: 'border-l-cyan-400', dotColor: 'bg-cyan-400',
    adminOnly: true,
  },
  {
    label: 'Project Groups', href: '/project-groups', icon: Layers,
    iconColor: 'text-teal-400', iconBg: 'bg-teal-500/20',
    activeBg: 'bg-teal-500/20', hoverBg: 'hover:bg-teal-500/10',
    borderColor: 'border-l-teal-400', dotColor: 'bg-teal-400',
    adminOnly: true,
  },

  {
    label: 'Projects', href: '/projects', icon: FolderKanban,
    iconColor: 'text-blue-400', iconBg: 'bg-blue-500/20',
    activeBg: 'bg-blue-500/20', hoverBg: 'hover:bg-blue-500/10',
    borderColor: 'border-l-blue-400', dotColor: 'bg-blue-400',
  },
    {
    label: 'Daily Log Sheets', href: '/task-sheets', icon: ClipboardList,
    iconColor: 'text-violet-400', iconBg: 'bg-violet-500/20',
    activeBg: 'bg-violet-500/20', hoverBg: 'hover:bg-violet-500/10',
    borderColor: 'border-l-violet-400', dotColor: 'bg-violet-400',
  },
  {
    // Single "Tickets" nav entry — the page itself has My Tickets /
    // Tickets Log tabs. /my-tasks and /full-tickets still resolve via
    // redirect stubs for old bookmarks.
    label: 'Tickets', href: '/tickets', icon: Ticket,
    iconColor: 'text-teal-400', iconBg: 'bg-teal-500/20',
    activeBg: 'bg-teal-500/20', hoverBg: 'hover:bg-teal-500/10',
    borderColor: 'border-l-teal-400', dotColor: 'bg-teal-400',
  },
  {
    label: 'Employees', href: '/employees', icon: Users,
    iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/20',
    activeBg: 'bg-emerald-500/20', hoverBg: 'hover:bg-emerald-500/10',
    borderColor: 'border-l-emerald-400', dotColor: 'bg-emerald-400',
  },
  {
    label: 'Leave Management', icon: CalendarDays,
    iconColor: 'text-orange-400', iconBg: 'bg-orange-500/20',
    activeBg: 'bg-orange-500/20', hoverBg: 'hover:bg-orange-500/10',
    borderColor: 'border-l-orange-400', dotColor: 'bg-orange-400',
    children: [
      { label: 'Leave Types', href: '/leave-types', dotColor: 'bg-rose-400', hrOrAdminOnly: true },
      { label: 'Leave Requests', href: '/leave-requests', dotColor: 'bg-orange-400' },
      { label: 'Leave Balance', href: '/leave-balance', dotColor: 'bg-blue-400' },
      { label: 'Holiday Calendar', href: '/holidays', dotColor: 'bg-amber-400' },
    ],
  },
  {
    // Approval inbox for project managers, HR, and admins. Plain employees
    // see an empty list — visibility is gated below by `pendingCount > 0
    // || isHr || isAdmin` so the entry simply doesn't appear for users
    // who have nothing to act on.
    label: 'My Approvals', href: '/task-approvals', icon: ClipboardCheck,
    iconColor: 'text-blue-400', iconBg: 'bg-blue-500/20',
    activeBg: 'bg-blue-500/20', hoverBg: 'hover:bg-blue-500/10',
    borderColor: 'border-l-blue-400', dotColor: 'bg-blue-400',
  },
  {
    label: 'Expenses', href: '/expenses', icon: Receipt,
    iconColor: 'text-lime-400', iconBg: 'bg-lime-500/20',
    activeBg: 'bg-lime-500/20', hoverBg: 'hover:bg-lime-500/10',
    borderColor: 'border-l-lime-400', dotColor: 'bg-lime-400',
  },
  {
    label: 'Salary Slips', href: '/salary-slips', icon: Wallet,
    iconColor: 'text-pink-400', iconBg: 'bg-pink-500/20',
    activeBg: 'bg-pink-500/20', hoverBg: 'hover:bg-pink-500/10',
    borderColor: 'border-l-pink-400', dotColor: 'bg-pink-400',
    // Admin / HR / Accounts only — matches the backend's
    // @SalarySlipManagerOnly() guard. Plain employees view their own
    // slips from the profile tab; they don't need the admin hub.
    managerOnly: true,
  },
  {
    label: 'Reports', icon: BarChart3,
    iconColor: 'text-amber-400', iconBg: 'bg-amber-500/20',
    activeBg: 'bg-amber-500/20', hoverBg: 'hover:bg-amber-500/10',
    borderColor: 'border-l-amber-400', dotColor: 'bg-amber-400',
    // Employee-Wise / Project-Wise / Daily Fill are visible to everyone
    // — backend auto-scopes plain employees to self-only data. The
    // remaining four stay HR/admin only.
    children: [
      { label: 'Log History', href: '/reports/sheet-history', dotColor: 'bg-blue-400' },
      { label: 'Activity Tracker', href: '/reports/employee-wise', dotColor: 'bg-indigo-400' },
      { label: 'Project-Wise', href: '/reports/project-wise', dotColor: 'bg-violet-400', hrOrAdminOnly: true },
      { label: 'Last Filled', href: '/reports/last-filled', dotColor: 'bg-rose-400', hrOrAdminOnly: true },
      { label: 'Monthly Grid', href: '/reports/monthly-grid', dotColor: 'bg-cyan-400' },
      { label: 'Employee Costing', href: '/reports/employee-cost', dotColor: 'bg-orange-400', hrOrAdminOnly: true },
      { label: 'Project Costing', href: '/reports/project-cost', dotColor: 'bg-teal-400', hrOrAdminOnly: true },
    ],
  },
  {
    label: 'Assets', icon: Laptop2,
    iconColor: 'text-emerald-400', iconBg: 'bg-emerald-500/20',
    activeBg: 'bg-emerald-500/20', hoverBg: 'hover:bg-emerald-500/10',
    borderColor: 'border-l-emerald-400', dotColor: 'bg-emerald-400',
    children: [
      { label: 'Inventory', href: '/assets', dotColor: 'bg-emerald-400', hrOrAdminOnly: true },
      { label: 'Vendors', href: '/asset-vendors', dotColor: 'bg-teal-400', hrOrAdminOnly: true },
    ],
  },
  {
    label: 'Announcements', href: '/announcements', icon: Megaphone,
    iconColor: 'text-rose-400', iconBg: 'bg-rose-500/20',
    activeBg: 'bg-rose-500/20', hoverBg: 'hover:bg-rose-500/10',
    borderColor: 'border-l-rose-400', dotColor: 'bg-rose-400',
  },
  {
    label: 'Email Outbox', href: '/email-outbox', icon: Mail,
    iconColor: 'text-sky-400', iconBg: 'bg-sky-500/20',
    activeBg: 'bg-sky-500/20', hoverBg: 'hover:bg-sky-500/10',
    borderColor: 'border-l-sky-400', dotColor: 'bg-sky-400',
    adminOnly: true,
  },
  {
    label: 'Settings', href: '/settings', icon: Settings,
    iconColor: 'text-slate-400', iconBg: 'bg-slate-500/20',
    activeBg: 'bg-slate-500/20', hoverBg: 'hover:bg-slate-500/10',
    borderColor: 'border-l-slate-400', dotColor: 'bg-slate-400',
    adminOnly: true,
  },
];

const platformNavItems: NavItem[] = [
  {
    label: 'Platform Dashboard', href: '/dashboard', icon: LayoutDashboard,
    iconColor: 'text-indigo-400', iconBg: 'bg-indigo-500/20',
    activeBg: 'bg-indigo-500/20', hoverBg: 'hover:bg-indigo-500/10',
    borderColor: 'border-l-indigo-400', dotColor: 'bg-indigo-400',
  },
  {
    label: 'Companies', href: '/companies', icon: Building2,
    iconColor: 'text-violet-400', iconBg: 'bg-violet-500/20',
    activeBg: 'bg-violet-500/20', hoverBg: 'hover:bg-violet-500/10',
    borderColor: 'border-l-violet-400', dotColor: 'bg-violet-400',
  },
  {
    label: 'Email Outbox', href: '/email-outbox', icon: Mail,
    iconColor: 'text-sky-400', iconBg: 'bg-sky-500/20',
    activeBg: 'bg-sky-500/20', hoverBg: 'hover:bg-sky-500/10',
    borderColor: 'border-l-sky-400', dotColor: 'bg-sky-400',
  },
  {
    label: 'Settings', href: '/settings', icon: Settings,
    iconColor: 'text-slate-400', iconBg: 'bg-slate-500/20',
    activeBg: 'bg-slate-500/20', hoverBg: 'hover:bg-slate-500/10',
    borderColor: 'border-l-slate-400', dotColor: 'bg-slate-400',
  },
];

function NavContent({ onNavigate, collapsed, isEmployee, isHr, isAccounts, isClient }: { onNavigate?: () => void; collapsed?: boolean; isEmployee?: boolean; isHr?: boolean; isAccounts?: boolean; isClient?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { selectedCompany, clearCompany, isSuperAdmin } = useCompany();
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  // Pending-approval count for the "My Approvals" entry. Skipped for
  // clients (no access) and the super-admin platform view (no company
  // context). Cheap query — backend returns an empty list for users
  // who aren't a PM and aren't HR/admin.
  const approvalsEnabled = !isClient && !(isSuperAdmin && !selectedCompany);
  const { data: pendingApprovalRows } = useQuery({
    queryKey: ['sidebar-pending-approvals', selectedCompany?.id ?? null],
    queryFn: () => pmTaskApprovalsApi.list('pending').then((r) => r.data.data),
    enabled: approvalsEnabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const pendingApprovalsCount = pendingApprovalRows?.length ?? 0;
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    Reports: pathname.startsWith('/reports'),
    'Leave Management': pathname.startsWith('/leave-r') || pathname.startsWith('/holidays'),
  });
  const toggleSection = (label: string) =>
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));

  const canSeeHrItems = !isEmployee || isHr;
  // Manager-only items (admin / HR / accounts) — broader than HR-only.
  // Used by hubs the backend gates with @SalarySlipManagerOnly().
  const canSeeManagerItems = !isEmployee || isHr || isAccounts;

  // Super admin without company selected → show platform nav
  const baseItems = isSuperAdmin && !selectedCompany ? platformNavItems : navItems;

  const clientAllowedLabels = ['Dashboard', 'Projects', 'Ticket Log', 'My Ticket'];

  // "My Approvals" stays hidden for plain employees who have nothing to
  // act on — they aren't a PM of any project and aren't HR/admin, so the
  // page would just be empty. HR sees the null-project bucket and admins
  // see everything, so both always get the entry. PMs get it as soon as
  // a sheet is waiting on them (count > 0).
  const showApprovalsEntry =
    !isClient && (!isEmployee || isHr || pendingApprovalsCount > 0);

  const visibleItems = (() => {
    if (isClient) return baseItems.filter((item) => clientAllowedLabels.includes(item.label));
    if (isEmployee) {
      // Plain employees (no flags) get the standard slimmed nav.
      // HR/Accounts still pass through this branch but their flags
      // unlock the `managerOnly` items below.
      return baseItems.filter((item) => {
        if (item.adminOnly) return false;
        if (item.managerOnly && !canSeeManagerItems) return false;
        if (item.label === 'My Approvals' && !showApprovalsEntry) return false;
        return true;
      });
    }
    return baseItems.filter(
      (item) => item.label !== 'My Approvals' || showApprovalsEntry,
    );
  })()
    .map((item) => {
      if (!item.children) return item;
      const filteredChildren = item.children.filter((c) => !c.hrOrAdminOnly || canSeeHrItems);
      if (filteredChildren.length === 0) return null;
      return { ...item, children: filteredChildren };
    })
    .filter(Boolean) as NavItem[];

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
      {/* Super admin company context banner */}
      {isSuperAdmin && selectedCompany && !collapsed && (
        <div className="mx-1 mb-3 flex items-center gap-2 rounded-lg bg-indigo-500/10 px-2.5 py-2 ring-1 ring-indigo-500/20">
          {selectedCompany.logoUrl ? (
            <img src={`${apiBase}${selectedCompany.logoUrl}`} alt="" className="h-5 w-5 shrink-0 rounded-sm object-cover" />
          ) : (
            <Building2 className="h-3.5 w-3.5 shrink-0 text-indigo-400" />
          )}
          <span className="flex-1 truncate text-xs font-medium text-indigo-300">{selectedCompany.name}</span>
          <button
            onClick={() => { clearCompany(); router.push('/dashboard'); }}
            title="Back to platform"
            className="rounded p-0.5 text-indigo-400/70 hover:text-indigo-300 hover:bg-indigo-500/20 transition-colors"
          >
            <LogOut className="h-3 w-3" />
          </button>
        </div>
      )}
      {visibleItems.map((item) => {
        if (item.children) {
          const isActive = item.children.some((c) => pathname.startsWith(c.href));
          const isOpen = openSections[item.label] ?? false;

          if (collapsed) {
            return (
              <button
                key={item.label}
                title={item.label}
                onClick={() => toggleSection(item.label)}
                className={cn(
                  'flex w-full items-center justify-center rounded-lg p-2 transition-all',
                  item.hoverBg, 'hover:text-gray-900 dark:hover:text-white',
                  isActive && `${item.activeBg} text-gray-900 dark:text-white border-l-2 ${item.borderColor}`,
                  !isActive && 'text-gray-500 dark:text-slate-400',
                )}
              >
                <div className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                  isActive ? item.iconBg : '',
                )}>
                  <item.icon className={cn('h-4 w-4', isActive ? item.iconColor : 'text-gray-400 dark:text-slate-500')} />
                </div>
              </button>
            );
          }

          return (
            <div key={item.label}>
              <button
                onClick={() => toggleSection(item.label)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-all border-l-2 border-l-transparent',
                  item.hoverBg, 'hover:text-gray-900 dark:hover:text-white',
                  isActive ? `${item.activeBg} text-gray-900 dark:text-white ${item.borderColor}` : 'text-gray-500 dark:text-slate-400',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <div className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                    isActive ? item.iconBg : 'bg-sidebar-accent/40',
                  )}>
                    <item.icon className={cn('h-4 w-4', isActive ? item.iconColor : 'text-gray-400 dark:text-slate-500')} />
                  </div>
                  {item.label}
                </span>
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isActive ? item.iconColor : 'text-gray-400 dark:text-slate-600', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className={cn('ml-4 mt-1 space-y-0.5 border-l-2 pl-3', `${item.borderColor.replace('border-l-', 'border-')}/30`)}>
                  {item.children.map((c) => (
                    <Link
                      key={c.href}
                      href={c.href}
                      onClick={onNavigate}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors',
                        'text-gray-500 dark:text-slate-400 hover:bg-sidebar-accent hover:text-gray-900 dark:hover:text-white',
                        pathname === c.href && 'bg-sidebar-accent text-gray-900 dark:text-white font-medium',
                      )}
                    >
                      <div className={cn('h-1.5 w-1.5 rounded-full', pathname === c.href ? c.dotColor : 'bg-gray-400 dark:bg-slate-600')} />
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        const isActive = pathname === item.href;
        const showApprovalsBadge =
          item.label === 'My Approvals' && pendingApprovalsCount > 0;

        if (collapsed) {
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onNavigate}
              title={showApprovalsBadge ? `${item.label} (${pendingApprovalsCount})` : item.label}
              className={cn(
                'relative flex items-center justify-center rounded-lg p-2 transition-all',
                item.hoverBg, 'hover:text-gray-900 dark:hover:text-white',
                isActive ? `${item.activeBg} text-gray-900 dark:text-white border-l-2 ${item.borderColor}` : 'text-gray-500 dark:text-slate-400',
              )}
            >
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-all',
                isActive ? item.iconBg : '',
              )}>
                <item.icon className={cn('h-4 w-4 transition-colors', isActive ? item.iconColor : 'text-gray-400 dark:text-slate-500')} />
              </div>
              {showApprovalsBadge && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-sidebar" />
              )}
            </Link>
          );
        }

        return (
          <Link
            key={item.href}
            href={item.href!}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all border-l-2',
              item.hoverBg, 'hover:text-gray-900 dark:hover:text-white',
              isActive
                ? `${item.activeBg} text-gray-900 dark:text-white ${item.borderColor}`
                : 'text-gray-500 dark:text-slate-400 border-l-transparent',
            )}
          >
            <div className={cn(
              'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-all',
              isActive ? item.iconBg : 'bg-sidebar-accent/40',
            )}>
              <item.icon className={cn('h-4 w-4 transition-colors', isActive ? item.iconColor : 'text-gray-400 dark:text-slate-500')} />
            </div>
            {item.label}
            {showApprovalsBadge && (
              <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-semibold leading-none text-white">
                {pendingApprovalsCount > 99 ? '99+' : pendingApprovalsCount}
              </span>
            )}
            {isActive && !showApprovalsBadge && (
              <div className={cn('ml-auto h-1.5 w-1.5 rounded-full', item.dotColor)} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function Footer({ collapsed, isEmployee }: { collapsed?: boolean; isEmployee?: boolean }) {
  return (
    <div className="border-t border-sidebar-border px-4 py-3 shrink-0">
      {!collapsed && (
        <p className="text-[10px] text-gray-400 dark:text-slate-600 text-center">
          v1.0 · {isEmployee ? 'Employee Portal' : 'Admin Portal'}
        </p>
      )}
    </div>
  );
}

/** Desktop: collapsible fixed aside */
export function Sidebar() {
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { user } = useAuth();
  // `_type` is already promoted to 'admin' for soft-admin employees
  // (see auth-provider). `isHr` still keys off the underlying record.
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const isAccounts = isEmployee && !!(user as any)?.isAccounts;
  const isClient = user?._type === 'client';

  return (
    <aside
      className={cn(
        'hidden lg:flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand / header with collapse toggle */}
      <div className={cn(
        'flex h-14 items-center border-b border-sidebar-border shrink-0 overflow-hidden',
        isCollapsed ? 'justify-center px-0' : 'gap-2.5 px-4',
      )}>
        {isCollapsed ? (
          <button
            onClick={toggleCollapse}
            title="Expand sidebar"
            className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-sidebar-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-md shadow-indigo-500/30 overflow-hidden">
              <Image src="/ITSM_LOGO.png" alt="FlamX logo" width={32} height={32} unoptimized className="h-full w-full object-contain p-0.5" />
            </div>
            <div className="leading-tight min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white truncate tracking-wide">FlamX</p>
              {/* <p className="text-[10px] font-medium text-gray-500 dark:text-slate-400">Management System</p> */}
            </div>
            <button
              onClick={toggleCollapse}
              title="Collapse sidebar"
              className="flex items-center justify-center rounded-lg p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-sidebar-accent transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <NavContent collapsed={isCollapsed} isEmployee={isEmployee} isHr={isHr} isAccounts={isAccounts} isClient={isClient} />

      <Footer collapsed={isCollapsed} isEmployee={isEmployee} />
    </aside>
  );
}

/** Mobile: Sheet drawer triggered by header hamburger */
export function MobileSidebar() {
  const { isOpen, close } = useSidebar();
  const { user } = useAuth();
  // `_type` is already promoted to 'admin' for soft-admin employees
  // (see auth-provider). `isHr` still keys off the underlying record.
  const isEmployee = user?._type === 'employee';
  const isHr = isEmployee && !!(user as any)?.isHr;
  const isAccounts = isEmployee && !!(user as any)?.isAccounts;
  const isClient = user?._type === 'client';

  return (
    <Sheet open={isOpen} onOpenChange={(v) => !v && close()}>
      <SheetContent
        side="left"
        className="w-64 p-0 bg-sidebar text-sidebar-foreground border-sidebar-border [&>button]:hidden"
      >
        <VisuallyHidden><SheetTitle>Navigation</SheetTitle></VisuallyHidden>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-md shadow-indigo-500/30 overflow-hidden">
                <Image src="/ITSM_LOGO.png" alt="FlamX logo" width={32} height={32} unoptimized className="h-full w-full object-contain p-0.5" />
              </div>
              <div className="leading-tight">
                <p className="text-sm font-bold text-gray-900 dark:text-white tracking-wide">FlamX</p>
                {/* <p className="text-[10px] text-gray-500 dark:text-slate-400">Management System</p> */}
              </div>
            </div>
            <button onClick={close} className="text-gray-400 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <NavContent onNavigate={close} isEmployee={isEmployee} isHr={isHr} isAccounts={isAccounts} isClient={isClient} />
          <Footer isEmployee={isEmployee} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
