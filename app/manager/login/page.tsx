"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

function ManagerLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/audits/manager";
  const errorParam = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(errorParam === "CredentialsSignin" ? "Invalid email or password." : "");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password.");
        setLoading(false);
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#E8EDEE]/60">
      <Card className="w-full max-w-md border-[#005EB8]/20 shadow-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-[#005EB8]">Audit manager</CardTitle>
          <CardDescription>Sign in with your manager account (same access as organisation admin).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(error || errorParam) && (
              <Alert variant="destructive">
                <AlertDescription>
                  {error ||
                    (errorParam === "CredentialsSignin" ? "Invalid email or password." : "Sign-in failed. Try again.")}
                </AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label htmlFor="manager-email">Email</Label>
              <Input
                id="manager-email"
                type="email"
                placeholder="manager@fileycare.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="min-h-[48px] text-base"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manager-password">Password</Label>
              <Input
                id="manager-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="min-h-[48px] text-base"
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full min-h-[48px] text-base bg-[#005EB8] hover:bg-[#004a94]"
              size="lg"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
            <div className="flex flex-col gap-2 text-center text-sm">
              <Link href="/forgot-password" className="text-[#005EB8] hover:underline">
                Forgot password?
              </Link>
              <Link href="/login" className="text-muted-foreground hover:text-foreground hover:underline">
                Staff sign-in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ManagerLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center p-4">Loading…</div>}>
      <ManagerLoginForm />
    </Suspense>
  );
}
