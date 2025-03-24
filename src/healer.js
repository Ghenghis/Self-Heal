const fs = require('fs');
const path = require('path');

class Healer {
  constructor(projectPath, ai) {
    this.projectPath = projectPath;
    this.ai = ai;
  }

  /**
   * Apply fixes to issues
   * @param {Array} issues - List of issues to fix
   * @returns {Object} - Results of healing
   */
  async applyFixes(issues) {
    const results = {
      fixed: [],
      unfixed: []
    };

    // Group issues by file
    const issuesByFile = this.groupIssuesByFile(issues);
    
    // Process files in reverse order of issues
    // This ensures we fix files with more issues first
    const sortedFiles = Object.keys(issuesByFile).sort(
      (a, b) => issuesByFile[b].length - issuesByFile[a].length
    );
    
    for (const file of sortedFiles) {
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
      let content = fs.readFileSync(filePath, 'utf8');
      const originalContent = content;
      
      // Get file extension
      const fileExt = path.extname(file).slice(1);
      
      // Sort issues by line number in reverse order
      // This ensures we fix issues from bottom to top to avoid offsetting line numbers
      const sortedIssues = [...fileIssues].sort((a, b) => b.line - a.line);
      
      // Apply fixes
      for (const issue of sortedIssues) {
        try {
          // Try to apply fix using pattern
          if (issue.source === 'pattern' && issue.fix) {
            const fixed = this.applyPatternFix(content, issue.fix);
            if (fixed !== content) {
              content = fixed;
              results.fixed.push(issue);
              continue;
            }
          }
          
          // Fall back to AI for more complex fixes
          const aiFixed = await this.ai.generateFix(content, fileExt, issue);
          if (aiFixed !== content) {
            content = aiFixed;
            results.fixed.push(issue);
          } else {
            results.unfixed.push({
              ...issue,
              reason: 'Fix could not be applied'
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
      
      // Only write file if we made changes
      if (content !== originalContent) {
        try {
          fs.writeFileSync(filePath, content);
          console.log(`✅ Fixed issues in ${file}`);
        } catch (error) {
          console.error(`Error writing to ${file}:`, error.message);
          // Move all fixed issues for this file back to unfixed
          const fixedIndices = [];
          for (let i = 0; i < results.fixed.length; i++) {
            if (results.fixed[i].file === file) {
              fixedIndices.push(i);
              results.unfixed.push({
                ...results.fixed[i],
                reason: `Error writing to file: ${error.message}`
              });
            }
          }
          
          // Remove from fixed (in reverse order to maintain indices)
          for (let i = fixedIndices.length - 1; i >= 0; i--) {
            results.fixed.splice(fixedIndices[i], 1);
          }
        }
      } else {
        console.log(`⚠️ No changes made to ${file}`);
      }
    }
    
    return results;
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
   * Apply pattern fix to content
   * @param {string} content - File content
   * @param {Object} fix - Fix details
   * @returns {string} - Fixed content
   */
  applyPatternFix(content, fix) {
    if (!fix) return content;
    
    try {
      if (fix.type === 'replace') {
        const regex = new RegExp(fix.find, 'g');
        return content.replace(regex, fix.replacement);
      } else if (fix.type === 'insert') {
        const lines = content.split('\n');
        lines.splice(fix.line, 0, fix.replacement);
        return lines.join('\n');
      } else if (fix.type === 'delete') {
        const lines = content.split('\n');
        lines.splice(fix.line - 1, 1);
        return lines.join('\n');
      }
    } catch (error) {
      console.error('Error applying pattern fix:', error.message);
    }
    
    return content;
  }
}

module.exports = Healer;