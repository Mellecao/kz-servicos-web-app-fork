import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import OneSignalInitializer from "@/components/OneSignalInitializer";
import AdminNotificationsButton from "@/components/AdminNotificationsButton";
import MobilePushPermissionGuide from "@/components/MobilePushPermissionGuide";
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
        <OneSignalInitializer />
        <AdminNotificationsButton />
        <MobilePushPermissionGuide />
        <div className="min-h-screen bg-background">
          <MobileHeader />
          <Sidebar />
          <div className="min-w-0 pl-0 md:pl-64">
            <main className="min-w-0 overflow-x-clip p-4 md:p-8 pb-24 md:pb-8">{children}</main>
          </div>
          <MobileNav />
        </div>
      </ToastProvider>
    </AuthProvider>
  );
}
