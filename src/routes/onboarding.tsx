import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Home, Users, Loader2, ArrowRight, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useFlatFinanceStore } from "@/store/useFlatFinanceStore";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Set up your flat — FlatFinance" }],
  }),
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("flatfinance:v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { state?: { flat?: unknown; currentMemberId?: string | null } };
        if (parsed.state?.flat && parsed.state?.currentMemberId) {
          throw redirect({ to: "/app" });
        }
      }
    } catch (err) {
      if (err && typeof err === "object" && "to" in err) throw err;
    }
  },
  component: OnboardingPage,
});

const createFlatSchema = z.object({
  flatName: z.string().trim().min(2, "Flat needs a name").max(60),
  address: z.string().trim().min(4, "Add a short address").max(160),
  ownerName: z.string().trim().min(2, "Your name please").max(60),
  ownerEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(120),
  ownerPhone: z
    .string()
    .trim()
    .regex(/^(\+?880|0)?1[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile"),
});
type CreateFlatValues = z.infer<typeof createFlatSchema>;

const joinSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z2-9]{8}$/, "Code must be 8 characters"),
});
type JoinValues = z.infer<typeof joinSchema>;

const requestSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z.string().trim().regex(/^(\+?880|0)?1[3-9]\d{8}$/, "Enter a valid Bangladeshi mobile"),
  note: z.string().trim().max(200).optional(),
});
type RequestValues = z.infer<typeof requestSchema>;

function OnboardingPage() {
  const navigate = useNavigate();
  const createFlat = useFlatFinanceStore((s) => s.createFlat);
  const acceptInvite = useFlatFinanceStore((s) => s.acceptInviteByCode);
  const beginAuth = useFlatFinanceStore((s) => s.beginAuth);
  const createJoinRequest = useFlatFinanceStore((s) => s.createJoinRequest);
  const pending = useFlatFinanceStore((s) => s.pendingAuth);
  const existingFlat = useFlatFinanceStore((s) => s.flat);
  const [busy, setBusy] = useState(false);

  const createForm = useForm<CreateFlatValues>({
    resolver: zodResolver(createFlatSchema),
    defaultValues: {
      flatName: "",
      address: "",
      ownerName: pending?.name ?? "",
      ownerEmail: pending?.email ?? "",
      ownerPhone: pending?.phone ?? "",
    },
  });
  const joinForm = useForm<JoinValues>({ resolver: zodResolver(joinSchema), defaultValues: { code: "" } });
  const requestForm = useForm<RequestValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      name: pending?.name ?? "",
      email: pending?.email ?? "",
      phone: pending?.phone ?? "",
      note: "",
    },
  });

  useEffect(() => {
    if (!pending && !existingFlat) {
      navigate({ to: "/auth", replace: true });
    }
  }, [pending, existingFlat, navigate]);

  const onCreate = async (v: CreateFlatValues) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    createFlat({
      name: v.flatName,
      address: v.address,
      ownerName: v.ownerName,
      ownerEmail: v.ownerEmail,
      ownerPhone: v.ownerPhone,
    });
    toast.success(`Flat "${v.flatName}" created`, { description: "You're set up as admin." });
    setBusy(false);
    navigate({ to: "/app", replace: true });
  };

  const onJoin = async (v: JoinValues) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    const ok = acceptInvite(v.code);
    setBusy(false);
    if (!ok) {
      toast.error("Invite code not recognised", { description: "Check the code or request to join instead." });
      return;
    }
    // queue signup with the verified invite and send back through OTP
    beginAuth({
      mode: "signup",
      name: pending?.name ?? "",
      email: pending?.email ?? "",
      phone: pending?.phone ?? "",
      inviteCode: v.code,
    });
    toast.success("Invite accepted", { description: "Verify your code to finish joining." });
    navigate({ to: "/auth" });
  };

  const onRequest = async (v: RequestValues) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 400));
    createJoinRequest({ name: v.name, email: v.email, phone: v.phone });
    setBusy(false);
    toast.success("Request sent", {
      description: "An admin will review your request and notify you.",
    });
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Step 1 of 1</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Set up your flat</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Create a brand-new flat or join one with an invite code.
          </p>

          <div className="card-elevated mt-8 p-6 sm:p-8">
            <Tabs defaultValue="create">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="create">
                  <Home className="mr-2 h-4 w-4" />
                  Create
                </TabsTrigger>
                <TabsTrigger value="join">
                  <QrCode className="mr-2 h-4 w-4" />
                  Join with code
                </TabsTrigger>
                <TabsTrigger value="request">
                  <Users className="mr-2 h-4 w-4" />
                  Request to join
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-6">
                <form onSubmit={createForm.handleSubmit(onCreate)} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField label="Flat name" error={createForm.formState.errors.flatName?.message}>
                      <Input placeholder="Sunrise Bachelor Flat" {...createForm.register("flatName")} />
                    </FormField>
                    <FormField label="Address" error={createForm.formState.errors.address?.message}>
                      <Input placeholder="House 42, Road 7, Dhanmondi, Dhaka" {...createForm.register("address")} />
                    </FormField>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField label="Your name" error={createForm.formState.errors.ownerName?.message}>
                      <Input autoComplete="name" {...createForm.register("ownerName")} />
                    </FormField>
                    <FormField label="Email" error={createForm.formState.errors.ownerEmail?.message}>
                      <Input type="email" autoComplete="email" {...createForm.register("ownerEmail")} />
                    </FormField>
                    <FormField label="Mobile" error={createForm.formState.errors.ownerPhone?.message}>
                      <Input type="tel" autoComplete="tel" {...createForm.register("ownerPhone")} />
                    </FormField>
                  </div>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="h-11 gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <>
                        Create flat
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <form onSubmit={joinForm.handleSubmit(onJoin)} className="space-y-4" noValidate>
                  <FormField
                    label="Invite code"
                    hint="Ask your flat admin to share the 8-character code or QR."
                    error={joinForm.formState.errors.code?.message}
                  >
                    <Input
                      maxLength={8}
                      placeholder="ABCD2345"
                      className="h-12 text-center font-mono text-xl uppercase tracking-[0.4em]"
                      {...joinForm.register("code")}
                    />
                  </FormField>
                  <Button
                    type="submit"
                    disabled={busy}
                    className="h-11 gradient-primary text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-110"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Accept invite"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="request" className="mt-6">
                <form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-4" noValidate>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <FormField label="Name" error={requestForm.formState.errors.name?.message}>
                      <Input {...requestForm.register("name")} />
                    </FormField>
                    <FormField label="Email" error={requestForm.formState.errors.email?.message}>
                      <Input type="email" {...requestForm.register("email")} />
                    </FormField>
                    <FormField label="Mobile" error={requestForm.formState.errors.phone?.message}>
                      <Input type="tel" {...requestForm.register("phone")} />
                    </FormField>
                  </div>
                  <FormField label="Message (optional)">
                    <Textarea rows={3} placeholder="Hi! I'm Rashik's new flatmate." {...requestForm.register("note")} />
                  </FormField>
                  <Button type="submit" disabled={busy} variant="secondary" className="h-11">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send request"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-[color:var(--color-destructive)]">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
