# Project Healer 🩹

A self-healing framework for GitHub projects that automatically detects and fixes issues, dependencies, and security vulnerabilities.

## Features

- 🔍 **Automated Issue Detection**: Scans code for problems, outdated dependencies, and best practice violations
- 🛡️ **Security Vulnerability Scanning**: Identifies security issues with pattern matching and AI
- 🔧 **Automated Fixing**: Applies fixes to common issues and vulnerabilities
- 📈 **Comprehensive Reporting**: Generates detailed reports on issues and fixes
- 🧠 **Self-Improving**: Learns from successful fixes to handle more issues over time
- 🤖 **GitHub Integration**: Runs automatically via GitHub Actions

## Security Vulnerability Scanner

The newly added security vulnerability scanner can detect and fix common security issues in your codebase:

- SQL Injection vulnerabilities
- Cross-Site Scripting (XSS) issues
- Path Traversal vulnerabilities
- Server-Side Request Forgery (SSRF)
- Insecure Randomness
- Hardcoded Secrets
- Insecure Deserialization
- Unvalidated Redirects
- And many more...

## Getting Started

### Installation

1. Add the GitHub Actions workflow to your repository:

```yaml
name: Project Healer

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 0 * * 1'  # Weekly check
  workflow_dispatch:     # Manual trigger

jobs:
  heal:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install -g project-healer
      - name: Scan and Heal
        run: project-healer heal --all --report
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
```

2. Set up the Claude API key in your repository secrets (if using AI-powered healing)

### Usage

#### GitHub Actions

The GitHub Actions workflow will automatically:

1. Scan your project for issues and security vulnerabilities
2. Apply appropriate fixes
3. Create a Pull Request with the changes
4. Generate reports for review

#### Command Line

You can also use Project Healer as a command-line tool:

```bash
# Install
npm install -g project-healer

# Scan for issues
project-healer scan --report

# Scan for security vulnerabilities
project-healer security-scan --report

# Apply fixes
project-healer heal --all

# Learn from project history
project-healer learn
```

## Example Security Scan Report

Here's an example of the security vulnerability scanning report:

```markdown
# Security Vulnerability Report

## Summary

- **Total vulnerabilities:** 5
- **Critical:** 1
- **High:** 3
- **Medium:** 1

## Fix Results

- **Fixed:** 4
- **Failed:** 0
- **Skipped:** 1

## Vulnerabilities

### Critical Severity

#### sql-injection in auth.js:42

- **File:** `src/controllers/auth.js`
- **Line:** 42
- **Description:** Possible SQL injection vulnerability with unescaped user input in query
- **Code:**
```sql
const user = await db.query(`SELECT * FROM users WHERE email = '${email}'`);
```
- **Status:** fixed

...
```

## Configuration

You can customize the behavior of Project Healer by creating a `.healerrc.json` file in your project root:

```json
{
  "excludePaths": ["node_modules", "dist", ".git"],
  "securityScan": {
    "skipSeverities": ["low"],
    "customPatterns": "patterns/custom-security.json"
  },
  "ai": {
    "enabled": true,
    "learnFromFixes": true
  }
}
```

## License

MIT
