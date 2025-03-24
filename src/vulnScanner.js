/**
 * Vulnerability Scanner for Self-Heal
 * 
 * This module scans project files for common security vulnerabilities
 * and provides automatic fixes. It uses pattern matching and the Claude API
 * to identify and remediate potential security issues.
 */

const fs = require('fs');
const path = require('path');
const { analyzeWithAI } = require('./ai');
const { applyFix } = require('./healer');
const { getPatterns, saveNewPattern } = require('./patterns');

/**
 * Security vulnerability categories
 */
const VULN_CATEGORIES = {
  INJECTION: 'injection',
  XSS: 'cross-site-scripting',
  SSRF: 'server-side-request-forgery',
  PATH_TRAVERSAL: 'path-traversal',
  INSECURE_DEPS: 'insecure-dependencies',
  HARDCODED_SECRETS: 'hardcoded-secrets',
  INSECURE_RANDOM: 'insecure-randomness',
  UNVALIDATED_REDIRECTS: 'unvalidated-redirects',
  DESERIALIZATION: 'insecure-deserialization'
};

/**
 * Scan a file for security vulnerabilities
 * @param {string} filePath - Path to the file
 * @param {Object} options - Scanning options
 * @returns {Array} - List of detected vulnerabilities
 */
async function scanFile(filePath, options = {}) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const fileExt = path.extname(filePath).substring(1);
  const vulnerabilities = [];

  // Get security patterns for this file type
  const patterns = getPatterns('security');
  const filePatterns = patterns.filter(pattern => 
    pattern.fileTypes.includes(fileExt) || pattern.fileTypes.includes('*')
  );

  // Apply pattern-based detection
  for (const pattern of filePatterns) {
    const regex = new RegExp(pattern.regex, 'g');
    let match;
    
    while ((match = regex.exec(fileContent)) !== null) {
      vulnerabilities.push({
        file: filePath,
        line: getLineNumber(fileContent, match.index),
        pattern: pattern.id,
        category: pattern.category,
        description: pattern.description,
        severity: pattern.severity,
        match: match[0],
        fix: pattern.fix
      });
    }
  }

  // Use Claude AI for more complex vulnerability detection
  if (options.useAI) {
    try {
      const aiAnalysis = await analyzeWithAI('security', fileContent, fileExt);
      
      if (aiAnalysis.vulnerabilities && aiAnalysis.vulnerabilities.length > 0) {
        for (const vuln of aiAnalysis.vulnerabilities) {
          // Add line numbers and context
          const lineNum = getLineNumber(fileContent, fileContent.indexOf(vuln.code));
          
          vulnerabilities.push({
            file: filePath,
            line: lineNum,
            category: vuln.category,
            description: vuln.description,
            severity: vuln.severity || 'medium',
            match: vuln.code,
            aiGenerated: true,
            fix: vuln.fix
          });
          
          // Learn new patterns from AI-detected vulnerabilities
          if (options.learnPatterns && vuln.pattern) {
            saveNewPattern('security', {
              id: `ai_${vuln.category}_${Date.now()}`,
              fileTypes: [fileExt],
              regex: escapeRegExp(vuln.code),
              category: vuln.category,
              description: vuln.description,
              severity: vuln.severity || 'medium',
              fix: vuln.fix
            });
          }
        }
      }
    } catch (error) {
      console.error(`AI analysis failed for ${filePath}:`, error.message);
    }
  }

  return vulnerabilities;
}

/**
 * Scans an entire project for security vulnerabilities
 * @param {string} projectPath - Path to the project
 * @param {Object} options - Scanning options
 * @returns {Array} - List of all detected vulnerabilities
 */
async function scanProject(projectPath, options = {}) {
  const allVulnerabilities = [];
  const files = getAllProjectFiles(projectPath, options.exclude || []);
  
  for (const file of files) {
    const fileVulns = await scanFile(file, options);
    allVulnerabilities.push(...fileVulns);
  }
  
  // Sort by severity
  return allVulnerabilities.sort((a, b) => {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return severityOrder[a.severity] - severityOrder[b.severity];
  });
}

/**
 * Fix detected vulnerabilities
 * @param {Array} vulnerabilities - List of vulnerabilities to fix
 * @param {Object} options - Fix options
 * @returns {Object} - Results of fixing process
 */
