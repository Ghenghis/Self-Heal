const fs = require('fs');
const path = require('path');
const Scanner = require('./scanner');
const Healer = require('./healer');
const Validator = require('./validator');

/**
 * MultiPassHealer implements advanced healing strategies with multiple passes
 * and dependency resolution between issues.
 */
class MultiPassHealer {
  constructor(projectPath, ai) {
    this.projectPath = projectPath;
    this.ai = ai;
    this.scanner = new Scanner(projectPath, ai);
    this.healer = new Healer(projectPath, ai);
    this.validator = new Validator(projectPath);
    this.maxPasses = 3; // Maximum number of healing passes
  }

  /**
   * Apply fixes to issues with multiple passes and dependency resolution
   * @param {Array} initialIssues - List of issues to fix (optional)
   * @returns {Promise<Object>} - Results of healing
   */
  async applyFixes(initialIssues = null) {
    let issues = initialIssues;
    
    if (!issues) {
      console.log('No issues provided, scanning project...');
      issues = await this.scanner.scanProject();
    }
    
    // Sort issues by dependency (resolve leaf issues first)
    const sortedIssues = this.sortIssuesByDependency(issues);
    
    let allResults = {
      fixed: [],
      unfixed: [],
      passes: 0
    };
    
    // Perform multiple passes until all issues are fixed or max passes reached
    let remainingIssues = sortedIssues;
    let passNumber = 0;
    
    while (remainingIssues.length > 0 && passNumber < this.maxPasses) {
      passNumber++;
      console.log(`\n=== Healing Pass ${passNumber} ===`);
      console.log(`Attempting to fix ${remainingIssues.length} issues...`);
      
      // Apply fixes for this pass
      const results = await this.applySinglePass(remainingIssues);
      
      // Add results to overall results
      allResults.fixed.push(...results.fixed);
      allResults.unfixed.push(...results.unfixed);
      
      // Determine remaining issues
      if (results.fixed.length > 0) {
        // Re-scan to get new issues state after fixes
        const newIssues = await this.scanner.scanProject();
        
        // Keep only unfixed issues
        remainingIssues = this.filterRemainingIssues(newIssues, allResults.fixed);
        
        console.log(`Fixed ${results.fixed.length} issues in pass ${passNumber}`);
        console.log(`${remainingIssues.length} issues remaining`);
      } else {
        // No issues fixed in this pass, stop trying
        remainingIssues = [];
        console.log(`No issues fixed in pass ${passNumber}, stopping healing process`);
      }
    }
    
    allResults.passes = passNumber;
    
    // Generate summary
    console.log('\n=== Healing Summary ===');
    console.log(`Total passes: ${allResults.passes}`);
    console.log(`Issues fixed: ${allResults.fixed.length}`);
    console.log(`Issues not fixed: ${allResults.unfixed.length}`);
    
    return allResults;
  }

  /**
   * Apply a single healing pass with validation
   * @param {Array} issues - Issues to fix in this pass
   * @returns {Promise<Object>} - Results of healing pass
   */
  async applySinglePass(issues) {
    const results = {
      fixed: [],
      unfixed: []
    };
    
    // Group issues by file
    const issuesByFile = this.groupIssuesByFile(issues);
    
    // Process each file
    for (const file of Object.keys(issuesByFile)) {
      const fileIssues = issuesByFile[file];
      console.log(`Processing ${fileIssues.length} issues in ${file}...`);
      
      const filePath = path.join(this.projectPath, file);
      
      // Skip if file doesn't exist
      if (!fs.existsSync(filePath)) {
        for (const issue of fileIssues) {
          results.unfixed.push({
            ...issue,
            reason: 'File does not exist'
          });
        }
        continue;
      }
      
      // Read file content
      const originalContent = fs.readFileSync(filePath, 'utf8');
      let updatedContent = originalContent;
      
      // Track which issues were fixed
      const fixedIssues = [];
      
      // Sort issues by line number in reverse order
      const sortedIssues = [...fileIssues].sort((a, b) => b.line - a.line);
      
      // Apply fixes one by one with validation
      for (const issue of sortedIssues) {
        try {
          // Generate fix
          const fixedContent = await this.generateFix(
            file, updatedContent, issue
          );
          
          if (fixedContent !== updatedContent) {
            // Validate the fix
            const validationResult = await this.validator.validateFix(
              filePath, originalContent, fixedContent
            );
            
            if (validationResult.valid) {
              // Apply the fix
              updatedContent = fixedContent;
              fixedIssues.push(issue);
            } else {
              results.unfixed.push({
                ...issue,
                reason: `Validation failed: ${validationResult.reason}`
              });
            }
          } else {
            results.unfixed.push({
              ...issue,
              reason: 'Fix did not change file content'
            });
          }
        } catch (error) {
          console.error(`Error fixing issue in ${file}:${issue.line}:`, error.message);
          results.unfixed.push({
            ...issue,
            reason: `Error: ${error.message}`
          });
        }
      }
      
      // Write updated content if any fixes were applied
      if (updatedContent !== originalContent) {
        try {
          fs.writeFileSync(filePath, updatedContent);
          console.log(`✅ Fixed issues in ${file}`);
          results.fixed.push(...fixedIssues);
        } catch (error) {
          console.error(`Error writing to ${file}:`, error.message);
          // Add unfixed issues
          for (const issue of fixedIssues) {
            results.unfixed.push({
              ...issue,
              reason: `Error writing to file: ${error.message}`
            });
          }
        }
      } else {
        console.log(`⚠️ No changes made to ${file}`);
      }
    }
    
    return results;
  }

