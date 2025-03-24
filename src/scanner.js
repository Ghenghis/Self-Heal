const fs = require('fs');
const path = require('path');
const glob = require('glob');
const PatternManager = require('./patterns');

class Scanner {
  constructor(projectPath, ai) {
    this.projectPath = projectPath;
    this.ai = ai;
    this.patternManager = new PatternManager();
    this.ignorePatterns = this.loadIgnorePatterns();
  }

  /**
   * Load patterns from .projecthealerignore or .gitignore
   * @returns {Array} - Patterns to ignore
   */
  loadIgnorePatterns() {
    const ignoreFiles = [
      path.join(this.projectPath, '.projecthealerignore'),
      path.join(this.projectPath, '.gitignore')
    ];

    let patterns = [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '**/*.min.js',
      '**/*.lock'
    ];

    for (const ignoreFile of ignoreFiles) {
      if (fs.existsSync(ignoreFile)) {
        const content = fs.readFileSync(ignoreFile, 'utf8');
        const lines = content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));
        patterns = patterns.concat(lines);
      }
    }

    return patterns;
  }

  /**
   * Scan the project for issues
   * @returns {Promise<Array>} - List of issues found
   */
  async scanProject() {
    console.log('Scanning project for issues...');
    const allIssues = [];

    // Get all files
    const files = glob.sync('**/*', {
      cwd: this.projectPath,
      ignore: this.ignorePatterns,
      nodir: true
    });

    console.log(`Found ${files.length} files to scan.`);

    // First, use pattern-based detection
    const patternIssues = await this.scanWithPatterns(files);
    allIssues.push(...patternIssues);
    
    // Then, select a subset of important files for AI analysis
    const importantFiles = this.selectImportantFiles(files);
    const aiIssues = await this.scanWithAI(importantFiles);
    allIssues.push(...aiIssues);

    // De-duplicate issues
    const uniqueIssues = this.deduplicateIssues(allIssues);
    
    console.log(`Found ${uniqueIssues.length} issues.`);
    return uniqueIssues;
  }

  /**
   * Scan files using pattern matching
   * @param {Array} files - List of files to scan
   * @returns {Promise<Array>} - List of issues found
   */
  async scanWithPatterns(files) {
    const issues = [];

    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileExt = path.extname(file).slice(1);
      
      const fileIssues = this.patternManager.findIssues(file, fileContent, fileExt);
      issues.push(...fileIssues);
    }

    return issues;
  }

  /**
   * Select important files for AI analysis
   * @param {Array} files - List of all files
   * @returns {Array} - List of important files
   */
  selectImportantFiles(files) {
    // Focus on configuration files and core code files
    const importantPatterns = [
      // Config files
      'package.json',
      'tsconfig.json',
      '.eslintrc*',
      'webpack.config.*',
      // Core files
      '**/index.*',
      '**/main.*',
      '**/app.*',
      '**/server.*'
    ];

    const importantFiles = [];
    
    // Add files matching important patterns
    for (const pattern of importantPatterns) {
      const matches = glob.sync(pattern, {
        cwd: this.projectPath,
        ignore: this.ignorePatterns
      });
      importantFiles.push(...matches);
    }
    
    // Add recently modified files
    const recentFiles = this.getMostRecentlyModifiedFiles(files, 5);
    importantFiles.push(...recentFiles);
    
    // Deduplicate
    return [...new Set(importantFiles)];
  }

  /**
   * Get most recently modified files
   * @param {Array} files - List of all files
   * @param {number} count - Number of files to return
   * @returns {Array} - List of recently modified files
   */
  getMostRecentlyModifiedFiles(files, count) {
    return files
      .map(file => ({
        file,
        mtime: fs.statSync(path.join(this.projectPath, file)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, count)
      .map(item => item.file);
  }

  /**
   * Scan files using AI analysis
   * @param {Array} files - List of files to scan
   * @returns {Promise<Array>} - List of issues found
   */
  async scanWithAI(files) {
    const issues = [];
    
    console.log(`Using AI to analyze ${files.length} important files...`);

    for (const file of files) {
      const filePath = path.join(this.projectPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const fileExt = path.extname(file).slice(1);
      
      try {
        const aiIssues = await this.ai.analyzeCode(file, fileContent, fileExt);
        
        // Format AI issues to match our issue format
        for (const aiIssue of aiIssues) {
          issues.push({
            file,
            line: aiIssue.line,
            message: aiIssue.description,
            severity: aiIssue.severity,
            source: 'ai',
            fix: {
              type: aiIssue.fix.type,
              original: aiIssue.fix.original,
              replacement: aiIssue.fix.replacement
            }
          });
        }
      } catch (error) {
        console.error(`Error analyzing ${file} with AI:`, error.message);
      }
    }

    return issues;
  }

  /**
   * Remove duplicate issues
   * @param {Array} issues - List of issues
   * @returns {Array} - Deduplicated list
   */
  deduplicateIssues(issues) {
    const uniqueIssues = [];
    const seen = new Set();
    
    for (const issue of issues) {
      const key = `${issue.file}-${issue.line}-${issue.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueIssues.push(issue);
      }
    }
    
    return uniqueIssues;
  }
}

module.exports = Scanner;