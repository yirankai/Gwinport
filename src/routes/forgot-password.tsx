/**
 * Forgot password — sends a reset link via Supabase.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteHeader } from "@/components/SiteHeader";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({
    meta: [
      { title: "Forgot password — Gwinport" },
      { name: "description", content: "Reset your Gwinport account password." },
    ],
  }),
});

const schema = z.object({ email: z.string().trim().email("Enter a valid email").max(255) });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent. Check your inbox.");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--gradient-sky)] text-primary-foreground shadow-[var(--shadow-elegant)]">
              <KeyRound className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-2xl font-bold">Forgot your password?</h1>
            <p className="mt-1 text-sm text-muted-foreground">We'll email you a link to reset it.</p>
          </div>
          {sent ? (
            <div className="rounded-xl border bg-card p-6 shadow-[var(--shadow-card)] text-center space-y-3">
              <p className="text-sm">If an account exists for <span className="font-medium">{email}</span>, a reset link is on its way.</p>
              <p className="text-xs text-muted-foreground">Don't forget to check your spam folder.</p>
              <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border bg-card p-6 shadow-[var(--shadow-card)]">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Sending…" : "Send reset link"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Remembered it?{" "}
                <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
