import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";
import type { MemberRecord } from "@/store/types";

interface MemberAvatarProps {
  member: Pick<MemberRecord, "name" | "avatarColor">;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
};

export function MemberAvatar({ member, size = "md", className }: MemberAvatarProps) {
  return (
    <div
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-semibold text-white shadow-[var(--shadow-card)]",
        member.avatarColor,
        sizeMap[size],
        className,
      )}
      aria-label={member.name}
    >
      {getInitials(member.name)}
    </div>
  );
}
