import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Share2 } from "lucide-react";
import { ShareCustomerModal } from "./ShareCustomerModal";
import type { ValueCase } from "@/services/ValueCaseService";

interface ShareCustomerButtonProps {
  valueCase: ValueCase;
  userId: string;
}

export function ShareCustomerButton({
  valueCase,
  userId,
}: ShareCustomerButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Share2 className="w-4 h-4 mr-2" />
        Share with Customer
      </Button>
      <ShareCustomerModal
        open={open}
        onClose={() => setOpen(false)}
        valueCase={valueCase}
        revokedByUserId={userId}
      />
    </>
  );
}
