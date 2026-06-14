/** Domain types for FlatFinance. All currency values in TAKA (৳). */

export type MemberRole = "admin" | "member";
export type MemberStatus = "active" | "suspended" | "left";

export interface MemberRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: string; // ISO date YYYY-MM-DD
  leftAt?: string;  // ISO date — set when status becomes "left", used for pro-rating
  paymentMethod: string;
  avatarColor: string; // tailwind-safe oklch chip color hash
}

/** A non-member guest tracked for meal attribution */
export interface GuestRecord {
  id: string;
  name: string;
  hostMemberId: string; // meals billed to this member (or split)
  splitAmongAll: boolean; // true = all members share the cost; false = host pays
  arrivalDate: string;   // YYYY-MM-DD
  departureDate: string; // YYYY-MM-DD
  meals: { breakfast: number; lunch: number; dinner: number }; // per-stay totals
  note?: string;
}

export interface FlatRecord {
  id: string;
  name: string;
  address: string;
  createdAt: string;
  ownerId: string; // member id of the creator/super-admin
}

export type ExpenseCategory = "Grocery" | "Rent" | "Utilities" | "Maintenance" | "Miscellaneous";

export interface ExpenseRecord {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string;
  date: string;
  addedBy: string;
  approved: boolean;
  deleted: boolean;
  receiptDataUrl?: string; // base64 image data URL from camera/file
}

export interface MealEntryRecord {
  id: string;
  memberId: string;
  date: string; // YYYY-MM-DD
  breakfast: number;
  lunch: number;
  dinner: number;
  guestMeals: number;
  isLateEntry: boolean;
  approved: boolean;
}

export interface InventoryItemRecord {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  lowThreshold: number;
  expiryDate?: string;
}

export type LoanStatus = "active" | "paid" | "disputed";

export interface LoanRecord {
  id: string;
  lenderId: string;
  borrowerId: string;
  amount: number;
  interestRate: number;
  description: string;
  date: string;
  dueDate?: string;
  paidAmount: number;
  status: LoanStatus;
}

export interface PaymentRecord {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  method: string;
  note: string;
  month: string; // YYYY-MM
}

export type InviteStatus = "pending" | "accepted" | "revoked";

export interface FlatInviteRecord {
  id: string;
  code: string;
  email?: string;
  createdBy: string;
  createdAt: string;
  status: InviteStatus;
  expiresAt: string;
}

export type JoinRequestStatus = "pending" | "approved" | "rejected";

export interface JoinRequestRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  status: JoinRequestStatus;
}

export type NotificationType = "info" | "success" | "warning" | "error";

export interface NotificationRecord {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  recipientId?: string;
}

export interface ActivityRecord {
  id: string;
  memberId: string;
  action: string;
  entity: string;
  entityId: string;
  details: string;
  timestamp: string;
}

export interface PendingAuth {
  email: string;
  phone: string;
  name?: string;
  mode: "login" | "signup";
  inviteCode?: string;
  joinRequestNote?: string;
}

/** Carry-forward balance from a prior month into the current one */
export interface CarryForwardRecord {
  id: string;
  memberId: string;
  fromMonth: string; // YYYY-MM the balance originated in
  toMonth: string;   // YYYY-MM it is applied to
  amount: number;    // positive = credit (member is owed), negative = debit (member owes)
  note?: string;
  createdAt: string;
}
