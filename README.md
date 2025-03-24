# Self-Heal: AI-Powered Project Healing Framework

Self-Heal is a compact, robust framework that automatically detects and fixes issues in your projects. Leveraging the power of Claude 3.7 AI, it creates a truly self-healing development environment that keeps your projects secure and healthy.

![Self-Heal Banner](https://via.placeholder.com/1200x300/0066cc/ffffff?text=Self-Heal)

## Features

- 🔍 **Dependency Vulnerability Detection**: Automatically identifies security vulnerabilities in project dependencies
- 🛡️ **Automated Vulnerability Fixes**: Updates vulnerable dependencies to secure versions
- 🤖 **AI-Powered Analysis**: Leverages Claude 3.7 for intelligent issue detection and fixing
- 🔄 **GitHub Integration**: Seamlessly works with GitHub Actions for continuous healing
- 📊 **Comprehensive Reporting**: Generates detailed reports of issues and fixes
- 🧰 **Cross-Platform Support**: Works with multiple project types (npm, pip, Maven, Gradle, etc.)

## Quick Start

### Installation

```bash
# Install from npm
npm install -g self-heal

# Or clone and install
git clone https://github.com/Ghenghis/Self-Heal.git
cd Self-Heal
npm install
npm link
```

### Basic Usage

```bash
# Scan your project for issues
self-heal scan

# Apply fixes to issues
self-heal heal

# Generate a comprehensive report
self-heal report
```

### GitHub Actions Integration

Add this to your project's `.github/workflows/self-heal.yml`:

```yaml
name: Self-Heal

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
  schedule:
    - cron: '0 0 * * 1'  # Weekly check on Mondays
  workflow_dispatch:  # Manual trigger

jobs:
  analyze_and_heal:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install Self-Heal
        run: npm install -g self-heal
        
      - name: Scan and heal
        run: self-heal scan && self-heal heal
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        
      - name: Create PR for fixes
        uses: peter-evans/create-pull-request@v3
        with:
          commit-message: "🩹 Self-Heal: Automated fixes"
          title: "🩹 Self-Heal: Automated fixes"
          branch: self-heal-fixes
```

## Key Components

1. **Vulnerability Scanner**: Detects security issues in dependencies
2. **Dependency Updater**: Automatically fixes vulnerable dependencies
3. **AI Integration**: Uses Claude 3.7 for enhanced analysis and healing
4. **GitHub Actions Workflow**: Automates the entire process

## AI-Powered Features

Self-Heal leverages Claude 3.7, a state-of-the-art AI model, to:

- Detect complex security patterns that rule-based systems might miss
- Generate targeted fixes for specific vulnerabilities
- Learn from projects to improve detection and healing capabilities
- Provide intelligent insights on security issues

## Configuration

Create a `.env` file in your project root:

```
CLAUDE_API_KEY=your_api_key_here
```

Or configure options via command line:

```bash
self-heal scan --fix-level=high --use-ai
```

## Advanced Usage

### Custom Patterns

Create custom vulnerability patterns in the `patterns` directory:

```json
{
  "javascript": [
    {
      "packageName": "custom-package",
      "vulnerableVersions": ["<1.0.0"],
      "severity": "high",
      "title": "Custom Vulnerability",
      "description": "Description of the vulnerability",
      "fixedVersion": "1.0.0"
    }
  ]
}
```

### Integration with MCP Doctor

Self-Heal can be integrated with MCP Doctor as a submodule:

```bash
# In your MCP Doctor project
git submodule add https://github.com/Ghenghis/Self-Heal.git tools/self-heal
```

Then add to your workflow:

```yaml
- name: Run Self-Heal
  run: node tools/self-heal/src/cli.js scan
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.