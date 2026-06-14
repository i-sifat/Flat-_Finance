import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Users, Plus, Loader2, ShieldCheck, UserMinus, UserCheck } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { MemberAvatar } from "@/components/app/MemberAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { selectCurrentMember, selectIsAdmin, useFlatFinanceStore } from "@/store/useFlatFinanceStore";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/app/members")({
  ssr: false,
  head: () => ({ meta: [{ title: "Members — FlatFinance" }] }),
  component: MembersPage,
});

const schema = z.object({
  name: z.string().trim().min(2).max(60),
  email: z.string().trim().toLowerCase().email().max(120),
  phone: z.string().trim().regex(/^(\+?880|0)?1[3-9]\d{8}$/, "Enter a valid mobile"),
  paymentMethod: z.string().min(1),
});
type Values = z.infer<typeof schema>;

function MembersPage() {
  const me = useFlatFinanceStore(selectCurrentMember);
  const isAdmin = useFlatFinanceStore(selectIsAdmin);
  const members = useFlatFinanceStore((s) => s.members);
  const requests = useFlatFinanceStore((s) => s.joinRequests);
  const add = useFlatFinanceStore((s) => s.addMember);
  const setStatus = useFlatFinanceStore((s) => s.setMemberStatus);
  const promote = useFlatFinanceStore((s) => s.promoteMember);
  const demote = useFlatFinanceStore((s) => s.demoteMember);
  const approveReq = useFlatFinanceStore((s) => s.approveJoinRequest);
  const rejectReq = useFlatFinanceStore((s) => s.rejectJoinRequest);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", phone: "", paymentMethod: "bKash" },
  });

  const onSubmit = async (v: Values) => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 300));
    add({ ...v, role: "member" });
    setBusy(false);
    setOpen(false);
    toast.success(`${v.name} added`);
    form.reset();
  };

  const pendingRequests = requests.filter((r) => r.status === "pending");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Members"
        description="Flatmates, admins, and pending join requests."
        actions={
          isAdmin ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary text-primary-foreground hover:brightness-110">
                  <Plus className="mr-1.5 h-4 w-4" /> Add member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add a flatmate</DialogTitle></DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5"><Label>Name</Label><Input {...form.register("name")} /></div>
                  <div className="space-y-1.5"><Label>Email</Label><Input type="email" {...form.register("email")} /></div>
                  <div className="space-y-1.5"><Label>Mobile</Label><Input type="tel" {...form.register("phone")} /></div>
                  <div className="space-y-1.5"><Label>Preferred payment</Label><Input {...form.register("paymentMethod")} /></div>
                  <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={busy} className="gradient-primary text-primary-foreground">
                      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {pendingRequests.length > 0 && isAdmin ? (
        <section>
          <h2 className="mb-3 text-base font-semibold">Pending join requests</h2>
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {pendingRequests.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[color:var(--color-accent)] font-semibold">
                  {r.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{r.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.email} · {formatDateShort(r.createdAt)}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => { rejectReq(r.id); toast.success("Request declined"); }}>Decline</Button>
                <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => { approveReq(r.id); toast.success(`${r.name} approved`); }}>Approve</Button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {members.length === 0 ? (
        <EmptyState icon={<Users className="h-5 w-5" />} title="No members yet" />
      ) : (
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {members.map((m) => (
            <div key={m.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr,auto] sm:items-center">
              <div className="flex items-center gap-3">
                <MemberAvatar member={m} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {m.name}
                    {m.id === me?.id ? <span className="ml-1 text-xs text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{m.email} · {m.phone}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={m.role === "admin" ? "default" : "secondary"} className="text-[10px] capitalize">
                  {m.role === "admin" ? <ShieldCheck className="mr-1 h-3 w-3" /> : null}{m.role}
                </Badge>
                <Badge
                  variant="secondary"
                  className={`text-[10px] capitalize ${m.status === "suspended" ? "bg-[color:var(--color-warning)]/20 text-[color:var(--color-warning)]" : m.status === "left" ? "opacity-60" : ""}`}
                >
                  {m.status}
                </Badge>
                {isAdmin && m.id !== me?.id ? (
                  <>
                    {m.role === "member"
                      ? <Button size="sm" variant="ghost" onClick={() => { promote(m.id); toast.success(`${m.name} is now admin`); }}>Make admin</Button>
                      : <Button size="sm" variant="ghost" onClick={() => { demote(m.id); toast.success(`${m.name} demoted`); }}>Demote</Button>}
                    {m.status === "active" ? (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setStatus(m.id, "suspended"); toast.success(`${m.name} suspended`); }}>
                          <UserMinus className="mr-1 h-3.5 w-3.5" /> Suspend
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setStatus(m.id, "left"); toast.success(`${m.name} marked as left — pro-rating applied`); }}>
                          <UserMinus className="mr-1 h-3.5 w-3.5" /> Mark left
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { setStatus(m.id, "active"); toast.success(`${m.name} reinstated`); }}>
                        <UserCheck className="mr-1 h-3.5 w-3.5" /> Reinstate
                      </Button>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
