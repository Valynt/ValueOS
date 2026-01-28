export interface CollaborationEvent {
  type: "presence" | "edit" | "comment";
  userId: string;
  userName: string;
  payload: any;
  timestamp: string;
}

export interface GuestToken {
  token: string;
  expiresAt: string;
  permissions: "view" | "comment" | "edit";
}

export class CollaborationService {
  private static instance: CollaborationService;
  private listeners: ((event: CollaborationEvent) => void)[] = [];

  private constructor() {}

  public static getInstance(): CollaborationService {
    if (!CollaborationService.instance) {
      CollaborationService.instance = new CollaborationService();
    }
    return CollaborationService.instance;
  }

  /**
   * Simulates joining a real-time collaboration session.
   */
  public joinSession(userId: string, userName: string) {
    this.broadcast({
      type: "presence",
      userId,
      userName,
      payload: { status: "joined" },
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Simulates broadcasting an edit event.
   */
  public sendEdit(userId: string, userName: string, change: any) {
    this.broadcast({
      type: "edit",
      userId,
      userName,
      payload: change,
      timestamp: new Date().toISOString(),
    });
  }

  public subscribe(callback: (event: CollaborationEvent) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback);
    };
  }

  private broadcast(event: CollaborationEvent) {
    this.listeners.forEach((l) => l(event));
  }

  /**
   * Generates a secure guest access token.
   */
  public generateGuestToken(permissions: "view" | "comment" | "edit"): GuestToken {
    return {
      token: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
      permissions,
    };
  }
}
