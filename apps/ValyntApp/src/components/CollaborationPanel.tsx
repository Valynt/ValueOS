import React, { useEffect, useState } from "react";
import {
  type CollaborationEvent,
  CollaborationService,
  type GuestToken,
} from "../services/CollaborationService";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

export const CollaborationPanel: React.FC = () => {
  const [events, setEvents] = useState<CollaborationEvent[]>([]);
  const [guestToken, setGuestToken] = useState<GuestToken | null>(null);

  useEffect(() => {
    const service = CollaborationService.getInstance();
    const unsubscribe = service.subscribe((event) => {
      setEvents((prev) => [event, ...prev].slice(0, 5));
    });

    service.joinSession("user_123", "Value Engineer");

    return unsubscribe;
  }, []);

  const handleGenerateToken = () => {
    const service = CollaborationService.getInstance();
    setGuestToken(service.generateGuestToken("view"));
  };

  return (
    <Card className="p-6 mt-6">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <span role="img" aria-label="Users">
          👥
        </span>{" "}
        Real-Time Collaboration
      </h3>

      <div className="space-y-4 mb-6">
        <Label>Recent Activity</Label>
        <div className="space-y-2">
          {events.map((e, i) => (
            <div key={i} className="text-xs p-2 bg-muted rounded flex justify-between">
              <span>
                <strong>{e.userName}</strong>{" "}
                {e.type === "presence" ? "joined" : "edited the model"}
              </span>
              <span className="text-muted-foreground">
                {new Date(e.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No activity yet...</p>
          )}
        </div>
      </div>

      <div className="border-t pt-4">
        <Label className="mb-2 block">Guest Access</Label>
        {!guestToken ? (
          <Button onClick={handleGenerateToken} variant="outline" size="sm" className="w-full">
            Generate Guest Link
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="p-2 bg-blue-50 border border-blue-100 rounded text-xs break-all font-mono">
              https://valynt.app/guest?token={guestToken.token}
            </div>
            <div className="flex justify-between items-center">
              <Badge variant="secondary">
                Expires: {new Date(guestToken.expiresAt).toLocaleDateString()}
              </Badge>
              <Button onClick={() => setGuestToken(null)} variant="ghost" size="xs">
                Clear
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
