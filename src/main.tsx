import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { bootstrap } from './bootstrap';
import { isProduction, isDevelopment } from './config/environment';

/**
 * Application entry point with production-ready bootstrap
 */
async function main() {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  // Show loading indicator
  rootElement.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
      <div style="text-align: center;">
        <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">ValueCanvas</div>
        <div style="font-size: 14px; color: #666;">Initializing application...</div>
        <div style="margin-top: 16px;">
          <div style="width: 200px; height: 4px; background: #e5e7eb; border-radius: 2px; overflow: hidden;">
            <div style="width: 100%; height: 100%; background: linear-gradient(90deg, #3b82f6, #8b5cf6); animation: loading 1.5s ease-in-out infinite;"></div>
          </div>
        </div>
      </div>
    </div>
    <style>
      @keyframes loading {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
      }
    </style>
  `;

  try {
    // Bootstrap the application
    console.log('Starting application bootstrap...');
    
    const result = await bootstrap({
      skipAgentCheck: false,
      failFast: isProduction(),
      onProgress: (message) => {
        console.log(`⏳ ${message}`);
      },
      onWarning: (warning) => {
        console.warn(`⚠️  ${warning}`);
      },
      onError: (error) => {
        console.error(`❌ ${error}`);
      },
    });

    // Check if bootstrap was successful
    if (!result.success && isProduction()) {
      // Show error screen in production
      rootElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
          <div style="text-align: center; max-width: 500px; padding: 24px;">
            <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
            <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #dc2626;">Application Initialization Failed</div>
            <div style="font-size: 14px; color: #666; margin-bottom: 24px;">
              The application could not be initialized. Please contact support if this problem persists.
            </div>
            <details style="text-align: left; background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 12px; font-family: monospace;">
              <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">Error Details</summary>
              <ul style="margin: 0; padding-left: 20px;">
                ${result.errors.map(error => `<li style="margin: 4px 0;">${error}</li>`).join('')}
              </ul>
            </details>
          </div>
        </div>
      `;
      return;
    }

    // Log warnings in development
    if (isDevelopment() && result.warnings.length > 0) {
      console.warn('Bootstrap completed with warnings:');
      result.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    // Render the application
    console.log('Rendering application...');
    
    const root = createRoot(rootElement);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>
    );

    console.log('✅ Application rendered successfully');
    
  } catch (error) {
    console.error('Fatal error during application initialization:', error);
    
    // Show error screen
    rootElement.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: system-ui, -apple-system, sans-serif;">
        <div style="text-align: center; max-width: 500px; padding: 24px;">
          <div style="font-size: 48px; margin-bottom: 16px;">❌</div>
          <div style="font-size: 24px; font-weight: 600; margin-bottom: 16px; color: #dc2626;">Fatal Error</div>
          <div style="font-size: 14px; color: #666; margin-bottom: 24px;">
            ${error instanceof Error ? error.message : 'An unexpected error occurred'}
          </div>
          ${isDevelopment() ? `
            <details style="text-align: left; background: #f3f4f6; padding: 16px; border-radius: 8px; font-size: 12px; font-family: monospace;">
              <summary style="cursor: pointer; font-weight: 600; margin-bottom: 8px;">Stack Trace</summary>
              <pre style="margin: 0; white-space: pre-wrap; word-break: break-word;">${error instanceof Error ? error.stack : ''}</pre>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  }
}

// Start the application
main().catch((error) => {
  console.error('Unhandled error in main():', error);
});
