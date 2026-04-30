/**
 * Admin landing — F14/F15 (manage flights, reports) will be implemented in the next iteration.
 * Access is restricted to users with the admin role (F2).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — Gwinport" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AdminPage() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 grid place-items-center"><p className="text-muted-foreground">Loading…</p></main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 grid place-items-center px-4 text-center">
          <div>
            <Shield className="h-10 w-10 mx-auto text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Sign in required</h1>
            <p className="mt-1 text-sm text-muted-foreground">Please sign in to access the admin area.</p>
            <Link to="/login" className="inline-block mt-4"><Button>Sign in</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <SiteHeader />
        <main className="flex-1 grid place-items-center px-4 text-center">
          <div>
            <Shield className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
            <p className="mt-1 text-sm text-muted-foreground">You need an admin role to view this page.</p>
            <Link to="/flights" className="inline-block mt-4"><Button variant="outline">Back to flights</Button></Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold">Admin dashboard</h1>
        <p className="mt-2 text-muted-foreground">Manage flights and view reports.</p>
        <div className="mt-8 rounded-xl border bg-card p-8 text-center text-muted-foreground">
          <p>Flight management (F14) and reporting (F15) come in the next iteration.</p>
        </div>
      </main>
    </div>
  );
}
