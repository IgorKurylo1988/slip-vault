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
 * Polls the notification service for status updates of a specific invoice ID.
 */
export const pollInvoiceStatus = (
  invoiceId: string,
  onComplete: (data: any) => void,
  onError: (error: string) => void
): () => void => {
  if (typeof window === 'undefined') return () => {};
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const baseUrl = isLocal 
    ? 'http://localhost:8001'
    : 'https://notifications.slip-vault.com';
    
  const url = `${baseUrl}/api/invoices/${invoiceId}/status`;
  
  let isStopped = false;
  
  const checkStatus = async () => {
    if (isStopped) return;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Status check failed");
      const result = await response.json();
      
      if (result.status === 'COMPLETED') {
        sendBrowserNotification(
          'Invoice Processed Successfully! 💳',
          `Extracted details from ${result.data?.storeName || 'the store'}.`
        );
        onComplete(result.data);
      } else if (result.status === 'ERROR') {
        const errMsg = result.data?.error || 'Document type was invalid.';
        sendBrowserNotification('Invoice Processing Failed ❌', errMsg);
        onError(errMsg);
      } else {
        // Still processing, poll again in 2 seconds
        setTimeout(checkStatus, 2000);
      }
    } catch (err) {
      console.warn("Polling error, retrying in 3 seconds...", err);
      setTimeout(checkStatus, 3000);
    }
  };
  
  // Start polling
  setTimeout(checkStatus, 1000);
  
  // Return cleanup cancel function
  return () => {
    isStopped = true;
  };
};
