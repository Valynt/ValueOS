/**
 * Vite HMR WebSocket Fallback Handler
 * 
 * Provides fallback mechanisms when HMR WebSocket connections fail,
 * ensuring reliable development experience.
 */

// Global flag to track HMR connection status
let hmrConnected = false;
let retryCount = 0;
const maxRetries = 5;
const retryDelay = 2000; // 2 seconds

/**
 * Initialize HMR fallback monitoring
 */
export function initHMRFallback() {
  // Monitor WebSocket connection attempts
  const originalWebSocket = window.WebSocket;
  
  window.WebSocket = function(url: string, protocols?: string | string[]) {
    const ws = new originalWebSocket(url, protocols);
    
    // Override WebSocket event handlers for HMR connections
    if (url.includes('24678')) { // HMR WebSocket port
      ws.addEventListener('open', () => {
        console.log('HMR WebSocket connected successfully');
        hmrConnected = true;
        retryCount = 0;
      });
      
      ws.addEventListener('close', () => {
        console.warn('HMR WebSocket connection closed');
        hmrConnected = false;
        scheduleRetry();
      });
      
      ws.addEventListener('error', (error) => {
        console.error('HMR WebSocket connection error:', error);
        hmrConnected = false;
        scheduleRetry();
      });
    }
    
    return ws;
  } as any;
}

/**
 * Schedule retry for HMR connection
 */
function scheduleRetry() {
  if (retryCount >= maxRetries) {
    console.warn(`HMR connection failed after ${maxRetries} retries. Falling back to manual refresh.`);
    showHMRFallbackMessage();
    return;
  }
  
  retryCount++;
  console.log(`Retrying HMR connection in ${retryDelay}ms (attempt ${retryCount}/${maxRetries})`);
  
  setTimeout(() => {
    if (!hmrConnected) {
      // Trigger a manual page reload to re-establish HMR
      window.location.reload();
    }
  }, retryDelay);
}

/**
 * Show user-friendly message when HMR fails
 */
function showHMRFallbackMessage() {
  const existingMessage = document.getElementById('hmr-fallback-message');
  if (existingMessage) return;
  
  const message = document.createElement('div');
  message.id = 'hmr-fallback-message';
  message.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #f59e0b;
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 14px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    max-width: 300px;
  `;
  
  message.innerHTML = `
    <div style="font-weight: 600; margin-bottom: 4px;">HMR Connection Failed</div>
    <div style="font-size: 12px;">Hot Module Replacement is unavailable. Refresh the page to see changes.</div>
    <button onclick="this.parentElement.remove()" style="
      margin-top: 8px;
      background: white;
      color: #f59e0b;
      border: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;
    ">Dismiss</button>
  `;
  
  document.body.appendChild(message);
  
  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (message.parentElement) {
      message.remove();
    }
  }, 10000);
}

/**
 * Check if HMR is currently connected
 */
export function isHMRConnected(): boolean {
  return hmrConnected;
}

/**
 * Manual HMR connection attempt
 */
export function attemptHMRReconnect() {
  retryCount = 0;
  scheduleRetry();
}
