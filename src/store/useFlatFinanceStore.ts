/**
 * FlatFinance — single Zustand store, persisted to localStorage.
 * No seed/demo data: every flat starts empty and is populated by the user.
 *
 * Architecture note: kept as one store for atomic cross-domain updates
 * (e.g. addPayment writes payments + activity + notification together).
 * Selectors should be narrow at call site for re-render hygiene.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createId, createInviteCode, todayIso } from "@/lib/format";
import type {
  ActivityRecord,
  ExpenseRecord,
  FlatInviteRecord,
  FlatRecord,
  InventoryItemRecord,
  JoinRequestRecord,
  LoanRecord,
  MealEntryRecord,
  MemberRecord,
  NotificationRecord,
  PaymentRecord,
  PendingAuth,
} from "./types";

const AVATAR_PALETTE = [
  "from-violet-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-sky-500 to-blue-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
  "from-fuchsia-500 to-purple-500",
  "from-lime-500 to-emerald-500",
];

function pickAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

interface FlatFinanceState {
  // session (simulated)
  currentMemberId: string | null;
  sessionStartedAt: string | null;
  pendingAuth: PendingAuth | null;

  // domain
  flat: FlatRecord | null;
  members: MemberRecord[];
  expenses: ExpenseRecord[];
  meals: MealEntryRecord[];
  inventory: InventoryItemRecord[];
  loans: LoanRecord[];
  payments: PaymentRecord[];
  invites: FlatInviteRecord[];
  joinRequests: JoinRequestRecord[];
  notifications: NotificationRecord[];
  activity: ActivityRecord[];

  // auth
  beginAuth: (pending: PendingAuth) => void;
  clearPendingAuth: () => void;
  /** Simulated OTP — always succeeds. Returns created/found member or null when state is invalid. */
  verifyOtpAndCommit: (otp: string) => MemberRecord | null;
  signOut: () => void;

  // flat
  createFlat: (input: { name: string; address: string; ownerName: string; ownerEmail: string; ownerPhone: string }) => MemberRecord;
  updateFlat: (patch: Partial<Pick<FlatRecord, "name" | "address">>) => void;

  // members
  addMember: (input: Omit<MemberRecord, "id" | "joinedAt" | "status" | "avatarColor">) => MemberRecord;
  updateMember: (id: string, patch: Partial<MemberRecord>) => void;
  setMemberStatus: (id: string, status: MemberRecord["status"]) => void;
  promoteMember: (id: string) => void;
  demoteMember: (id: string) => void;

  // invites
  createInvite: (input: { email?: string; createdBy: string }) => FlatInviteRecord;
  revokeInvite: (id: string) => void;
  acceptInviteByCode: (code: string) => boolean;

  // join requests
  createJoinRequest: (input: Omit<JoinRequestRecord, "id" | "createdAt" | "status">) => JoinRequestRecord;
  approveJoinRequest: (id: string) => void;
  rejectJoinRequest: (id: string) => void;

  // expenses
  addExpense: (input: Omit<ExpenseRecord, "id" | "deleted" | "approved"> & { approved?: boolean }) => ExpenseRecord;
  updateExpense: (id: string, patch: Partial<ExpenseRecord>) => void;
  approveExpense: (id: string) => void;
  softDeleteExpense: (id: string) => void;

  // meals
  upsertMealEntry: (input: Omit<MealEntryRecord, "id" | "approved" | "isLateEntry"> & { approved?: boolean; isLateEntry?: boolean }) => MealEntryRecord;
  approveMealEntry: (id: string) => void;
  deleteMealEntry: (id: string) => void;

  // inventory
  addInventoryItem: (input: Omit<InventoryItemRecord, "id">) => InventoryItemRecord;
  updateInventoryItem: (id: string, patch: Partial<InventoryItemRecord>) => void;
  deleteInventoryItem: (id: string) => void;

  // loans
  addLoan: (input: Omit<LoanRecord, "id" | "paidAmount" | "status">) => LoanRecord;
  repayLoan: (id: string, amount: number) => void;
  deleteLoan: (id: string) => void;

  // payments
  recordPayment: (input: Omit<PaymentRecord, "id">) => PaymentRecord;

  // notifications
  pushNotification: (input: Omit<NotificationRecord, "id" | "createdAt" | "read">) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotification: (id: string) => void;

  // activity (internal helper exposed for completeness)
  logActivity: (input: Omit<ActivityRecord, "id" | "timestamp">) => void;

  // dev / danger
  resetEverything: () => void;
}

