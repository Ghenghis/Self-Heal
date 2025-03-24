# Project Healer

AI-powered self-healing framework for GitHub projects. This tool automatically scans your codebase, identifies issues, and applies fixes.

## Features

- 🔍 **Automatic Issue Detection**: Scans your codebase for common problems
- 🩹 **Self-Healing**: Automatically applies fixes to detected issues
- 🧠 **AI-Powered Analysis**: Uses Claude 3.7 API to provide intelligent fixes
- 📊 **Dependency Graph Visualization**: Visualize project dependencies and identify potential issues
- 🔄 **GitHub Integration**: Seamlessly integrates with GitHub Actions

## Dependency Graph Visualizer

One of the key features of Project Healer is the Dependency Graph Visualizer. This tool:

- Scans your project to identify dependencies between files
- Builds a visual representation of the dependency graph
- Identifies circular dependencies and potential issues
- Helps you understand the impact of changes to your codebase

The visualization allows you to:
- Toggle physics simulation on/off
- Filter by file type
- Identify dependency relationships
- Detect circular dependencies
- Find unused files

## Setup

1. Add this GitHub Action to your repository
2. Set your Claude API key in repository secrets
3. The system will automatically scan, fix, and create PRs with the changes

## Usage

### GitHub Actions

The tool runs automatically through GitHub Actions. You can also trigger it manually from the Actions tab.

### Command Line

You can also use Project Healer from the command line:

```bash
# Install globally
npm install -g project-healer

# Run in current directory
healer --fix --report --graph

# Run with specific options
healer --project /path/to/project --no-fix --graph
```

## Options

- `--fix`: Apply automatic fixes (default: true)
- `--no-fix`: Disable automatic fixing
- `--report`: Generate a report of issues (default: true)
- `--no-report`: Disable report generation
- `--graph`: Generate dependency graph visualization
- `--project <path>`: Path to the project (default: current directory)
- `--output <path>`: Path to save reports (default: ./healer-report)

## License

MIT