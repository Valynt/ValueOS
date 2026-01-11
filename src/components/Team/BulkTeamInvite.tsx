/**
 * BulkTeamInvite Component
 *
 * Allows inviting multiple team members at once via comma/newline separated emails.
 * Validates email format and shows pending invites list.
 */

import { useState, useCallback, useMemo } from "react";
import {
  Mail,
  UserPlus,
  X,
  AlertCircle,
  CheckCircle,
  Loader2,
  Send,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "../../lib/utils";

interface PendingInvite {
  email: string;
  status: "pending" | "sending" | "sent" | "error";
  error?: string;
}

interface BulkTeamInviteProps {
  onInvite: (emails: string[]) => Promise<{ success: boolean; errors?: Record<string, string> }>;
  onResend?: (email: string) => Promise<void>;
  onCancel?: (email: string) => Promise<void>;
  existingMembers?: string[];
  maxInvites?: number;
  className?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(input: string): string[] {
  return input
    .split(/[,\n\r]+/)
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

function validateEmail(email: string): { valid: boolean; error?: string } {
  if (!email) {
    return { valid: false, error: "Email is required" };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }
  return { valid: true };
}

export function BulkTeamInvite({
  onInvite,
  onResend,
  onCancel,
  existingMembers = [],
  maxInvites = 50,
  className,
}: BulkTeamInviteProps) {
  const [inputValue, setInputValue] = useState("");
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Parse and validate emails from input
  const parsedEmails = useMemo(() => {
    const emails = parseEmails(inputValue);
    return emails.map((email) => {
      const validation = validateEmail(email);
      const isDuplicate = existingMembers.includes(email);
      const isAlreadyPending = pendingInvites.some((p) => p.email === email);

      return {
        email,
        valid: validation.valid && !isDuplicate && !isAlreadyPending,
        error:
          validation.error ||
          (isDuplicate ? "Already a member" : isAlreadyPending ? "Already pending" : undefined),
      };
    });
  }, [inputValue, existingMembers, pendingInvites]);

  const validEmails = parsedEmails.filter((e) => e.valid);
  const invalidEmails = parsedEmails.filter((e) => !e.valid);

  // Add emails to pending list
  const handleAddEmails = useCallback(() => {
    if (validEmails.length === 0) return;

    const newInvites: PendingInvite[] = validEmails.map((e) => ({
      email: e.email,
      status: "pending",
    }));

    setPendingInvites((prev) => [...prev, ...newInvites]);
    setInputValue("");
  }, [validEmails]);

  // Remove from pending
  const handleRemovePending = useCallback((email: string) => {
    setPendingInvites((prev) => prev.filter((p) => p.email !== email));
  }, []);

  // Send all pending invites
  const handleSendInvites = useCallback(async () => {
    const pendingEmails = pendingInvites.filter((p) => p.status === "pending").map((p) => p.email);

    if (pendingEmails.length === 0) return;

    setIsSubmitting(true);

    // Update status to sending
    setPendingInvites((prev) =>
      prev.map((p) => (pendingEmails.includes(p.email) ? { ...p, status: "sending" as const } : p))
    );

    try {
      const result = await onInvite(pendingEmails);

      // Update status based on result
      setPendingInvites((prev) =>
        prev.map((p) => {
          if (!pendingEmails.includes(p.email)) return p;

          if (result.errors?.[p.email]) {
            return { ...p, status: "error" as const, error: result.errors[p.email] };
          }
          return { ...p, status: "sent" as const };
        })
      );

      if (result.success) {
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      }
    } catch (error) {
      // Mark all as error
      setPendingInvites((prev) =>
        prev.map((p) =>
          pendingEmails.includes(p.email)
            ? { ...p, status: "error" as const, error: "Failed to send" }
            : p
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [pendingInvites, onInvite]);

  // Resend individual invite
  const handleResend = useCallback(
    async (email: string) => {
      if (!onResend) return;

      setPendingInvites((prev) =>
        prev.map((p) => (p.email === email ? { ...p, status: "sending" as const } : p))
      );

      try {
        await onResend(email);
        setPendingInvites((prev) =>
          prev.map((p) => (p.email === email ? { ...p, status: "sent" as const } : p))
        );
      } catch {
        setPendingInvites((prev) =>
          prev.map((p) =>
            p.email === email ? { ...p, status: "error" as const, error: "Resend failed" } : p
          )
        );
      }
    },
    [onResend]
  );

  // Cancel individual invite
  const handleCancel = useCallback(
    async (email: string) => {
      if (!onCancel) return;

      try {
        await onCancel(email);
        setPendingInvites((prev) => prev.filter((p) => p.email !== email));
      } catch {
        // Keep in list on error
      }
    },
    [onCancel]
  );

  const pendingCount = pendingInvites.filter((p) => p.status === "pending").length;
  const sentCount = pendingInvites.filter((p) => p.status === "sent").length;
  const errorCount = pendingInvites.filter((p) => p.status === "error").length;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Email input */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Email Addresses</label>
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter email addresses separated by commas or new lines..."
          rows={4}
          className={cn(
            "w-full px-4 py-3 rounded-lg",
            "bg-gray-800 border border-gray-700 text-white placeholder-gray-500",
            "focus:border-primary focus:ring-1 focus:ring-primary/50 outline-none",
            "resize-none"
          )}
        />

        {/* Validation feedback */}
        {parsedEmails.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-sm">
            {validEmails.length > 0 && (
              <span className="text-green-400">
                {validEmails.length} valid email{validEmails.length > 1 ? "s" : ""}
              </span>
            )}
            {invalidEmails.length > 0 && (
              <span className="text-red-400">{invalidEmails.length} invalid</span>
            )}
          </div>
        )}

        {/* Invalid emails list */}
        {invalidEmails.length > 0 && (
          <div className="mt-2 space-y-1">
            {invalidEmails.slice(0, 5).map((e) => (
              <div key={e.email} className="flex items-center gap-2 text-sm text-red-400">
                <AlertCircle className="w-3 h-3" />
                <span>{e.email}</span>
                <span className="text-gray-500">— {e.error}</span>
              </div>
            ))}
            {invalidEmails.length > 5 && (
              <div className="text-sm text-gray-500">
                +{invalidEmails.length - 5} more invalid emails
              </div>
            )}
          </div>
        )}

        {/* Add button */}
        <button
          onClick={handleAddEmails}
          disabled={validEmails.length === 0 || pendingInvites.length >= maxInvites}
          className={cn(
            "mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium",
            "transition-colors",
            validEmails.length > 0 && pendingInvites.length < maxInvites
              ? "bg-primary hover:bg-primary/90 text-white"
              : "bg-gray-800 text-gray-500 cursor-not-allowed"
          )}
        >
          <UserPlus className="w-4 h-4" />
          Add {validEmails.length} Email{validEmails.length !== 1 ? "s" : ""}
        </button>
      </div>

      {/* Pending invites list */}
      {pendingInvites.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-300">
              Pending Invites ({pendingInvites.length})
            </h3>
            <div className="flex items-center gap-3 text-xs">
              {sentCount > 0 && <span className="text-green-400">{sentCount} sent</span>}
              {errorCount > 0 && <span className="text-red-400">{errorCount} failed</span>}
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pendingInvites.map((invite) => (
              <div
                key={invite.email}
                className={cn(
                  "flex items-center justify-between px-4 py-2 rounded-lg",
                  "bg-gray-800/50 border",
                  invite.status === "sent" && "border-green-500/30",
                  invite.status === "error" && "border-red-500/30",
                  invite.status === "pending" && "border-gray-700",
                  invite.status === "sending" && "border-blue-500/30"
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Status icon */}
                  {invite.status === "pending" && <Mail className="w-4 h-4 text-gray-500" />}
                  {invite.status === "sending" && (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                  {invite.status === "sent" && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {invite.status === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}

                  <div>
                    <span className="text-white">{invite.email}</span>
                    {invite.error && <p className="text-xs text-red-400">{invite.error}</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  {invite.status === "error" && onResend && (
                    <button
                      onClick={() => handleResend(invite.email)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                      aria-label="Resend"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  )}
                  {invite.status === "sent" && onCancel && (
                    <button
                      onClick={() => handleCancel(invite.email)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                      aria-label="Cancel invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {invite.status === "pending" && (
                    <button
                      onClick={() => handleRemovePending(invite.email)}
                      className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white"
                      aria-label="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send all button */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between pt-4 border-t border-gray-800">
          <p className="text-sm text-gray-500">
            {pendingCount} invite{pendingCount !== 1 ? "s" : ""} ready to send
          </p>
          <button
            onClick={handleSendInvites}
            disabled={isSubmitting}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium",
              "bg-primary hover:bg-primary/90 text-white",
              "transition-colors",
              isSubmitting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSubmitting ? "Sending..." : "Send All Invites"}
          </button>
        </div>
      )}

      {/* Success message */}
      {showSuccess && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400">
          <CheckCircle className="w-5 h-5" />
          <span>Invites sent successfully!</span>
        </div>
      )}
    </div>
  );
}

export default BulkTeamInvite;