const EMPTY_STATE = {
  currentMemberId: null,
  sessionStartedAt: null,
  pendingAuth: null,
  flat: null,
  members: [],
  expenses: [],
  meals: [],
  inventory: [],
  loans: [],
  payments: [],
  invites: [],
  joinRequests: [],
  notifications: [],
  activity: [],
} satisfies Partial<FlatFinanceState>;

const safeStorage = createJSONStorage<FlatFinanceState>(() => {
  if (typeof window === "undefined") {
    // SSR-safe no-op storage
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
});

export const useFlatFinanceStore = create<FlatFinanceState>()(
  persist(
    (set, get) => ({
      ...EMPTY_STATE,

      // ============ AUTH ============
      beginAuth: (pending) => set({ pendingAuth: pending }),
      clearPendingAuth: () => set({ pendingAuth: null }),

      verifyOtpAndCommit: (otp) => {
        const pending = get().pendingAuth;
        if (!pending) return null;
        if (!/^\d{4,6}$/.test(otp)) return null;

        if (pending.mode === "login") {
          const member = get().members.find(
            (m) =>
              (m.email.toLowerCase() === pending.email.toLowerCase() ||
                (pending.phone && m.phone === pending.phone)) &&
              m.status === "active",
          );
          if (!member) return null;
          set({
            currentMemberId: member.id,
            sessionStartedAt: new Date().toISOString(),
            pendingAuth: null,
          });
          get().logActivity({
            memberId: member.id,
            action: "LOGIN",
            entity: "member",
            entityId: member.id,
            details: `${member.name} signed in`,
          });
          return member;
        }

        // signup mode: create or join
        const existing = get().members.find((m) => m.email.toLowerCase() === pending.email.toLowerCase());
        if (existing) {
          set({
            currentMemberId: existing.id,
            sessionStartedAt: new Date().toISOString(),
            pendingAuth: null,
          });
          return existing;
        }

        // If invite code provided and matches, auto-join as member
        if (pending.inviteCode) {
          const invite = get().invites.find(
            (i) => i.code === pending.inviteCode && i.status === "pending",
          );
          if (invite) {
            const member: MemberRecord = {
              id: createId("mem"),
              name: pending.name ?? pending.email.split("@")[0] ?? "Member",
              email: pending.email,
              phone: pending.phone,
              role: "member",
              status: "active",
              joinedAt: todayIso(),
              paymentMethod: "bKash",
              avatarColor: pickAvatarColor(pending.email),
            };
            set((s) => ({
              members: [...s.members, member],
              invites: s.invites.map((i) => (i.id === invite.id ? { ...i, status: "accepted" } : i)),
              currentMemberId: member.id,
              sessionStartedAt: new Date().toISOString(),
              pendingAuth: null,
            }));
            get().logActivity({
              memberId: member.id,
              action: "JOIN_VIA_INVITE",
              entity: "member",
              entityId: member.id,
              details: `${member.name} joined via invite ${invite.code}`,
            });
            get().pushNotification({
              title: "New member joined",
              message: `${member.name} joined the flat via invite.`,
              type: "success",
            });
            return member;
          }
        }

        // Otherwise, file a join request and DON'T create a session yet
        get().createJoinRequest({
          name: pending.name ?? pending.email.split("@")[0] ?? "Guest",
          email: pending.email,
          phone: pending.phone,
        });
        set({ pendingAuth: null });
        return null;
      },

      signOut: () => {
        const id = get().currentMemberId;
        if (id) {
          const m = get().members.find((mm) => mm.id === id);
          if (m) {
            get().logActivity({
              memberId: m.id,
              action: "LOGOUT",
              entity: "member",
              entityId: m.id,
              details: `${m.name} signed out`,
            });
          }
        }
        set({ currentMemberId: null, sessionStartedAt: null });
      },

      // ============ FLAT ============
      createFlat: ({ name, address, ownerName, ownerEmail, ownerPhone }) => {
        const ownerId = createId("mem");
        const owner: MemberRecord = {
          id: ownerId,
          name: ownerName,
          email: ownerEmail,
          phone: ownerPhone,
          role: "admin",
          status: "active",
          joinedAt: todayIso(),
          paymentMethod: "bKash",
          avatarColor: pickAvatarColor(ownerEmail),
        };
        const flat: FlatRecord = {
          id: createId("flat"),
          name,
          address,
          createdAt: new Date().toISOString(),
          ownerId,
        };
        set({
          flat,
          members: [owner],
          currentMemberId: ownerId,
          sessionStartedAt: new Date().toISOString(),
          pendingAuth: null,
        });
        get().logActivity({
          memberId: ownerId,
          action: "CREATE_FLAT",
          entity: "flat",
          entityId: flat.id,
          details: `Created flat "${name}"`,
        });
        get().pushNotification({
          title: "Welcome to FlatFinance",
          message: `Flat "${name}" is ready. Invite your housemates to get started.`,
          type: "success",
        });
        return owner;
      },

      updateFlat: (patch) =>
        set((s) => ({ flat: s.flat ? { ...s.flat, ...patch } : s.flat })),

      // ============ MEMBERS ============
      addMember: (input) => {
        const member: MemberRecord = {
          ...input,
          id: createId("mem"),
          joinedAt: todayIso(),
          status: "active",
          avatarColor: pickAvatarColor(input.email),
        };
        set((s) => ({ members: [...s.members, member] }));
        const actor = get().currentMemberId;
        if (actor) {
          get().logActivity({
            memberId: actor,
            action: "ADD_MEMBER",
            entity: "member",
            entityId: member.id,
            details: `Added ${member.name}`,
          });
        }
        get().pushNotification({
          title: "Member added",
          message: `${member.name} was added to the flat.`,
          type: "info",
        });
        return member;
      },

      updateMember: (id, patch) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      setMemberStatus: (id, status) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, status } : m)) })),

      promoteMember: (id) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, role: "admin" } : m)) })),

      demoteMember: (id) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, role: "member" } : m)) })),

      // ============ INVITES ============
      createInvite: ({ email, createdBy }) => {
        const invite: FlatInviteRecord = {
          id: createId("inv"),
          code: createInviteCode(),
          email,
          createdBy,
          createdAt: new Date().toISOString(),
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
        };
        set((s) => ({ invites: [invite, ...s.invites] }));
        return invite;
      },

      revokeInvite: (id) =>
        set((s) => ({
          invites: s.invites.map((i) => (i.id === id ? { ...i, status: "revoked" } : i)),
        })),

      acceptInviteByCode: (code) => {
        const invite = get().invites.find((i) => i.code === code && i.status === "pending");
        if (!invite) return false;
        set((s) => ({
          invites: s.invites.map((i) => (i.id === invite.id ? { ...i, status: "accepted" } : i)),
        }));
        return true;
      },

      // ============ JOIN REQUESTS ============
      createJoinRequest: (input) => {
        const req: JoinRequestRecord = {
          ...input,
          id: createId("req"),
          createdAt: new Date().toISOString(),
          status: "pending",
        };
        set((s) => ({ joinRequests: [req, ...s.joinRequests] }));
        get().pushNotification({
          title: "Join request received",
          message: `${input.name} requested to join the flat.`,
          type: "info",
        });
        return req;
      },

      approveJoinRequest: (id) => {
        const req = get().joinRequests.find((r) => r.id === id);
        if (!req || req.status !== "pending") return;
        const member = get().addMember({
          name: req.name,
          email: req.email,
          phone: req.phone,
          role: "member",
          paymentMethod: "bKash",
        });
        set((s) => ({
          joinRequests: s.joinRequests.map((r) =>
            r.id === id ? { ...r, status: "approved" } : r,
          ),
        }));
        void member;
      },

      rejectJoinRequest: (id) =>
        set((s) => ({
          joinRequests: s.joinRequests.map((r) =>
            r.id === id ? { ...r, status: "rejected" } : r,
          ),
        })),

      // ============ EXPENSES ============
      addExpense: ({ approved, ...input }) => {
        const expense: ExpenseRecord = {
          ...input,
          approved: approved ?? false,
          id: createId("exp"),
          deleted: false,
        };
        set((s) => ({ expenses: [expense, ...s.expenses] }));
        const actor = get().currentMemberId;
        if (actor) {
          get().logActivity({
            memberId: actor,
            action: "ADD_EXPENSE",
            entity: "expense",
            entityId: expense.id,
            details: `Expense ৳${expense.amount} — ${expense.description}`,
          });
        }
        get().pushNotification({
          title: "Expense added",
          message: `৳${expense.amount} for ${expense.description} (${expense.category}).`,
          type: "info",
        });
        return expense;
      },

      updateExpense: (id, patch) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      approveExpense: (id) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, approved: true } : e)) })),

      softDeleteExpense: (id) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, deleted: true } : e)) })),

      // ============ MEALS ============
      upsertMealEntry: ({ approved, isLateEntry, ...input }) => {
        const existing = get().meals.find(
          (m) => m.memberId === input.memberId && m.date === input.date,
        );
        if (existing) {
          const merged: MealEntryRecord = {
            ...existing,
            ...input,
            approved: approved ?? existing.approved,
            isLateEntry: isLateEntry ?? existing.isLateEntry,
          };
          set((s) => ({ meals: s.meals.map((m) => (m.id === existing.id ? merged : m)) }));
          return merged;
        }
        const created: MealEntryRecord = {
          ...input,
          id: createId("meal"),
          approved: approved ?? true,
          isLateEntry: isLateEntry ?? false,
        };
        set((s) => ({ meals: [created, ...s.meals] }));
        return created;
      },

      approveMealEntry: (id) =>
        set((s) => ({ meals: s.meals.map((m) => (m.id === id ? { ...m, approved: true } : m)) })),

      deleteMealEntry: (id) =>
        set((s) => ({ meals: s.meals.filter((m) => m.id !== id) })),

      // ============ INVENTORY ============
      addInventoryItem: (input) => {
        const item: InventoryItemRecord = { ...input, id: createId("inv") };
        set((s) => ({ inventory: [item, ...s.inventory] }));
        return item;
      },

      updateInventoryItem: (id, patch) => {
        set((s) => ({
          inventory: s.inventory.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
        const updated = get().inventory.find((i) => i.id === id);
        if (updated && updated.quantity <= updated.lowThreshold) {
          get().pushNotification({
            title: "Low inventory",
            message: `${updated.name} is at ${updated.quantity} ${updated.unit} — restock soon.`,
            type: "warning",
          });
        }
      },

      deleteInventoryItem: (id) =>
        set((s) => ({ inventory: s.inventory.filter((i) => i.id !== id) })),

      // ============ LOANS ============
      addLoan: (input) => {
        const loan: LoanRecord = { ...input, id: createId("loan"), paidAmount: 0, status: "active" };
        set((s) => ({ loans: [loan, ...s.loans] }));
        const actor = get().currentMemberId;
        if (actor) {
          get().logActivity({
            memberId: actor,
            action: "ADD_LOAN",
            entity: "loan",
            entityId: loan.id,
            details: `Loan ৳${loan.amount}`,
          });
        }
        return loan;
      },

      repayLoan: (id, amount) =>
        set((s) => ({
          loans: s.loans.map((l) => {
            if (l.id !== id) return l;
            const totalOwed = l.amount + (l.amount * l.interestRate) / 100;
            const paid = l.paidAmount + amount;
            return { ...l, paidAmount: paid, status: paid >= totalOwed ? "paid" : "active" };
          }),
        })),

      deleteLoan: (id) => set((s) => ({ loans: s.loans.filter((l) => l.id !== id) })),

      // ============ PAYMENTS ============
      recordPayment: (input) => {
        const payment: PaymentRecord = { ...input, id: createId("pay") };
        set((s) => ({ payments: [payment, ...s.payments] }));
        const actor = get().currentMemberId;
        if (actor) {
          get().logActivity({
            memberId: actor,
            action: "RECORD_PAYMENT",
            entity: "payment",
            entityId: payment.id,
            details: `Recorded ৳${payment.amount} via ${payment.method}`,
          });
        }
        get().pushNotification({
          title: "Payment recorded",
          message: `৳${payment.amount} recorded for the flat.`,
          type: "success",
        });
        return payment;
      },

      // ============ NOTIFICATIONS ============
      pushNotification: (input) =>
        set((s) => ({
          notifications: [
            {
              ...input,
              id: createId("nt"),
              createdAt: new Date().toISOString(),
              read: false,
            },
            ...s.notifications,
          ].slice(0, 200),
        })),

      markNotificationRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),

      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      clearNotification: (id) =>
        set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),

      // ============ ACTIVITY ============
      logActivity: (input) =>
        set((s) => ({
          activity: [
            { ...input, id: createId("act"), timestamp: new Date().toISOString() },
            ...s.activity,
          ].slice(0, 500),
        })),

      resetEverything: () => set({ ...EMPTY_STATE }),
    }),
    {
      name: "flatfinance:v1",
      storage: safeStorage,
      version: 1,
    },
  ),
);

// ============ Selectors ============

export const selectCurrentMember = (s: FlatFinanceState): MemberRecord | null =>
  s.currentMemberId ? (s.members.find((m) => m.id === s.currentMemberId) ?? null) : null;

export const selectIsAdmin = (s: FlatFinanceState): boolean => {
  const me = selectCurrentMember(s);
  return me?.role === "admin";
};

export const selectActiveMembers = (s: FlatFinanceState): MemberRecord[] =>
  s.members.filter((m) => m.status === "active");

export const selectUnreadCount = (s: FlatFinanceState): number =>
  s.notifications.filter((n) => !n.read && (!n.recipientId || n.recipientId === s.currentMemberId))
    .length;
