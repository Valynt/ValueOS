/**
 * InviteModal - Modal for inviting team members
 */

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { SimpleSelect } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (emails: string[], role: string, message: string) => void;
}

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "viewer", label: "Viewer" },
];

export function InviteModal({ open, onOpenChange, onInvite }: InviteModalProps) {
  const [emailsText, setEmailsText] = useState("");
  const [role, setRole] = useState("member");
  const [message, setMessage] = useState("");

  const handleSubmit = () => {
    const emails = emailsText
      .split("\n")
      .map((e) => e.trim())
      .filter((e) => e.length > 0 && e.includes("@"));

    if (emails.length > 0) {
      onInvite(emails, role, message);
      // Reset form
      setEmailsText("");
      setRole("member");
      setMessage("");
    }
  };

  const emailCount = emailsText
    .split("\n")
    .filter((e) => e.trim().includes("@")).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite team members</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email addresses */}
          <div className="space-y-2">
            <Label>Email addresses (one per line)</Label>
            <Textarea
              value={emailsText}
              onChange={(e) => setEmailsText(e.target.value)}
              placeholder="alex@company.com&#10;jamie@company.com"
              rows={4}
            />
          </div>

          {/* Role selection */}
          <div className="space-y-2">
            <Label>Role</Label>
            <SimpleSelect
              value={role}
              onValueChange={setRole}
              options={ROLE_OPTIONS}
            />
          </div>

          {/* Personal message */}
          <div className="space-y-2">
            <Label>Personal message (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Join our team on ValueOS!"
              rows={2}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Invites will be sent from noreply@valueos.io
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={emailCount === 0}>
            Send invite{emailCount > 1 ? "s" : ""}
            {emailCount > 0 && ` (${emailCount})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InviteModal;
