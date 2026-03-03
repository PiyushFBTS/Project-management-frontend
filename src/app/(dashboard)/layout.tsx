import { Sidebar, MobileSidebar } from '@/components/shared/sidebar';
import { Header } from '@/components/shared/header';
import { SidebarProvider } from '@/providers/sidebar-provider';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <Sidebar />
        {/* Mobile sidebar sheet */}
        <MobileSidebar />

        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          <Header />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
