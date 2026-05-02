/**
 * Admin sidebar — role-aware navigation.
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Plane, Ticket, Users } from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Roles allowed to see this section. Empty = any admin role. */
  allow: AppRole[];
}

const NAV: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, allow: [] },
  {
    to: "/admin/flights",
    label: "Flights",
    icon: Plane,
    allow: ["super_admin", "admin", "flight_admin"],
  },
  {
    to: "/admin/bookings",
    label: "Bookings",
    icon: Ticket,
    allow: ["super_admin", "admin", "booking_admin", "support_admin"],
  },
  {
    to: "/admin/users",
    label: "User Management",
    icon: Users,
    allow: ["super_admin"],
  },
];

export function AdminSidebar() {
  const { hasAnyRole, isAdmin } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="w-full md:w-60 md:min-h-[calc(100vh-4rem)] border-b md:border-b-0 md:border-r bg-card/50">
      <nav className="p-3 md:p-4 space-y-1">
        <p className="px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Admin
        </p>
        {NAV.filter((item) => item.allow.length === 0 ? isAdmin : hasAnyRole(item.allow)).map(
          (item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "hover:bg-muted text-foreground/80 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          },
        )}
      </nav>
    </aside>
  );
}
