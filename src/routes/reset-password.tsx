/**
 * Reset password — user lands here from the email recovery link.
 * Supabase parses the recovery token from the URL hash and creates a
 * temporary session, allowing us to call updateUser({ password }).
 */
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset password — Gwinport" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const schema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [validLink, setValidLink] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when it picks up the recovery hash.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setValidLink(true);
      }
    });
    // Fallback: if there's already a session (link processed), allow update.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setValidLink(true);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid password");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gradient-sky)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Set a new password</h1>
            <p className="mt-1 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
          </div>

          {!ready ? (
            <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : !validLink ? (
            <div className="rounded-xl border bg-card p-6 text-center space-y-3">
              <p className="text-sm">This reset link is invalid or has expired.</p>
              <Link to="/forgot-password" className="inline-block text-sm font-medium text-primary hover:underline">Request a new link</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input id="password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input id="confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
