# Contributing to Project Healer

Thank you for your interest in contributing to Project Healer! This document outlines the process for contributing to this project.

## Code of Conduct

Please be respectful and considerate when interacting with others in this project. We aim to foster an inclusive and welcoming community.

## How to Contribute

### Reporting Issues

If you find a bug or have a suggestion for improvement:

1. Check if the issue already exists in the [GitHub Issues](https://github.com/Ghenghis/Self-Heal/issues)
2. If not, create a new issue with a descriptive title and detailed description
3. Include steps to reproduce, expected behavior, and actual behavior for bugs

### Submitting Pull Requests

1. Fork the repository
2. Create a new branch for your feature or bugfix: `git checkout -b feature/your-feature-name` or `git checkout -b fix/issue-description`
3. Make your changes
4. Run tests if available
5. Commit your changes with a descriptive commit message
6. Push to your fork
7. Submit a pull request to the main repository

## Development Setup

1. Clone the repository: `git clone https://github.com/Ghenghis/Self-Heal.git`
2. Install dependencies: `npm install`
3. Set up your Claude API key: `export CLAUDE_API_KEY=your_key_here`

## Creating New Patterns

One of the easiest ways to contribute is by adding new patterns for issue detection.

1. Find a common code issue that's not currently detected
2. Add a new pattern to the appropriate patterns file (e.g., `patterns/javascript.json`)
3. Test your pattern on sample code
4. Submit a pull request

A pattern should include:

```json
{
  "id": "your-pattern-id",
  "regex": "regular expression to match the issue",
  "message": "Description of the issue",
  "severity": "low|medium|high|critical",
  "fix": {
    "type": "replace|insert|delete",
    "find": "pattern to find (for replace)",
    "replace": "replacement text"
  }
}
```

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.