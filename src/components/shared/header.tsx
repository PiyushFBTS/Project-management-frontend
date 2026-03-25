/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useAuth } from '@/providers/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
import { LogOut, User, Menu, ChevronDown, Search, Building2 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { CompanySelector } from './company-selector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSidebar } from '@/providers/sidebar-provider';
import { useCompany } from '@/providers/company-provider';
import { NotificationBell } from './notification-bell';
import { useState } from 'react';

const pageTitles: Record<string, string> = {
  '/dashboard':             'Dashboard',
  '/companies':             'Companies',
  '/projects':              'Projects',
  '/task-types':            'Task Types',
  '/employees':             'Employees',
  '/task-sheets':           'Task Sheets',
  '/leave-types':           'Leave Types',
  '/leave-requests':        'Leave Requests',
  '/task-sheets/fill':      'Fill Task Sheet',
  '/reports/employee-wise': 'Employee-Wise Report',
  '/reports/project-wise':  'Project-Wise Report',
  '/reports/daily-fill':    'Daily Fill Report',
  '/profile':               'My Profile',
  '/settings':              'Settings',
  '/my-tasks':              'My Tasks',
};

const pageParents: Record<string, string> = {
  '/reports/employee-wise': 'Reports',
  '/reports/project-wise':  'Reports',
  '/reports/daily-fill':    'Reports',
};

export function Header() {
  const { user, logout } = useAuth();
  const { toggle } = useSidebar();
  const { selectedCompany, isSuperAdmin } = useCompany();
  const router = useRouter();
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') ?? 'http://localhost:3001';

  const handleLogout = () => { logout(); router.push('/login'); };

  // Determine company logo: super admin → selected company, others → their own company
  const logoUrl = isSuperAdmin
    ? selectedCompany?.logoUrl
    : (user as any)?.companyLogoUrl;
  const logoName = isSuperAdmin
    ? selectedCompany?.name
    : (user as any)?.companyName;

  const displayName = user
    ? user._type === 'employee' ? (user as any).empName : user._type === 'client' ? (user as any).fullName : (user as any).name
    : '';

  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const title = Object.entries(pageTitles).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1] ?? 'Portal';

  const parent = Object.entries(pageParents).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1];

  const roleLabel = user?._type === 'employee'
    ? 'Employee'
    : (user as { role?: string })?.role === 'super_admin' ? 'Super Admin' : 'Admin';

  return (
    <header className="relative flex h-14 items-center justify-between border-b border-border/60 bg-card/80 backdrop-blur-md px-4 sm:px-6">
      {/* Gradient bottom accent line */}
      <div className="absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-indigo-500/50 to-transparent" />

      {/* Left: hamburger (mobile) + breadcrumb / page title */}
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 lg:hidden text-muted-foreground hover:text-foreground hover:bg-accent/80"
          onClick={toggle}
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="flex items-center gap-2 min-w-0">
          {/* Company logo: own company for admin/employee, selected company for super admin */}
          {logoUrl && (
            <>
              <img src={`${apiBase}${logoUrl}`} alt={logoName ?? ''} className="h-7 w-7 rounded-md object-cover ring-1 ring-border/50 shrink-0" />
              <div className="h-4 w-px bg-border/60 shrink-0" />
            </>
          )}
          {parent && (
            <>
              <span className="hidden text-xs font-medium text-muted-foreground sm:block">{parent}</span>
              <span className="hidden text-muted-foreground/40 sm:block">/</span>
            </>
          )}
          <h1 className="text-sm font-semibold text-foreground truncate">{title}</h1>
          <Badge
            variant="outline"
            className="hidden text-[10px] font-medium sm:inline-flex bg-primary/8 text-primary border-primary/20"
          >
            {roleLabel}
          </Badge>
        </div>

        <CompanySelector />
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1.5">

        <ThemeToggle />

        <NotificationBell />

        {/* Divider */}
        <div className="h-5 w-px bg-border/60" />

        {/* User profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1.5 transition-colors hover:bg-accent/80 outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <Avatar className="h-7 w-7 ring-2 ring-primary/20">
                <AvatarFallback className="bg-linear-to-br from-indigo-500 to-violet-600 text-white text-[11px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:flex items-center gap-1">
                <span className="text-sm font-medium text-foreground max-w-28 truncate">{displayName}</span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-52">
            <DropdownMenuLabel className="pb-2">
              <div className="flex items-center gap-2.5">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-linear-to-br from-indigo-500 to-violet-600 text-white text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-[11px] font-normal text-muted-foreground truncate">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer gap-2 py-2">
              <Link href="/profile">
                <User className="h-4 w-4 text-indigo-500" /> My Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 py-2 text-destructive focus:text-destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
