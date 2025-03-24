const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ClaudeAI {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseURL = 'https://api.anthropic.com/v1/messages';
    this.model = 'claude-3-7-sonnet-20250224';
  }

  /**
   * Analyze code for potential issues
   * @param {string} filePath - Path to the file
   * @param {string} fileContent - Content of the file
   * @param {string} fileType - File extension
   * @returns {Promise<Array>} - List of issues found
   */
  async analyzeCode(filePath, fileContent, fileType) {
    const prompt = `
You are an expert code reviewer specializing in identifying issues in ${fileType} files.

Analyze this code and identify any problems, including but not limited to:
1. Syntax errors
2. Missing dependencies
3. Security vulnerabilities
4. Performance issues
5. Best practice violations

For each issue, provide:
- Line number
- Issue description
- Severity (high, medium, low)
- Suggested fix as code

File: ${filePath}

\`\`\`${fileType}
${fileContent}
\`\`\`

Format your response as a JSON array with objects having these properties:
{
  "line": number,
  "description": string,
  "severity": string,
  "fix": {
    "type": string, // "replace", "insert", "delete"
    "original": string,
    "replacement": string
  }
}
`;

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Extract JSON from Claude's response
      const content = response.data.content;
      const jsonContent = this.extractJSON(content);
      
      if (jsonContent) {
        return jsonContent;
      }
      
      console.error('Failed to parse AI response as JSON');
      return [];
    } catch (error) {
      console.error('Error calling Claude API:', error.message);
      return [];
    }
  }

  /**
   * Generate a fix for a specific issue
   * @param {string} fileContent - Content of the file
   * @param {string} fileType - File extension
   * @param {Object} issue - Issue to fix
   * @returns {Promise<string>} - Fixed code
   */
  async generateFix(fileContent, fileType, issue) {
    const prompt = `
You are an expert code fixer specializing in ${fileType} files.

I have a file with this content:

\`\`\`${fileType}
${fileContent}
\`\`\`

There's an issue at line ${issue.line}: "${issue.description}"

Please fix this issue. Provide only the complete fixed file content, with no additional explanations.
`;

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Extract code from Claude's response
      const content = response.data.content;
      const codeContent = this.extractCode(content, fileType);
      
      if (codeContent) {
        return codeContent;
      }
      
      console.error('Failed to extract code from AI response');
      return fileContent; // Return original if we failed
    } catch (error) {
      console.error('Error calling Claude API:', error.message);
      return fileContent; // Return original if we failed
    }
  }

  /**
   * Learn from a repository to create custom patterns
   * @param {string} repoPath - Path to the repository
   * @returns {Promise<Array>} - List of custom patterns
   */
  async learnFromRepository(repoPath) {
    // Gather repository statistics and common patterns
    const fileTypes = {};
    const fileCount = this.countFiles(repoPath, fileTypes);
    
    const prompt = `
You are an AI specializing in code pattern recognition.

I have a repository with ${fileCount} files. Here's the breakdown by file type:
${Object.entries(fileTypes).map(([ext, count]) => `- ${ext}: ${count} files`).join('\n')}

Based on this information, generate a list of custom patterns that would be useful for detecting issues in this type of project.
For each pattern, provide:
1. A regular expression to match the pattern
2. A description of the issue
3. The severity level
4. A suggested fix template

Format your response as a JSON array with objects having these properties:
{
  "fileTypes": [string],
  "regex": string,
  "message": string,
  "severity": string,
  "fix": {
    "type": string,
    "find": string,
    "replace": string
  }
}
`;

    try {
      const response = await axios.post(
        this.baseURL,
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            { role: 'user', content: prompt }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          }
        }
      );

      // Extract JSON from Claude's response
      const content = response.data.content;
      const jsonContent = this.extractJSON(content);
      
      if (jsonContent) {
        return jsonContent;
      }
      
      console.error('Failed to parse AI response as JSON');
      return [];
    } catch (error) {
      console.error('Error calling Claude API:', error.message);
      return [];
    }
  }

  /**
   * Extract JSON from Claude's text response
   * @param {string} text - Claude's response
   * @returns {Array|null} - Parsed JSON or null
   */
  extractJSON(text) {
    // Find JSON in the response
    const jsonRegex = /\[\s*{[\s\S]*}\s*\]/;
    const match = text.match(jsonRegex);
    
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        console.error('JSON parsing error:', e.message);
      }
    }
    
    return null;
  }

  /**
   * Extract code from Claude's text response
   * @param {string} text - Claude's response
   * @param {string} fileType - File extension
   * @returns {string|null} - Extracted code or null
   */
  extractCode(text, fileType) {
    // Find code block in the response
    const codeRegex = new RegExp(`\`\`\`(?:${fileType})?([\s\S]*?)\`\`\``);
    const match = text.match(codeRegex);
    
    if (match) {
      return match[1].trim();
    }
    
    return null;
  }

  /**
   * Count files in a directory recursively
   * @param {string} dir - Directory path
   * @param {Object} fileTypes - Object to store file type counts
   * @returns {number} - Total file count
   */
  countFiles(dir, fileTypes) {
    let count = 0;
    
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      
      if (fs.statSync(filePath).isDirectory()) {
        // Skip node_modules and .git directories
        if (file !== 'node_modules' && file !== '.git') {
          count += this.countFiles(filePath, fileTypes);
        }
      } else {
        count++;
        
        // Count file types
        const ext = path.extname(file).slice(1);
        if (ext) {
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        }
      }
    }
    
    return count;
  }
}

module.exports = ClaudeAI;