/**
 * AI Integration Module
 * 
 * Provides integration with Claude 3.7 AI for enhanced analysis and healing.
 */

const { Anthropic } = require('anthropic');
require('dotenv').config();

// Initialize Anthropic client with API key
const apiKey = process.env.CLAUDE_API_KEY || '';
let anthropic = null;

if (apiKey) {
  anthropic = new Anthropic({
    apiKey
  });
}

/**
 * Query the Claude AI model
 * 
 * @param {string} prompt - The prompt to send to Claude
 * @param {object} options - Additional options
 * @returns {Promise<string>} The AI response
 */
async function queryAI(prompt, options = {}) {
  if (!anthropic) {
    console.warn('Claude API key not found. AI features disabled.');
    return 'AI analysis unavailable. Please set CLAUDE_API_KEY environment variable.';
  }
  
  try {
    const defaultOptions = {
      model: 'claude-3-7-sonnet-20250219',
      maxTokens: 4000,
      temperature: 0.2,
      system: 'You are an expert code security and dependency vulnerability analyst. Your task is to help identify and fix security issues in code and dependencies.'
    };
    
    const requestOptions = {
      ...defaultOptions,
      ...options
    };
    
    const response = await anthropic.messages.create({
      model: requestOptions.model,
      max_tokens: requestOptions.maxTokens,
      temperature: requestOptions.temperature,
      system: requestOptions.system,
      messages: [
        { role: 'user', content: prompt }
      ]
    });
    
    return response.content[0].text;
  } catch (error) {
    console.error('Error querying Claude AI:', error.message);
    return `Error: ${error.message}`;
  }
}

/**
 * Analyze code for security vulnerabilities
 * 
 * @param {string} code - The code to analyze
 * @param {string} language - The programming language
 * @returns {Promise<object>} Analysis results
 */
async function analyzeCodeSecurity(code, language) {
  const prompt = `
    Please analyze the following ${language} code for security vulnerabilities, bad practices, and potential bugs:
    
    \`\`\`${language}
    ${code}
    \`\`\`
    
    For each issue you find, provide:
    1. Line number(s) where the issue occurs
    2. Description of the issue
    3. Severity (low, moderate, high, critical)
    4. Suggested fix (code snippet)
    
    Return your analysis as a JSON array of objects with these properties: lineNumber, description, severity, fix.
    If no issues are found, return an empty array.
  `;
  
  try {
    const response = await queryAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing AI analysis:', error.message);
    return [];
  }
}

/**
 * Analyze project dependencies for security vulnerabilities
 * 
 * @param {object} dependencies - The project dependencies
 * @returns {Promise<object>} Analysis results
 */
async function analyzeDependencies(dependencies) {
  const prompt = `
    Please analyze these project dependencies for security vulnerabilities:
    
    ${JSON.stringify(dependencies, null, 2)}
    
    For each vulnerable dependency, provide:
    1. Package name
    2. Current version
    3. Description of the vulnerability
    4. Severity (low, moderate, high, critical)
    5. Recommended version to update to
    
    Return your analysis as a JSON array of objects with these properties: packageName, currentVersion, description, severity, recommendedVersion.
    If no vulnerabilities are found, return an empty array.
  `;
  
  try {
    const response = await queryAI(prompt);
    return JSON.parse(response);
  } catch (error) {
    console.error('Error parsing AI dependency analysis:', error.message);
    return [];
  }
}

/**
 * Generate a fix for a code issue
 * 
 * @param {string} code - The original code
 * @param {object} issue - The issue to fix
 * @returns {Promise<string>} The fixed code
 */
async function generateCodeFix(code, issue) {
  const prompt = `
    Please fix the following issue in this code:
    
    Original code:
    \`\`\`
    ${code}
    \`\`\`
    
    Issue:
    ${JSON.stringify(issue, null, 2)}
    
    Provide ONLY the complete fixed code, without any explanations or markdown.
  `;
  
  return await queryAI(prompt);
}

module.exports = {
  queryAI,
  analyzeCodeSecurity,
  analyzeDependencies,
  generateCodeFix
};