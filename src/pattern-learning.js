/**
 * Pattern Learning Module
 * 
 * This module enhances the AI's ability to learn patterns from code fixes,
 * track confidence scores, and generate new patterns automatically.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class PatternLearning {
  constructor(ai, patternManager) {
    this.ai = ai;
    this.patternManager = patternManager;
    this.confidence = this.loadConfidenceScores();
    this.fixAttempts = [];
    this.historyLimit = 1000; // Maximum number of fix attempts to track
  }

  /**
   * Load confidence scores for patterns
   * @returns {Object} - Confidence scores by pattern ID
   */
  loadConfidenceScores() {
    const confidencePath = path.join(__dirname, '..', 'data', 'confidence-scores.json');
    
    if (fs.existsSync(confidencePath)) {
      try {
        return JSON.parse(fs.readFileSync(confidencePath, 'utf8'));
      } catch (error) {
        console.error('Error loading confidence scores:', error.message);
      }
    }
    
    return {};
  }

  /**
   * Save confidence scores
   */
  saveConfidenceScores() {
    const dataDir = path.join(__dirname, '..', 'data');
    const confidencePath = path.join(dataDir, 'confidence-scores.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    try {
      fs.writeFileSync(confidencePath, JSON.stringify(this.confidence, null, 2));
    } catch (error) {
      console.error('Error saving confidence scores:', error.message);
    }
  }

  /**
   * Record a fix attempt and its outcome
   * @param {Object} issue - The issue that was fixed
   * @param {boolean} success - Whether the fix was successful
   * @param {string} fileContent - Original file content
   * @param {string} fixedContent - Fixed file content
   */
  recordFixAttempt(issue, success, fileContent, fixedContent) {
    // Record anonymous fix data
    const fixAttempt = {
      patternId: issue.pattern,
      fileType: path.extname(issue.file).slice(1),
      success,
      timestamp: new Date().toISOString(),
      // Generate a hash of the code to ensure privacy
      codeHash: this.hashContent(fileContent),
      // Only if successful, store the diff for learning
      diff: success ? this.generateDiff(fileContent, fixedContent) : null
    };
    
    // Add to history
    this.fixAttempts.push(fixAttempt);
    if (this.fixAttempts.length > this.historyLimit) {
      this.fixAttempts.shift(); // Remove oldest entry
    }
    
    // Update confidence scores
    if (issue.pattern) {
      if (!this.confidence[issue.pattern]) {
        this.confidence[issue.pattern] = {
          success: 0,
          attempts: 0
        };
      }
      
      this.confidence[issue.pattern].attempts++;
      if (success) {
        this.confidence[issue.pattern].success++;
      }
      
      this.saveConfidenceScores();
    }
    
    // Save fix attempts for learning
    this.saveFixAttempts();
  }

  /**
   * Save fix attempts to file
   */
  saveFixAttempts() {
    const dataDir = path.join(__dirname, '..', 'data');
    const attemptsPath = path.join(dataDir, 'fix-attempts.json');
    
    // Ensure data directory exists
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    try {
      fs.writeFileSync(attemptsPath, JSON.stringify(this.fixAttempts, null, 2));
    } catch (error) {
      console.error('Error saving fix attempts:', error.message);
    }
  }

  /**
   * Hash content for anonymity
   * @param {string} content - Content to hash
   * @returns {string} - Hash
   */
  hashContent(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Generate a diff between original and fixed content
   * @param {string} original - Original content
   * @param {string} fixed - Fixed content
   * @returns {Object} - Diff object
   */
  generateDiff(original, fixed) {
    // Simple diff implementation - in reality, would use a proper diff library
    return {
      original: original.length > 100 ? original.substring(0, 100) + '...' : original,
      fixed: fixed.length > 100 ? fixed.substring(0, 100) + '...' : fixed
    };
  }

  /**
   * Get confidence score for a pattern
   * @param {string} patternId - Pattern ID
   * @returns {number} - Confidence score (0-1)
   */
  getConfidenceScore(patternId) {
    if (!this.confidence[patternId]) {
      return 0.5; // Default confidence
    }
    
    const pattern = this.confidence[patternId];
    if (pattern.attempts === 0) {
      return 0.5;
    }
    
    return pattern.success / pattern.attempts;
  }

  /**
   * Learn new patterns from successful fixes
   * @returns {Promise<Array>} - New patterns learned
   */
  async learnNewPatterns() {
    console.log('Analyzing fix history to learn new patterns...');
    
    // Get successful fixes with diffs
    const successfulFixes = this.fixAttempts.filter(fix => fix.success && fix.diff);
    
    if (successfulFixes.length < 5) {
      console.log('Not enough successful fixes to learn new patterns yet');
      return [];
    }
    
    // Group by file type
    const fixesByType = {};
    for (const fix of successfulFixes) {
      if (!fixesByType[fix.fileType]) {
        fixesByType[fix.fileType] = [];
      }
      fixesByType[fix.fileType].push(fix);
    }
    
    // Learn patterns for each file type
    const newPatterns = [];
    
    for (const [fileType, fixes] of Object.entries(fixesByType)) {
      if (fixes.length < 3) {
        continue; // Need at least 3 examples to learn a pattern
      }
      
      // Prepare data for AI analysis
      const fixData = fixes.map(fix => ({
        diff: fix.diff,
        patternId: fix.patternId
      }));
      
      // Use AI to generate patterns
      try {
        const patterns = await this.ai.generatePatterns(fileType, fixData);
        
        // Validate and add new patterns
        for (const pattern of patterns) {
          if (this.isValidPattern(pattern)) {
            // Check if it's truly a new pattern
            if (this.isNewPattern(pattern)) {
              // Set initial confidence
              pattern.initialConfidence = 0.6; // Start with moderate confidence
              newPatterns.push(pattern);
            }
          }
        }
      } catch (error) {
        console.error(`Error learning patterns for ${fileType}:`, error.message);
      }
    }
    
    // Save new patterns
    if (newPatterns.length > 0) {
      await this.saveNewPatterns(newPatterns);
      console.log(`Learned ${newPatterns.length} new patterns!`);
    } else {
      console.log('No new patterns learned from fix history');
    }
    
    return newPatterns;
  }

  /**
   * Check if a pattern is valid
   * @param {Object} pattern - Pattern object
   * @returns {boolean} - Whether the pattern is valid
   */
  isValidPattern(pattern) {
    return (
      pattern &&
      pattern.id &&
      pattern.regex &&
      pattern.message &&
      pattern.severity &&
      Array.isArray(pattern.fileTypes) &&
      pattern.fileTypes.length > 0
    );
  }

  /**
   * Check if a pattern is new
   * @param {Object} pattern - Pattern object
   * @returns {boolean} - Whether the pattern is new
   */
  isNewPattern(pattern) {
    // Get all existing patterns
    const existingPatterns = this.patternManager.getAllBuiltInPatterns();
    
    // Check if pattern with this ID already exists
    const existingIds = existingPatterns.map(p => p.id);
    if (existingIds.includes(pattern.id)) {
      return false;
    }
    
    // Check if a very similar regex already exists
    for (const existing of existingPatterns) {
      if (existing.regex === pattern.regex) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Save new patterns
   * @param {Array} patterns - New patterns
   */
  async saveNewPatterns(patterns) {
    // Group patterns by file type
    const patternsByType = {};
    
    for (const pattern of patterns) {
      const primaryType = pattern.fileTypes[0];
      if (!patternsByType[primaryType]) {
        patternsByType[primaryType] = [];
      }
      patternsByType[primaryType].push(pattern);
    }
    
    // Save to learned-patterns.json
    const learnedPath = path.join(__dirname, '..', 'patterns', 'learned-patterns.json');
    
    let existingPatterns = [];
    if (fs.existsSync(learnedPath)) {
      try {
        const content = fs.readFileSync(learnedPath, 'utf8');
        existingPatterns = JSON.parse(content);
      } catch (error) {
        console.error('Error reading existing learned patterns:', error.message);
      }
    }
    
    // Add new patterns
    const mergedPatterns = [...existingPatterns, ...patterns];
    
    try {
      fs.writeFileSync(learnedPath, JSON.stringify(mergedPatterns, null, 2));
      console.log(`Saved ${patterns.length} new learned patterns.`);
    } catch (error) {
      console.error('Error saving learned patterns:', error.message);
    }
  }
}

module.exports = PatternLearning;