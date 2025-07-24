const fs = require('fs');

class Logger {
  constructor(sessionId = null) {
    const date = new Date().toISOString().split('T')[0];
    this.sessionId = sessionId || this.generateSessionId();
    this.logFile = `./logs/publish-${date}.log`;
    this.sessionFile = `./logs/session-${this.sessionId}.log`;
    
    // 确保日志目录存在
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
    
    this.startSession();
  }
  
  generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  startSession() {
    const timestamp = new Date().toISOString();
    const sessionStart = `\n${'='.repeat(80)}\n[${timestamp}] SESSION_START: ${this.sessionId}\n${'='.repeat(80)}\n`;
    
    try {
      fs.appendFileSync(this.logFile, sessionStart);
      fs.appendFileSync(this.sessionFile, sessionStart);
    } catch (error) {
      console.warn('日志写入失败:', error.message);
    }
  }
  
  log(level, category, message, details = null) {
    const timestamp = new Date().toISOString();
    const sessionInfo = `[SESSION:${this.sessionId}]`;
    
    let logEntry = `[${timestamp}] ${sessionInfo} [${level}] [${category}] ${message}`;
    
    if (details) {
      logEntry += `\n    详细信息: ${JSON.stringify(details, null, 2)}`;
    }
    
    logEntry += '\n';
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
      fs.appendFileSync(this.sessionFile, logEntry);
    } catch (error) {
      console.warn('日志写入失败:', error.message);
    }
    
    // 同时输出到控制台（开发环境）
    console.log(`[${level}] [${category}] ${message}`);
  }
  
  // 不同级别的日志方法
  info(category, message, details = null) { 
    this.log('INFO', category, message, details); 
  }
  
  warn(category, message, details = null) { 
    this.log('WARN', category, message, details); 
  }
  
  error(category, message, details = null) { 
    this.log('ERROR', category, message, details); 
  }
  
  debug(category, message, details = null) { 
    this.log('DEBUG', category, message, details); 
  }
  
  // 进度日志专用方法
  progress(step, total, message, percent = null) {
    const progressPercent = percent || Math.round((step / total) * 100);
    const progressMessage = `步骤 ${step}/${total} (${progressPercent}%) - ${message}`;
    
    this.log('PROGRESS', 'PUBLISH', progressMessage, {
      step,
      total,
      percent: progressPercent,
      message
    });
  }
  
  // 文件操作日志
  fileOperation(operation, filePath, result = 'SUCCESS', details = null) {
    this.log('FILE', operation, `${result}: ${filePath}`, details);
  }
  
  // 网络操作日志
  networkOperation(operation, url, result = 'SUCCESS', details = null) {
    this.log('NETWORK', operation, `${result}: ${url}`, details);
  }
  
  // Git操作日志
  gitOperation(operation, result = 'SUCCESS', details = null) {
    this.log('GIT', operation, result, details);
  }
  
  // 结束会话
  endSession(result = 'SUCCESS', summary = null) {
    const timestamp = new Date().toISOString();
    const sessionEnd = `\n[${timestamp}] SESSION_END: ${this.sessionId} - ${result}\n`;
    
    if (summary) {
      const summaryText = `会话总结:\n${JSON.stringify(summary, null, 2)}\n`;
      try {
        fs.appendFileSync(this.logFile, summaryText);
        fs.appendFileSync(this.sessionFile, summaryText);
      } catch (error) {
        console.warn('日志写入失败:', error.message);
      }
    }
    
    const endMarker = `${'='.repeat(80)}\n\n`;
    
    try {
      fs.appendFileSync(this.logFile, sessionEnd + endMarker);
      fs.appendFileSync(this.sessionFile, sessionEnd + endMarker);
    } catch (error) {
      console.warn('日志写入失败:', error.message);
    }
  }
}

module.exports = Logger;