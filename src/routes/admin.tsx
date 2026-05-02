/**
 * Admin layout — sidebar + outlet, gated by any admin role.
 */
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({
    meta: [
      { title: "Admin — Gwinport" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();

  if (loading) {
    return <Shell><p className="text-muted-foreground">Loading…</p></Shell>;
  }
  if (!user) {
    return (
      <Shell>
        <Gate icon={<Shield className="h-10 w-10 text-muted-foreground" />} title="Sign in required" desc="Please sign in to access the admin area.">
          <Link to="/login"><Button>Sign in</Button></Link>
        </Gate>
      </Shell>
    );
  }
  if (!isAdmin) {
    return (
      <Shell>
        <Gate icon={<Shield className="h-10 w-10 text-destructive" />} title="Access denied" desc="You need an admin role to view this page.">
          <Link to="/flights"><Button variant="outline">Back to flights</Button></Link>
        </Gate>
      </Shell>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <div className="flex-1 flex flex-col md:flex-row">
        <AdminSidebar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 grid place-items-center px-4 text-center">{children}</main>
    </div>
  );
}

function Gate({ icon, title, desc, children }: { icon: React.ReactNode; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mx-auto w-fit">{icon}</div>
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}