async function fixVulnerabilities(vulnerabilities, options = {}) {
  const results = {
    total: vulnerabilities.length,
    fixed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const vuln of vulnerabilities) {
    // Skip vulnerabilities that should not be fixed automatically
    if (options.skipSeverity && options.skipSeverity.includes(vuln.severity)) {
      results.skipped++;
      results.details.push({
        file: vuln.file,
        line: vuln.line,
        status: 'skipped',
        reason: `Skipped ${vuln.severity} severity`
      });
      continue;
    }
    
    try {
      const fixed = await applyFix(vuln.file, vuln);
      
      if (fixed) {
        results.fixed++;
        results.details.push({
          file: vuln.file,
          line: vuln.line,
          status: 'fixed',
          description: vuln.description
        });
      } else {
        results.failed++;
        results.details.push({
          file: vuln.file,
          line: vuln.line,
          status: 'failed',
          description: vuln.description,
          reason: 'Fix could not be applied'
        });
      }
    } catch (error) {
      results.failed++;
      results.details.push({
        file: vuln.file,
        line: vuln.line,
        status: 'error',
        description: vuln.description,
        reason: error.message
      });
    }
  }
  
  return results;
}

/**
 * Generate a security report
 * @param {Array} vulnerabilities - List of vulnerabilities
 * @param {Object} fixResults - Results of fixing process
 * @returns {string} - Markdown report
 */
function generateSecurityReport(vulnerabilities, fixResults) {
  let report = `# Security Vulnerability Report\n\n`;
  
  // Summary
  report += `## Summary\n\n`;
  report += `- **Total vulnerabilities:** ${vulnerabilities.length}\n`;
  
  const severityCounts = vulnerabilities.reduce((counts, vuln) => {
    counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
    return counts;
  }, {});
  
  if (severityCounts.critical) report += `- **Critical:** ${severityCounts.critical}\n`;
  if (severityCounts.high) report += `- **High:** ${severityCounts.high}\n`;
  if (severityCounts.medium) report += `- **Medium:** ${severityCounts.medium}\n`;
  if (severityCounts.low) report += `- **Low:** ${severityCounts.low}\n`;
  
  // Fix results
  if (fixResults) {
    report += `\n## Fix Results\n\n`;
    report += `- **Fixed:** ${fixResults.fixed}\n`;
    report += `- **Failed:** ${fixResults.failed}\n`;
    report += `- **Skipped:** ${fixResults.skipped}\n`;
  }
  
  // Vulnerability details
  report += `\n## Vulnerabilities\n\n`;
  
  for (const severity of ['critical', 'high', 'medium', 'low']) {
    const vulnsOfSeverity = vulnerabilities.filter(v => v.severity === severity);
    
    if (vulnsOfSeverity.length > 0) {
      report += `\n### ${severity.charAt(0).toUpperCase() + severity.slice(1)} Severity\n\n`;
      
      for (const vuln of vulnsOfSeverity) {
        report += `#### ${vuln.category} in ${path.basename(vuln.file)}:${vuln.line}\n\n`;
        report += `- **File:** \`${vuln.file}\`\n`;
        report += `- **Line:** ${vuln.line}\n`;
        report += `- **Description:** ${vuln.description}\n`;
        
        if (vuln.match) {
          report += `- **Code:**\n\`\`\`\n${vuln.match}\n\`\`\`\n`;
        }
        
        if (fixResults) {
          const fixDetail = fixResults.details.find(d => 
            d.file === vuln.file && d.line === vuln.line
          );
          
          if (fixDetail) {
            report += `- **Status:** ${fixDetail.status}\n`;
            if (fixDetail.reason) {
              report += `- **Reason:** ${fixDetail.reason}\n`;
            }
          }
        }
        
        report += `\n`;
      }
    }
  }
  
  return report;
}

/**
 * Get line number from character position
 * @param {string} content - File content
 * @param {number} position - Character position
 * @returns {number} - Line number
 */
function getLineNumber(content, position) {
  const lines = content.slice(0, position).split('\n');
  return lines.length;
}

/**
 * Get all project files
 * @param {string} dir - Directory path
 * @param {Array} exclude - Patterns to exclude
 * @returns {Array} - List of file paths
 */
function getAllProjectFiles(dir, exclude = []) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      // Skip excluded paths
      if (exclude.some(pattern => fullPath.includes(pattern))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

/**
 * Escape string for use in regex
 * @param {string} string - String to escape
 * @returns {string} - Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  scanFile,
  scanProject,
  fixVulnerabilities,
  generateSecurityReport,
  VULN_CATEGORIES
};
