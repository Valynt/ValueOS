// Stub: NotificationService not found in codebase
export class NotificationService {
  async send() {}
  async listForUser(_organizationId: string, _userId: string, _limit: number): Promise<unknown[]> {
    return [];
  }
  async markRead(_organizationId: string, _userId: string, _notificationId: string): Promise<void> {}
  async markAllRead(_organizationId: string, _userId: string): Promise<void> {}
}
export const notificationService = new NotificationService();
export function getNotificationService(): NotificationService {
  return notificationService;
}
