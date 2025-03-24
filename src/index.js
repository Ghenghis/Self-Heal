#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const Scanner = require('./scanner');
const Healer = require('./healer');
const ClaudeAI = require('./ai');
const PatternManager = require('./patterns');

// Get API key from environment variable
const apiKey = process.env.CLAUDE_API_KEY;
if (!apiKey) {
  console.error('Error: CLAUDE_API_KEY environment variable is not set.');
  console.error('Please set this variable to enable AI capabilities.');
  process.exit(1);
}

// Initialize AI
const claude = new ClaudeAI(apiKey);

// Get project path
const projectPath = process.cwd();

// Parse command line arguments
const command = process.argv[2];

async function main() {
  try {
    if (command === 'scan') {
      await scanProject();
    } else if (command === 'heal') {
      await healProject();
    } else if (command === 'learn') {
      await learnPatterns();
    } else {
      showHelp();
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

/**
 * Scan project for issues
 */
async function scanProject() {
  try {
    console.log(`Scanning project at ${projectPath}...`);
    
    // Create scanner
    const scanner = new Scanner(projectPath, claude);
    
    // Scan for issues
    const issues = await scanner.scanProject();
    
    // Save issues to file
    const issuesPath = path.join(projectPath, '.project-healer-issues.json');
    fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2));
    
    // Set output variables for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const issuesFound = issues.length > 0;
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `issues_found=${issuesFound}\n`
      );
    }
    
    console.log(`Found ${issues.length} issues.`);
    
    if (issues.length > 0) {
      console.log('Issues by severity:');
      const bySeverity = issues.reduce((acc, issue) => {
        acc[issue.severity] = (acc[issue.severity] || 0) + 1;
        return acc;
      }, {});
      
      for (const severity in bySeverity) {
        console.log(`- ${severity}: ${bySeverity[severity]}`);
      }
    }
    
    return issues;
  } catch (error) {
    console.error('Error scanning project:', error.message);
    throw error;
  }
}

/**
 * Apply fixes to issues
 */
async function healProject() {
  try {
    console.log(`Healing project at ${projectPath}...`);
    
    // Check if issues file exists
    const issuesPath = path.join(projectPath, '.project-healer-issues.json');
    if (!fs.existsSync(issuesPath)) {
      console.error('No issues file found. Please run scan command first.');
      process.exit(1);
    }
    
    // Load issues
    const issues = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
    
    // Create healer
    const healer = new Healer(projectPath, claude);
    
    // Apply fixes
    const results = await healer.applyFixes(issues);
    
    // Generate report for PR
    const report = generateReport(issues, results);
    
    // Set output variables for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const fixesApplied = results.fixed.length > 0;
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `fixes_applied=${fixesApplied}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `pr_body=${JSON.stringify(report)}\n`
      );
    }
    
    console.log(`Applied ${results.fixed.length} fixes out of ${issues.length} issues.`);
    
    return results;
  } catch (error) {
    console.error('Error healing project:', error.message);
    throw error;
  }
}

/**
 * Learn patterns from project
 */
async function learnPatterns() {
  try {
    console.log(`Learning patterns from project at ${projectPath}...`);
    
    // Learn custom patterns using AI
    const customPatterns = await claude.learnFromRepository(projectPath);
    
    // Save learned patterns
    const patternManager = new PatternManager();
    patternManager.saveLearnedPatterns(customPatterns);
    
    console.log(`Learned ${customPatterns.length} new patterns.`);
    
    return customPatterns;
  } catch (error) {
    console.error('Error learning patterns:', error.message);
    throw error;
  }
}

/**
 * Generate report for PR description
 * @param {Array} issues - List of issues
 * @param {Object} results - Healing results
 * @returns {string} - Report text
 */
function generateReport(issues, results) {
  let report = '# Project Healer Report\n\n';
  
  report += '## Summary\n\n';
  report += `- Total issues found: ${issues.length}\n`;
  report += `- Issues fixed: ${results.fixed.length}\n`;
  report += `- Issues needing manual intervention: ${results.unfixed.length}\n\n`;
  
  if (results.fixed.length > 0) {
    report += '## Fixed Issues\n\n';
    
    for (const issue of results.fixed) {
      report += `### ${issue.file}:${issue.line}\n\n`;
      report += `**${issue.severity.toUpperCase()}**: ${issue.message}\n\n`;
      report += '```diff\n';
      report += `- ${issue.fix.original}\n`;
      report += `+ ${issue.fix.replacement}\n`;
      report += '```\n\n';
    }
  }
  
  if (results.unfixed.length > 0) {
    report += '## Issues Needing Manual Intervention\n\n';
    
    for (const issue of results.unfixed) {
      report += `### ${issue.file}:${issue.line}\n\n`;
      report += `**${issue.severity.toUpperCase()}**: ${issue.message}\n\n`;
      
      if (issue.reason) {
        report += `**Reason**: ${issue.reason}\n\n`;
      }
    }
  }
  
  return report;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Project Healer - AI-powered self-healing for your codebase

Usage:
  project-healer scan    - Scan project for issues
  project-healer heal    - Apply fixes to detected issues
  project-healer learn   - Learn custom patterns from your project
  project-healer help    - Show this help message

Environment variables:
  CLAUDE_API_KEY         - Your Anthropic Claude API key (required)
  `);
}

main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});