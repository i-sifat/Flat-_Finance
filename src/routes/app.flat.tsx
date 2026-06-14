import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Copy, QrCode, Plus, Trash2, Loader2, Home } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  selectCurrentMember, selectIsAdmin, useFlatFinanceStore,
} from "@/store/useFlatFinanceStore";
import { formatDateShort } from "@/lib/format";

export const Route = createFileRoute("/app/flat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Flat settings — FlatFinance" }] }),
  component: FlatPage,
});

function FlatPage() {
  const flat = useFlatFinanceStore((s) => s.flat);
  const isAdmin = useFlatFinanceStore(selectIsAdmin);
  const me = useFlatFinanceStore(selectCurrentMember);
  const invites = useFlatFinanceStore((s) => s.invites);
  const createInvite = useFlatFinanceStore((s) => s.createInvite);
  const revokeInvite = useFlatFinanceStore((s) => s.revokeInvite);
  const updateFlat = useFlatFinanceStore((s) => s.updateFlat);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState(flat?.name ?? "");
  const [address, setAddress] = useState(flat?.address ?? "");

  if (!flat) return null;

  const saveFlat = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 250));
    updateFlat({ name, address });
    setBusy(false);
    toast.success("Flat updated");
  };

  const newInvite = () => {
    if (!me) return;
    const inv = createInvite({ createdBy: me.id });
    toast.success("Invite created", { description: `Code: ${inv.code}` });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Flat settings" description="Manage flat details and invitations." />

      <section className="card-elevated p-6">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--color-accent)]">
            <Home className="h-5 w-5" />
          </div>
          <p className="text-sm font-semibold">Flat profile</p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} /></div>
          <div className="space-y-1.5"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isAdmin} /></div>
        </div>
        {isAdmin ? (
          <div className="mt-4 flex justify-end">
            <Button onClick={saveFlat} disabled={busy} className="gradient-primary text-primary-foreground">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-muted-foreground">Created {formatDateShort(flat.createdAt)}</p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">Invitations</h2>
          {isAdmin ? (
            <Button onClick={newInvite} className="gradient-primary text-primary-foreground hover:brightness-110">
              <Plus className="mr-1.5 h-4 w-4" /> New invite
            </Button>
          ) : null}
        </div>
        {invites.length === 0 ? (
          <EmptyState icon={<QrCode className="h-5 w-5" />} title="No invites yet" description="Generate a code or QR to share with flatmates." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {invites.map((inv) => (
              <InviteCard key={inv.id} code={inv.code} status={inv.status} createdAt={inv.createdAt} canRevoke={isAdmin} onRevoke={() => { revokeInvite(inv.id); toast.success("Invite revoked"); }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function InviteCard({ code, status, createdAt, canRevoke, onRevoke }: {
  code: string; status: string; createdAt: string; canRevoke: boolean; onRevoke: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card-elevated p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-lg font-semibold tracking-widest">{code}</p>
          <p className="text-xs text-muted-foreground">Created {formatDateShort(createdAt)}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] capitalize">{status}</Badge>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="secondary" onClick={() => { navigator.clipboard.writeText(code).catch(() => {}); toast.success("Copied to clipboard"); }}>
          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="secondary"><QrCode className="mr-1.5 h-3.5 w-3.5" /> Show QR</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Invite QR</DialogTitle></DialogHeader>
            <QrPanel value={code} />
          </DialogContent>
        </Dialog>
        {canRevoke && status === "pending" ? (
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onRevoke}>
            <Trash2 className="h-3.5 w-3.5 text-[color:var(--color-destructive)]" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function QrPanel({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, value, { width: 256, margin: 2, color: { dark: "#0B1221", light: "#E8ECF4" } }).catch(() => {});
  }, [value]);
  return (
    <div className="flex flex-col items-center gap-3 p-2">
      <div className="rounded-2xl bg-[color:var(--color-foreground)] p-3"><canvas ref={canvasRef} /></div>
      <p className="font-mono text-base tracking-widest">{value}</p>
      <p className="text-xs text-muted-foreground">Scan or enter the code to join the flat.</p>
    </div>
  );
}
