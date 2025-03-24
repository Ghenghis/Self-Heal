const fs = require('fs');
const path = require('path');

/**
 * RollbackManager provides functionality to safely apply fixes with
 * backup and rollback capabilities.
 */
class RollbackManager {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.backupDir = path.join(projectPath, '.project-healer-backups');
    this.backupLog = path.join(this.backupDir, 'backup-log.json');
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    if (!fs.existsSync(this.backupLog)) {
      fs.writeFileSync(this.backupLog, JSON.stringify({
        backups: [],
        sessions: []
      }, null, 2));
    }
  }

  /**
   * Start a healing session with transaction support
   * @returns {string} - Session ID
   */
  startSession() {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Add session to log
    const log = this.getBackupLog();
    log.sessions.push({
      id: sessionId,
      startTime: new Date().toISOString(),
      files: [],
      status: 'in_progress'
    });
    this.saveBackupLog(log);
    
    return sessionId;
  }

  /**
   * End a healing session
   * @param {string} sessionId - Session ID
   * @param {boolean} success - Whether the session was successful
   */
  endSession(sessionId, success) {
    const log = this.getBackupLog();
    const session = log.sessions.find(s => s.id === sessionId);
    
    if (session) {
      session.endTime = new Date().toISOString();
      session.status = success ? 'completed' : 'rolled_back';
      
      // If successful, remove backups for this session
      if (success) {
        this.cleanupBackups(sessionId);
      }
      
      this.saveBackupLog(log);
    }
  }

  /**
   * Backup a file before making changes
   * @param {string} filePath - Path to the file relative to project root
   * @param {string} sessionId - Current session ID
   * @returns {string} - Backup ID
   */
  backupFile(filePath, sessionId) {
    const fullPath = path.join(this.projectPath, filePath);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    
    // Generate backup ID
    const backupId = `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create backup file name
    const backupName = `${backupId}-${path.basename(filePath)}`;
    const backupPath = path.join(this.backupDir, backupName);
    
    // Copy file to backup
    fs.copyFileSync(fullPath, backupPath);
    
    // Update backup log
    const log = this.getBackupLog();
    
    // Add backup to log
    log.backups.push({
      id: backupId,
      originalFile: filePath,
      backupFile: backupName,
      timestamp: new Date().toISOString(),
      sessionId
    });
    
    // Add file to session
    const session = log.sessions.find(s => s.id === sessionId);
    if (session && !session.files.includes(filePath)) {
      session.files.push(filePath);
    }
    
    this.saveBackupLog(log);
    
    return backupId;
  }

  /**
   * Safely apply a fix with rollback capability
   * @param {string} filePath - Path to the file relative to project root
   * @param {string} newContent - New content to write
   * @param {string} sessionId - Current session ID
   * @returns {Object} - Result of the operation
   */
  applyFix(filePath, newContent, sessionId) {
    const fullPath = path.join(this.projectPath, filePath);
    
    try {
      // Backup the file first
      const backupId = this.backupFile(filePath, sessionId);
      
      // Write new content
      fs.writeFileSync(fullPath, newContent);
      
      return {
        success: true,
        backupId
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Rollback a single file to its backup
   * @param {string} backupId - Backup ID
   * @returns {boolean} - Success status
   */
  rollbackFile(backupId) {
    const log = this.getBackupLog();
    const backup = log.backups.find(b => b.id === backupId);
    
    if (!backup) {
      console.error(`Backup not found: ${backupId}`);
      return false;
    }
    
    const backupPath = path.join(this.backupDir, backup.backupFile);
    const originalPath = path.join(this.projectPath, backup.originalFile);
    
    try {
      // Copy backup back to original location
      fs.copyFileSync(backupPath, originalPath);
      return true;
    } catch (error) {
      console.error(`Error rolling back ${backup.originalFile}:`, error.message);
      return false;
    }
  }

  /**
   * Rollback all changes in a session
   * @param {string} sessionId - Session ID
   * @returns {Object} - Rollback statistics
   */
  rollbackSession(sessionId) {
    const log = this.getBackupLog();
    const backups = log.backups.filter(b => b.sessionId === sessionId);
    
    // Sort backups in reverse chronological order
    backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    let succeeded = 0;
    let failed = 0;
    
    // Rollback each file
    for (const backup of backups) {
      const result = this.rollbackFile(backup.id);
      if (result) {
        succeeded++;
      } else {
        failed++;
      }
    }
    
    // Update session status
    const session = log.sessions.find(s => s.id === sessionId);
    if (session) {
      session.status = 'rolled_back';
      session.endTime = new Date().toISOString();
      this.saveBackupLog(log);
    }
    
    return {
      succeeded,
      failed,
      total: backups.length
    };
  }

  /**
   * Clean up backups for a session
   * @param {string} sessionId - Session ID
   */
  cleanupBackups(sessionId) {
    const log = this.getBackupLog();
    const backups = log.backups.filter(b => b.sessionId === sessionId);
    
    // Delete backup files
    for (const backup of backups) {
      const backupPath = path.join(this.backupDir, backup.backupFile);
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
    }
    
    // Remove backups from log
    log.backups = log.backups.filter(b => b.sessionId !== sessionId);
    this.saveBackupLog(log);
  }

  /**
   * Get backup log
   * @returns {Object} - Backup log
   */
  getBackupLog() {
    try {
      const content = fs.readFileSync(this.backupLog, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Error reading backup log:', error.message);
      return { backups: [], sessions: [] };
    }
  }

  /**
   * Save backup log
   * @param {Object} log - Backup log
   */
  saveBackupLog(log) {
    try {
      fs.writeFileSync(this.backupLog, JSON.stringify(log, null, 2));
    } catch (error) {
      console.error('Error saving backup log:', error.message);
    }
  }
}

module.exports = RollbackManager;