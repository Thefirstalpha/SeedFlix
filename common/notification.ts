export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'search';
  createdAt: string;
  isRead: boolean;
  data?: Record<string, unknown>;
}