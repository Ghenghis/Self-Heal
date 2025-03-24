#!/usr/bin/env node

/**
 * Project Healer - Main CLI Entry Point
 * 
 * A self-healing framework for GitHub projects that automatically
 * detects and fixes issues, vulnerabilities, and other problems.
 */

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const { scanProject, scanFile } = require('./scanner');
const { applyFixes, generateFixReport } = require('./healer');
const { 
  scanProject: scanSecurity, 
  fixVulnerabilities, 
  generateSecurityReport 
} = require('./vulnScanner');
const { learnPatterns } = require('./patterns');
const { analyzeWithAI } = require('./ai');

// Setup CLI
const program = new Command();

program
  .name('project-healer')
  .description('Self-healing framework for GitHub projects')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Scan project for issues')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-e, --exclude <patterns...>', 'Patterns to exclude')
  .option('-r, --report', 'Generate report', false)
  .option('-ai, --use-ai', 'Use AI for advanced scanning', false)
  .action(async (options) => {
    console.log('Scanning project...');
    
    try {
      const issues = await scanProject(options.path, {
        exclude: options.exclude || ['node_modules', '.git'],
        useAI: options.useAi
      });
      
      console.log(`Found ${issues.length} issues.`);
      
      if (issues.length > 0) {
        process.stdout.write(`::set-output name=issues_found::true\n`);
        process.stdout.write(`::set-output name=issues_count::${issues.length}\n`);
        
        if (options.report) {
          const reportDir = path.join(process.cwd(), 'reports');
          if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
          }
          
          const reportPath = path.join(reportDir, 'issues-report.md');
          fs.writeFileSync(reportPath, generateReport(issues));
          console.log(`Report generated: ${reportPath}`);
        }
      } else {
        process.stdout.write(`::set-output name=issues_found::false\n`);
      }
    } catch (error) {
      console.error('Error scanning project:', error);
      process.exit(1);
    }
  });

// Security scan command
program
  .command('security-scan')
  .description('Scan project for security vulnerabilities')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-e, --exclude <patterns...>', 'Patterns to exclude')
  .option('-r, --report', 'Generate report', false)
  .option('-ai, --use-ai', 'Use AI for advanced scanning', false)
  .action(async (options) => {
    console.log('Scanning project for security vulnerabilities...');
    
    try {
      const vulnerabilities = await scanSecurity(options.path, {
        exclude: options.exclude || ['node_modules', '.git'],
        useAI: options.useAi
      });
      
      console.log(`Found ${vulnerabilities.length} security vulnerabilities.`);
      
      if (vulnerabilities.length > 0) {
        process.stdout.write(`::set-output name=vulnerabilities_found::true\n`);
        process.stdout.write(`::set-output name=vulnerabilities_count::${vulnerabilities.length}\n`);
        
        // Count by severity
        const severityCounts = vulnerabilities.reduce((counts, vuln) => {
          counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
          return counts;
        }, {});
        
        // Output summary for GitHub Actions
        const summary = Object.entries(severityCounts)
          .map(([severity, count]) => `${severity}: ${count}`)
          .join(', ');
        process.stdout.write(`::set-output name=vulnerabilities_summary::${summary}\n`);
        
        if (options.report) {
          const reportDir = path.join(process.cwd(), 'reports');
          if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
          }
          
          const reportPath = path.join(reportDir, 'security-report.md');
          fs.writeFileSync(reportPath, generateSecurityReport(vulnerabilities));
          console.log(`Security report generated: ${reportPath}`);
        }
      } else {
        process.stdout.write(`::set-output name=vulnerabilities_found::false\n`);
      }
    } catch (error) {
      console.error('Error scanning for vulnerabilities:', error);
      process.exit(1);
    }
  });

