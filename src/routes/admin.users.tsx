/**
 * Admin — User Management (Super Admin only).
 * List all users; change their roles via dropdown.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth, ROLE_LABELS, type AppRole } from "@/lib/auth";
import { adminListUsers, adminSetUserRole } from "@/server/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const ASSIGNABLE: AppRole[] = ["passenger", "support_admin", "booking_admin", "flight_admin", "super_admin"];

interface UserRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  roles: string[];
}

function AdminUsersPage() {
  const { isSuperAdmin, user } = useAuth();
  const list = useServerFn(adminListUsers);
  const setRole = useServerFn(adminSetUserRole);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await list();
      setUsers(res.users);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isSuperAdmin) void load(); }, [isSuperAdmin]);

  const handleChange = async (target: UserRow, role: AppRole) => {
    setSavingId(target.id);
    try {
      await setRole({ data: { targetUserId: target.id, role } });
      toast.success(`Updated ${target.email ?? "user"} to ${ROLE_LABELS[role]}`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      (u.email ?? "").toLowerCase().includes(term) ||
      (u.full_name ?? "").toLowerCase().includes(term),
    );
  }, [users, q]);

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-xl font-semibold">Super Admin only</h1>
        <p className="mt-1 text-sm text-muted-foreground">User management is restricted to super admins.</p>
      </div>
    );
  }

  const primaryRole = (roles: string[]): AppRole => {
    const order: AppRole[] = ["super_admin", "flight_admin", "booking_admin", "support_admin", "admin", "passenger"];
    return (order.find((r) => roles.includes(r)) ?? "passenger") as AppRole;
  };

  return (
    <div className="container mx-auto px-4 py-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">Assign and update user roles. Changes save instantly.</p>
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email…" className="w-full sm:w-72" />
      </div>

      <div className="mt-6 rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No users found.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Current role</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right w-56">Change role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => {
                const current = primaryRole(u.roles);
                const isSelf = u.id === user?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                    <TableCell className="text-sm">{u.email}{isSelf && <span className="ml-1 text-xs text-muted-foreground">(you)</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{ROLE_LABELS[current]}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Select
                        value={current}
                        onValueChange={(v) => handleChange(u, v as AppRole)}
                        disabled={savingId === u.id}
                      >
                        <SelectTrigger className="w-48 ml-auto">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE.map((r) => (
                            <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