  /**
   * Generate a fix for an issue
   * @param {string} file - File with the issue
   * @param {string} content - Current file content
   * @param {Object} issue - Issue to fix
   * @returns {Promise<string>} - Fixed content
   */
  async generateFix(file, content, issue) {
    const fileExt = path.extname(file).slice(1);
    
    // Try to apply fix using pattern
    if (issue.source === 'pattern' && issue.fix) {
      return this.healer.applyPatternFix(content, issue.fix);
    }
    
    // Fall back to AI for more complex fixes
    return this.ai.generateFix(content, fileExt, issue);
  }

  /**
   * Group issues by file
   * @param {Array} issues - List of issues
   * @returns {Object} - Issues grouped by file
   */
  groupIssuesByFile(issues) {
    const grouped = {};
    
    for (const issue of issues) {
      if (!grouped[issue.file]) {
        grouped[issue.file] = [];
      }
      grouped[issue.file].push(issue);
    }
    
    return grouped;
  }

  /**
   * Sort issues by dependency (leaf issues first)
   * @param {Array} issues - List of issues
   * @returns {Array} - Sorted issues
   */
  sortIssuesByDependency(issues) {
    // Group issues by file
    const issuesByFile = this.groupIssuesByFile(issues);
    
    // Build a graph of issue dependencies
    const graph = this.buildDependencyGraph(issues);
    
    // Perform topological sort
    const visited = new Set();
    const sorted = [];
    
    // Visit each unvisited issue
    for (const issue of issues) {
      const issueKey = `${issue.file}:${issue.line}`;
      if (!visited.has(issueKey)) {
        this.visitIssue(issueKey, graph, visited, sorted);
      }
    }
    
    // Map sorted keys back to issues
    const issueMap = {};
    for (const issue of issues) {
      issueMap[`${issue.file}:${issue.line}`] = issue;
    }
    
    return sorted.map(key => issueMap[key]);
  }

  /**
   * Build a graph of issue dependencies
   * @param {Array} issues - List of issues
   * @returns {Object} - Dependency graph
   */
  buildDependencyGraph(issues) {
    const graph = {};
    
    // Initialize graph
    for (const issue of issues) {
      const issueKey = `${issue.file}:${issue.line}`;
      graph[issueKey] = [];
    }
    
    // Add dependencies
    for (const issue of issues) {
      const issueKey = `${issue.file}:${issue.line}`;
      
      // Find issues that this issue depends on
      // Currently using a simple heuristic: issues closer to the top of the file
      // might impact issues lower in the file
      for (const otherIssue of issues) {
        if (issue === otherIssue) continue;
        
        // If in the same file and above this issue
        if (issue.file === otherIssue.file && otherIssue.line < issue.line) {
          const otherKey = `${otherIssue.file}:${otherIssue.line}`;
          graph[issueKey].push(otherKey);
        }
      }
    }
    
    return graph;
  }

  /**
   * Visit an issue in the dependency graph (for topological sort)
   * @param {string} issueKey - Issue key
   * @param {Object} graph - Dependency graph
   * @param {Set} visited - Set of visited issues
   * @param {Array} sorted - Sorted issues
   */
  visitIssue(issueKey, graph, visited, sorted) {
    // Mark as temporarily visited
    visited.add(issueKey);
    
    // Visit dependencies
    for (const dependency of graph[issueKey] || []) {
      if (!visited.has(dependency)) {
        this.visitIssue(dependency, graph, visited, sorted);
      }
    }
    
    // Add to sorted list
    sorted.push(issueKey);
  }

  /**
   * Filter out issues that have been fixed
   * @param {Array} issues - List of issues
   * @param {Array} fixedIssues - List of fixed issues
   * @returns {Array} - Remaining issues
   */
  filterRemainingIssues(issues, fixedIssues) {
    // Create a set of fixed issue keys
    const fixedKeys = new Set();
    for (const issue of fixedIssues) {
      fixedKeys.add(`${issue.file}:${issue.line}:${issue.message}`);
    }
    
    // Filter out fixed issues
    return issues.filter(issue => {
      const key = `${issue.file}:${issue.line}:${issue.message}`;
      return !fixedKeys.has(key);
    });
  }
}

module.exports = MultiPassHealer;