// Heal command
program
  .command('heal')
  .description('Apply fixes to issues')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-i, --issues <file>', 'Issues file (JSON)')
  .option('-v, --vulns <file>', 'Vulnerabilities file (JSON)')
  .option('-a, --all', 'Fix all issues and vulnerabilities', false)
  .option('--skip-severity <severities...>', 'Skip vulnerabilities with these severities')
  .option('-r, --report', 'Generate fix report', false)
  .action(async (options) => {
    console.log('Applying fixes...');
    
    try {
      let issuesFixed = 0;
      let vulnsFixed = 0;
      let fixSummary = [];
      
      // Fix code issues
      if (options.issues || options.all) {
        let issues = [];
        
        if (options.issues) {
          issues = JSON.parse(fs.readFileSync(options.issues, 'utf8'));
        } else if (options.all) {
          issues = await scanProject(options.path, {
            exclude: ['node_modules', '.git']
          });
        }
        
        if (issues.length > 0) {
          const fixResults = await applyFixes(issues);
          issuesFixed = fixResults.fixed;
          
          fixSummary.push(`Fixed ${fixResults.fixed}/${issues.length} code issues`);
          
          if (options.report) {
            const reportDir = path.join(process.cwd(), 'reports');
            if (!fs.existsSync(reportDir)) {
              fs.mkdirSync(reportDir, { recursive: true });
            }
            
            const reportPath = path.join(reportDir, 'fix-report.md');
            fs.writeFileSync(reportPath, generateFixReport(issues, fixResults));
            console.log(`Fix report generated: ${reportPath}`);
          }
        }
      }
      
      // Fix security vulnerabilities
      if (options.vulns || options.all) {
        let vulns = [];
        
        if (options.vulns) {
          vulns = JSON.parse(fs.readFileSync(options.vulns, 'utf8'));
        } else if (options.all) {
          vulns = await scanSecurity(options.path, {
            exclude: ['node_modules', '.git']
          });
        }
        
        if (vulns.length > 0) {
          const fixResults = await fixVulnerabilities(vulns, {
            skipSeverity: options.skipSeverity
          });
          
          vulnsFixed = fixResults.fixed;
          
          const severityCounts = vulns.reduce((counts, vuln) => {
            counts[vuln.severity] = (counts[vuln.severity] || 0) + 1;
            return counts;
          }, {});
          
          Object.entries(severityCounts).forEach(([severity, count]) => {
            const fixedCount = fixResults.details.filter(
              d => d.status === 'fixed' && vulns.find(v => 
                v.file === d.file && v.line === d.line
              )?.severity === severity
            ).length;
            
            fixSummary.push(`Fixed ${fixedCount}/${count} ${severity} security vulnerabilities`);
          });
        }
      }
      
      // Output results for GitHub Actions
      const totalFixed = issuesFixed + vulnsFixed;
      if (totalFixed > 0) {
        process.stdout.write(`::set-output name=fixes_applied::true\n`);
        process.stdout.write(`::set-output name=fixes_count::${totalFixed}\n`);
        process.stdout.write(`::set-output name=fixes_summary::${fixSummary.join('\\n')}\n`);
        
        console.log(`Applied ${totalFixed} fixes.`);
      } else {
        process.stdout.write(`::set-output name=fixes_applied::false\n`);
        console.log('No fixes applied.');
      }
    } catch (error) {
      console.error('Error applying fixes:', error);
      process.exit(1);
    }
  });

// Learn command
program
  .command('learn')
  .description('Learn new patterns from project history')
  .option('-p, --path <path>', 'Project path', process.cwd())
  .option('-f, --from-reports', 'Learn from reports', false)
  .option('-ai, --use-ai', 'Use AI for pattern learning', false)
  .action(async (options) => {
    console.log('Learning new patterns...');
    
    try {
      let newPatterns = 0;
      
      if (options.fromReports) {
        const reportDir = path.join(process.cwd(), 'reports');
        if (fs.existsSync(reportDir)) {
          const reports = fs.readdirSync(reportDir)
            .filter(file => file.endsWith('.md'))
            .map(file => path.join(reportDir, file));
          
          if (reports.length > 0) {
            newPatterns = await learnPatterns(reports, {
              useAI: options.useAi
            });
          }
        }
      } else {
        newPatterns = await learnPatterns(options.path, {
          useAI: options.useAi
        });
      }
      
      console.log(`Learned ${newPatterns} new patterns.`);
    } catch (error) {
      console.error('Error learning patterns:', error);
      process.exit(1);
    }
  });

// Generate report helper function  
function generateReport(issues) {
  let report = `# Project Issues Report\n\n`;
  
  // Summary section
  report += `## Summary\n\n`;
  report += `- **Total issues:** ${issues.length}\n`;
  
  const categoryCounts = issues.reduce((counts, issue) => {
    counts[issue.category] = (counts[issue.category] || 0) + 1;
    return counts;
  }, {});
  
  Object.entries(categoryCounts).forEach(([category, count]) => {
    report += `- **${category}:** ${count}\n`;
  });
  
  // Detailed issues section
  report += `\n## Issues\n\n`;
  
  issues.forEach((issue, index) => {
    report += `### Issue ${index + 1}: ${issue.pattern || 'Custom issue'}\n\n`;
    report += `- **File:** \`${issue.file}\`\n`;
    report += `- **Line:** ${issue.line}\n`;
    report += `- **Category:** ${issue.category}\n`;
    
    if (issue.description) {
      report += `- **Description:** ${issue.description}\n`;
    }
    
    if (issue.match) {
      report += `- **Code:**\n\`\`\`\n${issue.match}\n\`\`\`\n`;
    }
    
    report += `\n`;
  });
  
  return report;
}

// Start the CLI
program.parse(process.argv);
