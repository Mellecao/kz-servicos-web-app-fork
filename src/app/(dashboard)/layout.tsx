import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="min-h-screen bg-background">
          <MobileHeader />
          <Sidebar />
          <div className="pl-0 md:pl-64">
            <main className="p-4 md:p-8 pb-24 md:pb-8">{children}</main>
          </div>
          <MobileNav />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
