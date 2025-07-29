/**
 * Centralized logging utility that's environment-aware
 * This prevents excessive logging in production while maintaining
 * full debugging capabilities in development
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = () => {
  return import.meta.env.PROD === true;
};

/**
 * Conditional logger that only outputs debug and info logs in development
 */
const logger = {
  debug: (message: string, ...args: any[]) => {
    if (!isProduction()) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (!isProduction()) {
      console.info(`[INFO] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    console.warn(`[WARN] ${message}`, ...args);
  },
  
  error: (message: string, ...args: any[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  }
};

export default logger;