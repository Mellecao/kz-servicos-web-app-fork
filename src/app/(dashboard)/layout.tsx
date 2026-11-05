import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";
import OneSignalInitializer from "@/components/OneSignalInitializer";
import AdminNotificationsButton from "@/components/AdminNotificationsButton";
import MobilePushPermissionGuide from "@/components/MobilePushPermissionGuide";
import RequireAuth from "@/components/RequireAuth";
import TripsOnlyGate from "@/components/TripsOnlyGate";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";
import { TripsEnabledProvider } from "@/lib/trips-enabled-context";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthProvider>
      <ToastProvider>
        <TripsEnabledProvider>
        <RequireAuth>
          <OneSignalInitializer />
          <AdminNotificationsButton />
          <MobilePushPermissionGuide />
          <div className="min-h-screen bg-background">
            <MobileHeader />
            <Sidebar />
            <div className="min-w-0 pl-0 md:pl-64">
              <main className="min-w-0 overflow-x-clip p-4 md:p-8 pb-24 md:pb-8"><TripsOnlyGate>{children}</TripsOnlyGate></main>
            </div>
            <MobileNav />
          </div>
        </RequireAuth>
        </TripsEnabledProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
