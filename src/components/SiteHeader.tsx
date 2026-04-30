/**
 * Shared site header — nav, brand, auth actions.
 */
import { Link, useNavigate } from "@tanstack/react-router";
import { Plane, LogOut, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export function SiteHeader() {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  return (
    <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-40">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--gradient-sky)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Plane className="h-5 w-5" />
          </span>
          <span>Gwinport</span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link to="/flights">
            <Button variant="ghost" size="sm">Flights</Button>
          </Link>
          {user && role === "admin" && (
            <Link to="/admin">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Shield className="h-4 w-4" />
                Admin
              </Button>
            </Link>
          )}
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-muted-foreground px-2">
                {user.email}
              </span>
              <Button variant="outline" size="sm" onClick={handleSignOut} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/register">
                <Button size="sm">Get started</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
