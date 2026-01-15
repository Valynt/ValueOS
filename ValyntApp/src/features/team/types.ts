export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: TeamRole;
  status: MemberStatus;
  joinedAt: string;
}

export type TeamRole = "owner" | "admin" | "member" | "viewer";
export type MemberStatus = "active" | "invited" | "suspended";

export interface TeamInvite {
  id: string;
  email: string;
  role: TeamRole;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  createdAt: string;
}
