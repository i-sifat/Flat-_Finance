import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Receipt,
  UtensilsCrossed,
  HandCoins,
  Scale,
  Package,
  Users,
  Home,
  BarChart3,
  History,
  Bell,
  LogOut,
  Menu,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { MemberAvatar } from "./MemberAvatar";
import {
  selectCurrentMember,
  selectUnreadCount,
  useFlatFinanceStore,
} from "@/store/useFlatFinanceStore";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/expenses", label: "Expenses", icon: Receipt },
  { to: "/app/meals", label: "Meals", icon: UtensilsCrossed },
  { to: "/app/loans", label: "Loans", icon: HandCoins },
  { to: "/app/settlement", label: "Settlement", icon: Scale },
  { to: "/app/inventory", label: "Inventory", icon: Package },
  { to: "/app/members", label: "Members", icon: Users },
  { to: "/app/flat", label: "Flat", icon: Home, adminOnly: true },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/activity", label: "Activity", icon: History },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/app", label: "Home", icon: LayoutDashboard },
  { to: "/app/expenses", label: "Expenses", icon: Receipt },
  { to: "/app/meals", label: "Meals", icon: UtensilsCrossed },
  { to: "/app/settlement", label: "Settle", icon: Scale },
  { to: "/app/members", label: "More", icon: Users },
];

export function AppShell({ children }: { children: ReactNode }) {
  const me = useFlatFinanceStore(selectCurrentMember);
  const flat = useFlatFinanceStore((s) => s.flat);
  const unread = useFlatFinanceStore(selectUnreadCount);
  const signOut = useFlatFinanceStore((s) => s.signOut);
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = me?.role === "admin";
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);

  const handleSignOut = () => {
    signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen w-full">
      {/* desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-[color:var(--color-sidebar-border)] bg-[color:var(--color-sidebar)] lg:flex">
        <BrandHeader flatName={flat?.name} />
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              item={item}
              active={isActive(pathname, item.to)}
            />
          ))}
        </nav>
        <div className="border-t border-[color:var(--color-sidebar-border)] p-3">
          <ProfileMenu onSignOut={handleSignOut} />
        </div>
      </aside>

      {/* main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* top bar */}
        <header className="glass-panel sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border px-4 lg:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-r-[color:var(--color-sidebar-border)] bg-[color:var(--color-sidebar)] p-0">
              <BrandHeader flatName={flat?.name} />
              <nav className="space-y-1 px-3 py-4">
                {items.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(pathname, item.to)}
                    onSelect={() => setMobileOpen(false)}
                  />
                ))}
              </nav>
              <div className="border-t border-[color:var(--color-sidebar-border)] p-3">
                <ProfileMenu onSignOut={handleSignOut} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{flat?.name ?? "FlatFinance"}</p>
            {flat?.address ? (
              <p className="truncate text-xs text-muted-foreground">{flat.address}</p>
            ) : null}
          </div>

          <Link to="/app/notifications" aria-label="Notifications">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-[color:var(--color-primary)] px-1 text-[10px] font-semibold text-primary-foreground">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Button>
          </Link>

          {me ? <MemberAvatar member={me} size="sm" /> : null}
        </header>

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mx-auto w-full max-w-7xl"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* mobile bottom tab bar */}
        <nav
          className="glass-panel fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-border lg:hidden"
          aria-label="Primary"
        >
          {MOBILE_NAV.map((item) => {
            const active = isActive(pathname, item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                  active ? "text-[color:var(--color-primary)]" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function isActive(pathname: string, to: string): boolean {
  if (to === "/app") return pathname === "/app" || pathname === "/app/";
  return pathname === to || pathname.startsWith(to + "/");
}

function BrandHeader({ flatName }: { flatName?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--color-sidebar-border)] px-5 py-4">
      <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-[var(--shadow-glow)]">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">FlatFinance</p>
        <p className="truncate text-[11px] text-muted-foreground">
          {flatName ?? "by AC_PC Team"}
        </p>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect?: () => void;
}) {
  return (
    <Link
      to={item.to}
      onClick={onSelect}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all",
        active
          ? "bg-[color:var(--color-sidebar-accent)] text-foreground shadow-[var(--shadow-card)]"
          : "text-muted-foreground hover:bg-[color:var(--color-sidebar-accent)]/60 hover:text-foreground",
      )}
    >
      <item.icon
        className={cn(
          "h-4 w-4 transition-colors",
          active ? "text-[color:var(--color-primary)]" : "text-muted-foreground group-hover:text-foreground",
        )}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {item.adminOnly ? (
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          Admin
        </Badge>
      ) : null}
    </Link>
  );
}

function ProfileMenu({ onSignOut }: { onSignOut: () => void }) {
  const me = useFlatFinanceStore(selectCurrentMember);
  if (!me) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-[color:var(--color-sidebar-accent)]"
        >
          <MemberAvatar member={me} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{me.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {me.role === "admin" ? "Admin" : "Member"}
            </p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{me.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/app/members">View members</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/app/notifications">Notifications</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-[color:var(--color-destructive)] focus:text-[color:var(--color-destructive)]">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
