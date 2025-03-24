const fs = require('fs');
const path = require('path');

class PatternManager {
  constructor() {
    this.patterns = this.loadPatterns();
    this.customPatterns = [];
  }

  /**
   * Load patterns from the patterns directory
   * @returns {Object} - Loaded patterns
   */
  loadPatterns() {
    const patterns = {};
    const patternsDir = path.join(__dirname, '..', 'patterns');
    
    if (fs.existsSync(patternsDir)) {
      const files = fs.readdirSync(patternsDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const category = path.basename(file, '.json');
          try {
            const content = fs.readFileSync(path.join(patternsDir, file), 'utf8');
            patterns[category] = JSON.parse(content);
          } catch (error) {
            console.error(`Error loading pattern file ${file}:`, error.message);
          }
        }
      }
    }
    
    return patterns;
  }

  /**
   * Save learned patterns
   * @param {Array} newPatterns - New patterns to save
   */
  saveLearnedPatterns(newPatterns) {
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
    
    // Merge patterns
    const mergedPatterns = [...existingPatterns, ...newPatterns];
    
    // De-duplicate
    const uniquePatterns = this.deduplicatePatterns(mergedPatterns);
    
    try {
      fs.writeFileSync(learnedPath, JSON.stringify(uniquePatterns, null, 2));
      console.log(`Saved ${newPatterns.length} new learned patterns.`);
      
      // Update in-memory patterns
      this.patterns['learned-patterns'] = uniquePatterns;
    } catch (error) {
      console.error('Error saving learned patterns:', error.message);
    }
  }

  /**
   * Add custom patterns for the current run
   * @param {Array} patterns - Custom patterns to add
   */
  addCustomPatterns(patterns) {
    this.customPatterns = patterns;
  }

  /**
   * Find issues in a file using patterns
   * @param {string} filePath - Path to the file
   * @param {string} content - Content of the file
   * @param {string} fileExt - File extension
   * @returns {Array} - List of issues found
   */
  findIssues(filePath, content, fileExt) {
    const issues = [];
    const lines = content.split('\n');
    
    // Apply both built-in and custom patterns
    const allPatterns = [...this.getAllBuiltInPatterns(), ...this.customPatterns];
    
    for (const pattern of allPatterns) {
      // Check if pattern applies to this file type
      if (pattern.fileTypes.includes(fileExt) || pattern.fileTypes.includes('*')) {
        try {
          const regex = new RegExp(pattern.regex, 'g');
          let match;
          
          // Find all matches
          while ((match = regex.exec(content)) !== null) {
            // Calculate line number
            const lineNumber = this.getLineNumber(content, match.index);
            
            issues.push({
              file: filePath,
              line: lineNumber,
              message: pattern.message,
              severity: pattern.severity || 'medium',
              source: 'pattern',
              pattern: pattern.id,
              fix: pattern.fix ? {
                type: pattern.fix.type,
                find: pattern.fix.find,
                replace: pattern.fix.replace,
                // Replace placeholders in the pattern
                replacement: this.replacePlaceholders(pattern.fix.replace, match)
              } : null
            });
          }
        } catch (error) {
          console.error(`Error applying pattern ${pattern.id}:`, error.message);
        }
      }
    }
    
    return issues;
  }

  /**
   * Get all built-in patterns as a flat array
   * @returns {Array} - All patterns
   */
  getAllBuiltInPatterns() {
    const allPatterns = [];
    
    for (const category in this.patterns) {
      if (Array.isArray(this.patterns[category].patterns)) {
        for (const pattern of this.patterns[category].patterns) {
          // Add category info
          pattern.category = category;
          allPatterns.push(pattern);
        }
      }
    }
    
    return allPatterns;
  }

  /**
   * Get line number from character index
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} - Line number (1-based)
   */
  getLineNumber(content, index) {
    const lines = content.substring(0, index).split('\n');
    return lines.length;
  }

  /**
   * Replace placeholders in fix template
   * @param {string} template - Template string
   * @param {Object} match - Regex match object
   * @returns {string} - String with placeholders replaced
   */
  replacePlaceholders(template, match) {
    let result = template;
    
    // Replace {{match.N}} with capture groups
    for (let i = 0; i < match.length; i++) {
      result = result.replace(new RegExp(`{{match\\.${i}}}`, 'g'), match[i] || '');
    }
    
    return result;
  }

  /**
   * Remove duplicate patterns
   * @param {Array} patterns - List of patterns
   * @returns {Array} - Deduplicated list
   */
  deduplicatePatterns(patterns) {
    const uniquePatterns = [];
    const seen = new Set();
    
    for (const pattern of patterns) {
      const key = `${pattern.regex}-${pattern.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniquePatterns.push(pattern);
      }
    }
    
    return uniquePatterns;
  }
}

module.exports = PatternManager;