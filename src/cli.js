#!/usr/bin/env node

/**
 * Self-Heal CLI
 * 
 * Command line interface for the Self-Heal framework.
 * Provides easy access to scanning, healing, and reporting features.
 */

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const DependencyVulnerabilityScanner = require('./scanners/dependency-vulnerability');
const DependencyUpdater = require('./healers/dependency-updater');

// Ensure reports directory exists
const reportsDir = path.join(process.cwd(), '.self-heal', 'reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

program
  .name('self-heal')
  .description('Self-Healing framework for GitHub projects')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Scan project for issues')
  .option('-t, --type <type>', 'Type of scan (dependency, code, all)', 'all')
  .option('-p, --path <path>', 'Path to project', process.cwd())
  .option('--no-autofix', 'Disable auto-fix suggestions')
  .option('--fix-level <level>', 'Minimum severity level to auto-fix (low, moderate, high, critical)', 'moderate')
  .option('--use-ai', 'Use AI to enhance scanning')
  .action(async (options) => {
    console.log(`🔍 Scanning project at ${options.path}...`);
    
    if (options.type === 'all' || options.type === 'dependency') {
      await scanDependencies(options);
    }
    
    if (options.type === 'all' || options.type === 'code') {
      await scanCode(options);
    }
    
    console.log('✅ Scan completed. Check the reports directory for details.');
  });

// Heal command
program
  .command('heal')
  .description('Apply fixes to issues')
  .option('-t, --type <type>', 'Type of healing (dependency, code, all)', 'all')
  .option('-p, --path <path>', 'Path to project', process.cwd())
  .option('--no-test', 'Skip testing after fixes')
  .option('--fix-level <level>', 'Minimum severity level to fix (low, moderate, high, critical)', 'moderate')
  .option('--dry-run', 'Show what would be fixed without making changes')
  .action(async (options) => {
    console.log(`🩹 Healing project at ${options.path}...`);
    
    if (options.type === 'all' || options.type === 'dependency') {
      await healDependencies(options);
    }
    
    if (options.type === 'all' || options.type === 'code') {
      await healCode(options);
    }
    
    console.log('✅ Healing completed. Check the reports directory for details.');
  });

// Report command
program
  .command('report')
  .description('Generate comprehensive report')
  .option('-p, --path <path>', 'Path to project', process.cwd())
  .option('-f, --format <format>', 'Report format (text, json, html, markdown)', 'markdown')
  .option('-o, --output <o>', 'Output file path')
  .action(async (options) => {
    console.log(`📊 Generating report for project at ${options.path}...`);
    await generateReport(options);
    console.log('✅ Report generated.');
  });

// Initialize command
program
  .command('init')
  .description('Initialize Self-Heal in a project')
  .option('-p, --path <path>', 'Path to project', process.cwd())
  .action(async (options) => {
    console.log(`🚀 Initializing Self-Heal in project at ${options.path}...`);
    await initializeSelfHeal(options);
    console.log('✅ Self-Heal initialized.');
  });

// Parse command line arguments
program.parse();

/**
 * Scan dependencies for vulnerabilities
 */
async function scanDependencies(options) {
  console.log('📦 Scanning dependencies for vulnerabilities...');
  
  const scanner = new DependencyVulnerabilityScanner(options.path, {
    autoFix: options.autofix,
    fixLevel: options.fixLevel,
    useAI: options.useAi
  });
  
  try {
    const results = await scanner.scan();
    
    // Save results to file
    const outputFile = path.join(reportsDir, 'dependency-vulnerabilities.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    
    // Display summary
    console.log(`\nFound ${results.count} vulnerable dependencies:`);
    console.log(`- Critical: ${results.summary.countBySeverity.critical}`);
    console.log(`- High: ${results.summary.countBySeverity.high}`);
    console.log(`- Moderate: ${results.summary.countBySeverity.moderate}`);
    console.log(`- Low: ${results.summary.countBySeverity.low}`);
    console.log(`\n${results.summary.autoFixable} can be automatically fixed (${results.summary.fixablePercentage}%)`);
    
  } catch (error) {
    console.error('Error scanning dependencies:', error.message);
  }
}

/**
 * Scan code for issues
 */
async function scanCode(options) {
  console.log('📄 Scanning code for issues...');
  
  // This function would use other scanners for code issues
  // For this demo, we'll create a simple mock result
  
  const mockResults = {
    count: 0,
    issues: [],
    summary: {
      countBySeverity: {
        critical: 0,
        high: 0,
        moderate: 0,
        low: 0
      },
      autoFixable: 0,
      fixablePercentage: 0
    }
  };
  
  // Save results to file
  const outputFile = path.join(reportsDir, 'code-issues.json');
  fs.writeFileSync(outputFile, JSON.stringify(mockResults, null, 2), 'utf8');
  
  // Display summary
  console.log(`\nFound ${mockResults.count} code issues`);
}

/**
 * Apply fixes to dependency vulnerabilities
 */
async function healDependencies(options) {
  console.log('🔧 Fixing dependency vulnerabilities...');
  
  try {
    // Load vulnerability report
    const reportFile = path.join(reportsDir, 'dependency-vulnerabilities.json');
    if (!fs.existsSync(reportFile)) {
      console.log('No vulnerability report found. Run scan first.');
      return;
    }
    
    const vulnerabilityReport = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    
    if (vulnerabilityReport.count === 0) {
      console.log('No vulnerabilities to fix!');
      return;
    }
    
    const updater = new DependencyUpdater(options.path, {
      testAfterUpdate: options.test,
      dryRun: options.dryRun
    });
    
    const results = await updater.heal(vulnerabilityReport.vulnerabilities);
    
    // Save results to file
    const outputFile = path.join(reportsDir, 'dependency-fixes.json');
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf8');
    
    // Display summary
    console.log(`\nFixed ${results.updated.length} vulnerabilities:`);
    results.updated.forEach(fix => {
      console.log(`✅ ${fix.package}: ${fix.from} → ${fix.to}`);
    });
    
    if (results.skipped.length > 0) {
      console.log(`\nSkipped ${results.skipped.length} vulnerabilities:`);
      results.skipped.forEach(skip => {
        console.log(`⚠️ ${skip.package}: ${skip.reason}`);
      });
    }
    
    if (results.errors.length > 0) {
      console.log(`\nEncountered ${results.errors.length} errors:`);
      results.errors.forEach(error => {
        console.log(`❌ ${error.type}: ${error.message}`);
      });
    }
    
  } catch (error) {
    console.error('Error fixing dependencies:', error.message);
  }
}

/**
 * Apply fixes to code issues
 */
async function healCode(options) {
  console.log('🔧 Fixing code issues...');
  
  // This function would use the code healers
  // For this demo, we'll create a simple mock result
  
  const mockResults = {
    updated: [],
    skipped: [],
    errors: []
  };
  
  // Save results to file
  const outputFile = path.join(reportsDir, 'code-fixes.json');
  fs.writeFileSync(outputFile, JSON.stringify(mockResults, null, 2), 'utf8');
  
  // Display summary
  console.log(`\nFixed ${mockResults.updated.length} code issues`);
}

/**
 * Generate comprehensive report
 */
async function generateReport(options) {
  console.log('📝 Generating comprehensive report...');
  
  // Load all reports
  const reports = {};
  
  try {
    const depVulnerabilityFile = path.join(reportsDir, 'dependency-vulnerabilities.json');
    if (fs.existsSync(depVulnerabilityFile)) {
      reports.dependencyVulnerabilities = JSON.parse(fs.readFileSync(depVulnerabilityFile, 'utf8'));
    }
    
    const depFixesFile = path.join(reportsDir, 'dependency-fixes.json');
    if (fs.existsSync(depFixesFile)) {
      reports.dependencyFixes = JSON.parse(fs.readFileSync(depFixesFile, 'utf8'));
    }
    
    const codeIssuesFile = path.join(reportsDir, 'code-issues.json');
    if (fs.existsSync(codeIssuesFile)) {
      reports.codeIssues = JSON.parse(fs.readFileSync(codeIssuesFile, 'utf8'));
    }
    
    const codeFixesFile = path.join(reportsDir, 'code-fixes.json');
    if (fs.existsSync(codeFixesFile)) {
      reports.codeFixes = JSON.parse(fs.readFileSync(codeFixesFile, 'utf8'));
    }
    
    // Generate report based on format
    let reportContent = '';
    
    switch (options.format) {
      case 'markdown':
        reportContent = generateMarkdownReport(reports);
        break;
      case 'html':
        reportContent = generateHtmlReport(reports);
        break;
      case 'json':
        reportContent = JSON.stringify(reports, null, 2);
        break;
      case 'text':
      default:
        reportContent = generateTextReport(reports);
        break;
    }
    
    // Write report to file
    const outputFile = options.output || path.join(reportsDir, `self-heal-report.${options.format}`);
    fs.writeFileSync(outputFile, reportContent, 'utf8');
    
    console.log(`Report saved to ${outputFile}`);
    
  } catch (error) {
    console.error('Error generating report:', error.message);
  }
}

/**
 * Generate Markdown report
 */
function generateMarkdownReport(reports) {
  const now = new Date().toISOString();
  
  let markdown = `# Self-Heal Report\n\n`;
  markdown += `Generated on: ${now}\n\n`;
  
  if (reports.dependencyVulnerabilities) {
    markdown += `## Dependency Vulnerabilities\n\n`;
    markdown += `Total vulnerabilities found: ${reports.dependencyVulnerabilities.count}\n\n`;
    
    if (reports.dependencyVulnerabilities.count > 0) {
      markdown += `### Severity Breakdown\n\n`;
      markdown += `- Critical: ${reports.dependencyVulnerabilities.summary.countBySeverity.critical}\n`;
      markdown += `- High: ${reports.dependencyVulnerabilities.summary.countBySeverity.high}\n`;
      markdown += `- Moderate: ${reports.dependencyVulnerabilities.summary.countBySeverity.moderate}\n`;
      markdown += `- Low: ${reports.dependencyVulnerabilities.summary.countBySeverity.low}\n\n`;
      
      markdown += `### Vulnerabilities\n\n`;
      markdown += `| Package | Current Version | Severity | Description | Fix |\n`;
      markdown += `| ------- | --------------- | -------- | ----------- | --- |\n`;
      
      reports.dependencyVulnerabilities.vulnerabilities.forEach(vuln => {
        markdown += `| ${vuln.package} | ${vuln.currentVersion} | ${vuln.severity} | ${vuln.title} | ${vuln.fix.target || 'latest'} |\n`;
      });
      
      markdown += `\n`;
    }
  }
  
  if (reports.dependencyFixes) {
    markdown += `## Applied Fixes\n\n`;
    
    if (reports.dependencyFixes.updated.length > 0) {
      markdown += `### Fixed Dependencies\n\n`;
      markdown += `| Package | From | To | Severity |\n`;
      markdown += `| ------- | ---- | -- | -------- |\n`;
      
      reports.dependencyFixes.updated.forEach(fix => {
        markdown += `| ${fix.package} | ${fix.from} | ${fix.to} | ${fix.severity} |\n`;
      });
      
      markdown += `\n`;
    }
    
    if (reports.dependencyFixes.skipped.length > 0) {
      markdown += `### Skipped Dependencies\n\n`;
      markdown += `| Package | Reason |\n`;
      markdown += `| ------- | ------ |\n`;
      
      reports.dependencyFixes.skipped.forEach(skip => {
        markdown += `| ${skip.package} | ${skip.reason} |\n`;
      });
      
      markdown += `\n`;
    }
    
    if (reports.dependencyFixes.errors.length > 0) {
      markdown += `### Errors\n\n`;
      markdown += `| Type | Message |\n`;
      markdown += `| ---- | ------- |\n`;
      
      reports.dependencyFixes.errors.forEach(error => {
        markdown += `| ${error.type} | ${error.message} |\n`;
      });
      
      markdown += `\n`;
    }
  }
  
  // Add similar sections for code issues and fixes
  
  return markdown;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(reports) {
  // Implementation for HTML report generation
  return `<html><body><h1>Self-Heal Report</h1><p>See markdown or JSON report for details.</p></body></html>`;
}

/**
 * Generate Text report
 */
function generateTextReport(reports) {
  // Implementation for text report generation
  return `Self-Heal Report\n\nSee markdown or JSON report for details.`;
}

/**
 * Initialize Self-Heal in a project
 */
async function initializeSelfHeal(options) {
  console.log('🚀 Initializing Self-Heal...');
  
  // Create project structure
  const projectDir = options.path;
  const selfHealDir = path.join(projectDir, '.self-heal');
  
  // Create directories
  if (!fs.existsSync(selfHealDir)) {
    fs.mkdirSync(selfHealDir, { recursive: true });
  }
  
  if (!fs.existsSync(path.join(selfHealDir, 'reports'))) {
    fs.mkdirSync(path.join(selfHealDir, 'reports'), { recursive: true });
  }
  
  // Create GitHub Action workflow if it doesn't exist
  const workflowsDir = path.join(projectDir, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    fs.mkdirSync(workflowsDir, { recursive: true });
  }
  
  const workflowFile = path.join(workflowsDir, 'self-heal.yml');
  if (!fs.existsSync(workflowFile)) {
    // Create simple version of the workflow
    const workflowContent = `name: Self-Heal

on:
  push:
    branches: [ main, master, develop ]
  pull_request:
    branches: [ main, master, develop ]
  schedule:
    - cron: '0 0 * * 1'  # Weekly on Mondays
  workflow_dispatch:

jobs:
  self-heal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Self-Heal
        run: npm install -g self-heal
      
      - name: Scan and Report
        run: self-heal scan
      
      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: self-heal-report
          path: ./.self-heal/reports/
`;
    
    fs.writeFileSync(workflowFile, workflowContent, 'utf8');
    console.log(`Created GitHub Action workflow at ${workflowFile}`);
  }
  
  // Create README if it doesn't exist
  const readmeFile = path.join(selfHealDir, 'README.md');
  if (!fs.existsSync(readmeFile)) {
    const readmeContent = `# Self-Heal

This project uses Self-Heal, an automated framework for detecting and fixing issues in your codebase.

## Features

- Scans dependencies for vulnerabilities
- Automatically fixes security issues
- Generates comprehensive reports
- Integrates with GitHub Actions

## Usage

Run the following commands to use Self-Heal:

\`\`\`
# Scan for issues
npx self-heal scan

# Apply fixes
npx self-heal heal

# Generate report
npx self-heal report
\`\`\`

Check the \`.self-heal/reports\` directory for detailed reports.
`;
    
    fs.writeFileSync(readmeFile, readmeContent, 'utf8');
    console.log(`Created README at ${readmeFile}`);
  }
  
  console.log('Self-Heal initialized successfully!');
}