/**
 * Request permission for browser HTML5 push notifications.
 */
export const requestNotificationPermission = async (): Promise<void> => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }
};

/**
 * Dispatches a native browser push notification.
 */
export const sendBrowserNotification = (title: string, body: string): void => {
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
        });
      } catch (err) {
        console.warn('Failed to send native notification:', err);
      }
    }
  }
};

/**
 * Subscribes to real-time WebSocket notifications for a specific invoice ID.
 */
export const listenToInvoiceNotification = (
  invoiceId: string,
  onComplete: (data: any) => void,
  onError: (error: string) => void
): WebSocket | null => {
  if (typeof window === 'undefined') return null;
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const wsUrl = isLocal 
    ? `ws://localhost:8001/ws/notifications/${invoiceId}`
    : `wss://notifications.slip-vault.com/ws/notifications/${invoiceId}`;
  
  const ws = new WebSocket(wsUrl);

  ws.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data);
      if (payload.event === 'processing_finished') {
        if (payload.status === 'COMPLETED') {
          sendBrowserNotification(
            'Invoice Processed Successfully! 💳',
            `Extracted details from ${payload.data?.storeName || 'the store'}.`
          );
          onComplete(payload.data);
        } else if (payload.status === 'ERROR') {
          const errMsg = payload.data?.error || 'Document type was invalid.';
          sendBrowserNotification('Invoice Processing Failed ❌', errMsg);
          onError(errMsg);
        }
        ws.close();
      }
    } catch (err) {
      console.error('Error parsing WebSocket notification payload:', err);
    }
  };

  ws.onerror = (err) => {
    console.error('WebSocket connection error:', err);
  };

  return ws;
};
