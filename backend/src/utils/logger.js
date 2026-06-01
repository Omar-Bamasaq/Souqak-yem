import fs from 'fs';
import path from 'path';

class Logger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir();
  }

  ensureLogDir() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getLogFile() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `app-${date}.log`);
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
    return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}`;
  }

  writeLog(level, message, meta) {
    const logMessage = this.formatMessage(level, message, meta);
    const logFile = this.getLogFile();
    
    try {
      fs.appendFileSync(logFile, logMessage + '\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  error(message, meta = {}) {
    this.writeLog('error', message, meta);
    console.error(`ERROR: ${message}`, meta);
  }

  warn(message, meta = {}) {
    this.writeLog('warn', message, meta);
    console.warn(`WARN: ${message}`, meta);
  }

  info(message, meta = {}) {
    this.writeLog('info', message, meta);
    console.info(`INFO: ${message}`, meta);
  }

  debug(message, meta = {}) {
    if (process.env.NODE_ENV === 'development') {
      this.writeLog('debug', message, meta);
      console.debug(`DEBUG: ${message}`, meta);
    }
  }
}

export const logger = new Logger();
