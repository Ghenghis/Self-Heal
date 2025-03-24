// src/patterns.js
const fs = require('fs');
const path = require('path');

/**
 * Load patterns from the patterns directory
 * @param {string} type - Type of patterns to load (or undefined for all)
 * @returns {Object[]} - Array of patterns
 */
function getPatterns(type) {
  const patternsDir = path.resolve(__dirname, '../patterns');
  const patterns = [];
  
  // Get all pattern files
  const files = fs.readdirSync(patternsDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(patternsDir, file));
  
  // Load patterns from each file
  for (const file of files) {
    try {
      const fileContent = fs.readFileSync(file, 'utf8');
      const patternSet = JSON.parse(fileContent);
      
      // If a specific type is requested, only load those patterns
      if (type) {
        const fileName = path.basename(file, '.json');
        if (fileName.startsWith(type)) {
          patterns.push(...patternSet.patterns.map(pattern => ({
            ...pattern,
            fileTypes: patternSet.fileTypes
          })));
        }
      } else {
        // Load all patterns
        patterns.push(...patternSet.patterns.map(pattern => ({
          ...pattern,
          fileTypes: patternSet.fileTypes
        })));
      }
    } catch (error) {
      console.error(`Error loading patterns from ${file}:`, error);
    }
  }
  
  return patterns;
}

module.exports = {
  getPatterns
};