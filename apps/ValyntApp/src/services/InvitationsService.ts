import { createLogger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { emailService } from "@/services/EmailService";

const logger = createLogger({ component: "InvitationsService" });

export class InvitationsService {
  async createInvite({
    tenantId,
    email,
    role,
    invitedBy,
  }: {
    tenantId: string;
    email: string;
    role: string;
    invitedBy?: string;
  }) {
    const token = (globalThis as any).crypto?.randomUUID?.() || require("crypto").randomUUID();
    try {
      const { data, error } = await supabase
        .from("invitations")
        .insert([
          {
            tenant_id: tenantId,
            email,
            role,
            token,
            invited_by: invitedBy || null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      const baseUrl =
        process.env.VITE_APP_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173";
      const inviteLink = `${baseUrl.replace(/\/$/, "")}/accept-invite?token=${token}`;

      await emailService.send({
        to: email,
        subject: `You're invited to join ${process.env.APP_NAME || "ValueOS"}`,
        template: "invite",
        data: {
          inviterName: invitedBy || "Team Admin",
          organizationName: process.env.APP_NAME || "ValueOS",
          inviteLink,
          role,
        },
      });

      return data;
    } catch (err) {
      logger.error("createInvite failed", { error: err, email, tenantId });
      throw err;
    }
  }

  async resendInvite(invitationId: string) {
    try {
      const { data: inv, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("id", invitationId)
        .single();

      if (error) throw error;

      const baseUrl =
        process.env.VITE_APP_URL || process.env.FRONTEND_BASE_URL || "http://localhost:5173";
      const inviteLink = `${baseUrl.replace(/\/$/, "")}/accept-invite?token=${inv.token}`;

      await emailService.send({
        to: inv.email,
        subject: `Invitation reminder: Join ${process.env.APP_NAME || "ValueOS"}`,
        template: "invite",
        data: {
          inviterName: inv.invited_by || "Team Admin",
          organizationName: process.env.APP_NAME || "ValueOS",
          inviteLink,
          role: inv.role,
        },
      });

      return inv;
    } catch (err) {
      logger.error("resendInvite failed", { error: err, invitationId });
      throw err;
    }
  }
}

export const invitationsService = new InvitationsService();
