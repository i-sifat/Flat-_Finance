import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { ArrowRight, Sparkles, ShieldCheck, Loader2, KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — FlatFinance" },
      { name: "description", content: "Sign in or create your FlatFinance account." },
    ],
  }),
  component: AuthPage,
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name").max(60),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?880|0)?1[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile number"),
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{8}$/u, "Code must be 8 characters")
    .optional()
    .or(z.literal("")),
});
type SignupValues = z.infer<typeof signupSchema>;

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
});
type LoginValues = z.infer<typeof loginSchema>;

function AuthPage() {
  const navigate = useNavigate();
  const beginAuth = useFlatFinanceStore((s) => s.beginAuth);
  const pendingAuth = useFlatFinanceStore((s) => s.pendingAuth);
  const loadDemoAccount = useFlatFinanceStore((s) => s.loadDemoAccount);
  const [submitting, setSubmitting] = useState<"login" | "signup" | null>(null);

  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", phone: "", inviteCode: "" },
  });
  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "" },
  });

  const onSignup = async (values: SignupValues) => {
    setSubmitting("signup");
    await new Promise((r) => setTimeout(r, 600));
    beginAuth({
      mode: "signup",
      name: values.name,
      email: values.email,
      phone: values.phone,
      inviteCode: values.inviteCode || undefined,
    });
    toast.success("Verification code sent", { description: `We sent a 6-digit code to ${values.email}` });
    setSubmitting(null);
  };

  const onLogin = async (values: LoginValues) => {
    setSubmitting("login");
    await new Promise((r) => setTimeout(r, 600));
    beginAuth({ mode: "login", email: values.email, phone: "" });
    toast.success("Code sent", { description: `Check ${values.email} for your 6-digit code.` });
    setSubmitting(null);
  };

  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
        {/* hero */}
        <section className="relative hidden flex-col justify-between overflow-hidden p-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">FlatFinance</p>
              <p className="text-xs text-muted-foreground">by AC_PC Team</p>
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              Shared flat finances,
              <br />
              <span className="bg-gradient-to-r from-[color:var(--color-primary)] to-sky-300 bg-clip-text text-transparent">
                settled in ৳ Taka.
              </span>
            </h1>
            <p className="max-w-md text-sm text-muted-foreground">
              Split groceries, log meals, lend a few thousand to a flatmate, and close
              the month with one tap. Built for Bangladeshi flats.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              {["Expense splits", "Meal-rate settlement", "Peer loans", "QR invites"].map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-[color:var(--color-surface)] px-3 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Demo build · all data stays on this device.
          </p>

          {/* decorative orb */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-32 -right-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(circle, oklch(0.66 0.22 287 / 0.6), transparent 60%)" }}
          />
        </section>

        {/* form column */}
        <section className="flex items-center justify-center px-4 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <AnimatePresence mode="wait">
              {pendingAuth ? (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  <OtpStep />
                </motion.div>
              ) : (
                <motion.div
                  key="form"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                  className="card-elevated p-7 sm:p-8"
                >
                  <div className="mb-6 flex items-center gap-3 lg:hidden">
                    <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">FlatFinance</p>
                      <p className="text-xs text-muted-foreground">by AC_PC Team</p>
                    </div>
                  </div>

                  <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sign in to your flat or create a new account.
                  </p>

                  <Tabs defaultValue="signin" className="mt-6">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="signin">Sign in</TabsTrigger>
                      <TabsTrigger value="signup">Sign up</TabsTrigger>
                    </TabsList>

                    <TabsContent value="signin" className="mt-5 space-y-4">
                      <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4" noValidate>
                        <Field label="Email" htmlFor="login-email" error={loginForm.formState.errors.email?.message}>
                          <Input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@flat.bd"
                            {...loginForm.register("email")}
                          />
                        </Field>
                        <Button
                          type="submit"
                          variant="default"
                          className="h-11 w-full gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
                          disabled={submitting === "login"}
                        >
                          {submitting === "login" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Send verification code
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-11 w-full"
                          onClick={() => {
                            const member = loadDemoAccount();
                            toast.success(`Welcome, ${member.name.split(" ")[0]}!`, {
                              description: "Signed in with the demo account.",
                            });
                            navigate({ to: "/app", replace: true });
                          }}
                        >
                          Try the demo account
                        </Button>
                      </form>
                    </TabsContent>

                    <TabsContent value="signup" className="mt-5">
                      <form onSubmit={signupForm.handleSubmit(onSignup)} className="space-y-4" noValidate>
                        <Field label="Full name" htmlFor="su-name" error={signupForm.formState.errors.name?.message}>
                          <Input id="su-name" autoComplete="name" placeholder="Your name" {...signupForm.register("name")} />
                        </Field>
                        <Field label="Email" htmlFor="su-email" error={signupForm.formState.errors.email?.message}>
                          <Input
                            id="su-email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@flat.bd"
                            {...signupForm.register("email")}
                          />
                        </Field>
                        <Field label="Mobile" htmlFor="su-phone" error={signupForm.formState.errors.phone?.message}>
                          <Input
                            id="su-phone"
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            placeholder="01XXXXXXXXX"
                            {...signupForm.register("phone")}
                          />
                        </Field>
                        <Field
                          label="Invite code (optional)"
                          htmlFor="su-invite"
                          hint="Paste the 8-character code your admin shared."
                          error={signupForm.formState.errors.inviteCode?.message}
                        >
                          <Input
                            id="su-invite"
                            placeholder="ABCD2345"
                            maxLength={8}
                            className="font-mono uppercase tracking-widest"
                            {...signupForm.register("inviteCode")}
                          />
                        </Field>
                        <Button
                          type="submit"
                          className="h-11 w-full gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
                          disabled={submitting === "signup"}
                        >
                          {submitting === "signup" ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Create account
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </form>
                    </TabsContent>
                  </Tabs>

                  <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Demo OTP — any 6 digits will verify.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Don't have a flat yet?{" "}
              <Link to="/auth" className="text-foreground underline-offset-4 hover:underline">
                Sign up to create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-[color:var(--color-destructive)]"
        >
          {error}
        </motion.p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function OtpStep() {
  const navigate = useNavigate();
  const pending = useFlatFinanceStore((s) => s.pendingAuth);
  const verify = useFlatFinanceStore((s) => s.verifyOtpAndCommit);
  const clearPending = useFlatFinanceStore((s) => s.clearPendingAuth);
  const beginAuth = useFlatFinanceStore((s) => s.beginAuth);
  const flat = useFlatFinanceStore((s) => s.flat);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [noAccountFound, setNoAccountFound] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length < 4) {
      setError("Enter the 6-digit code");
      return;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 500));
    const member = verify(code);
    setVerifying(false);
    if (member) {
      toast.success(`Welcome, ${member.name.split(" ")[0]}!`);
      navigate({ to: flat ? "/app" : "/onboarding", replace: true });
      return;
    }
    if (pending?.mode === "login") {
      setNoAccountFound(true);
      setError("No account found for that email. Try signing up instead.");
      return;
    }
    if (pending?.mode === "signup" && !flat) {
      // first user with no flat → go to onboarding to create
      navigate({ to: "/onboarding", replace: true });
      return;
    }
    toast.success("Join request sent", {
      description: "An admin will review your request shortly.",
    });
    clearPending();
    setCode("");
    setError("Request submitted. You'll be notified once approved.");
  };

  return (
    <div className="card-elevated p-7 sm:p-8">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--color-accent)] text-[color:var(--color-primary)]">
        <KeyRound className="h-5 w-5" />
      </div>
      <h2 className="mt-5 text-2xl font-semibold tracking-tight">Verify it's you</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We sent a 6-digit code to {pending?.email ?? "your email"}. Demo OTP — any digits will work.
      </p>

      <div className="mt-6 flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={(v) => {
            setCode(v);
            setError(null);
            setNoAccountFound(false);
          }}
        >
          <InputOTPGroup>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <InputOTPSlot key={i} index={i} className="h-12 w-12 text-lg" />
            ))}
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center"
        >
          <p className="animate-shake text-xs text-[color:var(--color-destructive)]">{error}</p>
          {pending?.mode === "login" && noAccountFound ? (
            <button
              type="button"
              onClick={() => {
                if (!pending) return;
                beginAuth({ mode: "signup", email: pending.email, phone: "", name: "" });
                setCode("");
                setError(null);
                setNoAccountFound(false);
              }}
              className="mt-2 text-xs font-medium text-[color:var(--color-primary)] hover:underline"
            >
              No account yet — sign up with this email
            </button>
          ) : null}
        </motion.div>
      ) : null}

      <Button
        onClick={handleVerify}
        disabled={verifying}
        className="mt-6 h-11 w-full gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
      >
        {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
      </Button>

      <button
        type="button"
        onClick={() => {
          clearPending();
          setCode("");
          setError(null);
          setNoAccountFound(false);
        }}
        className="mt-4 w-full text-center text-xs text-muted-foreground hover:text-foreground"
      >
        Use a different email
      </button>
    </div>
  );
}
