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
  joinedAt: string; // ISO date
  paymentMethod: string;
  avatarColor: string; // tailwind-safe oklch chip color hash
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
