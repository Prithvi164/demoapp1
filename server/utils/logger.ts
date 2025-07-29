/**
 * Centralized server-side logging utility that's environment-aware
 * Ensures production environments aren't cluttered with debug logs
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = () => {
  return process.env.NODE_ENV === 'production';
};

/**
 * Conditional logger that reduces debug and info output in production
 */
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (!isProduction()) {
      console.debug(`[DEBUG] ${new Date().toISOString()}: ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    // Info logs are important for operations, so we keep minimal ones in production
    if (isProduction()) {
      // In production, only log important info without details
      console.info(`[INFO] ${message}`);
    } else {
      console.info(`[INFO] ${new Date().toISOString()}: ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, ...args);
  }
};

export default logger;