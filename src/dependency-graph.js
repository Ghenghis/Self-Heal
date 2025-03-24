// src/dependency-graph.js
const fs = require('fs');
const path = require('path');
const { getPatterns } = require('./patterns');

class DependencyGraph {
  constructor() {
    this.nodes = new Map(); // Map of file paths to their dependencies
    this.patterns = getPatterns('dependency');
  }

  /**
   * Scan a project to build a dependency graph
   * @param {string} projectDir - The root directory of the project
   */
  async scanProject(projectDir) {
    const files = this.getAllFiles(projectDir);
    
    for (const file of files) {
      const relativePath = path.relative(projectDir, file);
      const content = fs.readFileSync(file, 'utf8');
      const dependencies = this.findDependencies(file, content);
      
      this.nodes.set(relativePath, {
        path: relativePath,
        absolutePath: file,
        dependencies
      });
    }
    
    return this.nodes;
  }

  /**
   * Get all files in a directory recursively
   * @param {string} dir - The directory to scan
   * @returns {string[]} - Array of file paths
   */
  getAllFiles(dir) {
    const files = [];
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stats = fs.statSync(itemPath);
      
      if (stats.isDirectory()) {
        // Skip node_modules and .git directories
        if (item === 'node_modules' || item === '.git') {
          continue;
        }
        
        files.push(...this.getAllFiles(itemPath));
      } else if (stats.isFile()) {
        files.push(itemPath);
      }
    }
    
    return files;
  }

  /**
   * Find dependencies in a file
   * @param {string} filePath - Path to the file
   * @param {string} content - Content of the file
   * @returns {Object[]} - Array of dependencies
   */
  findDependencies(filePath, content) {
    const dependencies = [];
    const fileExt = path.extname(filePath).substring(1);
    
    // Get patterns for this file type
    const filePatterns = this.patterns.filter(pattern => 
      pattern.fileTypes.includes(fileExt) || pattern.fileTypes.includes('*')
    );
    
    for (const pattern of filePatterns) {
      const regex = new RegExp(pattern.regex, 'g');
      let match;
      
      while ((match = regex.exec(content)) !== null) {
        const dependency = {
          type: pattern.type,
          name: match[1], // Assuming the first capture group is the dependency name
          path: this.resolvePath(filePath, match[1], pattern),
          line: this.getLineNumber(content, match.index)
        };
        
        dependencies.push(dependency);
      }
    }
    
    return dependencies;
  }

  /**
   * Resolve a dependency path
   * @param {string} filePath - Path to the file containing the dependency
   * @param {string} dependencyPath - Raw dependency path from the import/require
   * @param {Object} pattern - The pattern that matched this dependency
   * @returns {string} - Resolved path
   */
  resolvePath(filePath, dependencyPath, pattern) {
    // Handle different types of dependencies based on pattern type
    if (pattern.type === 'npm') {
      return `node_modules/${dependencyPath}`;
    }
    
    if (dependencyPath.startsWith('.')) {
      // Relative import
      return path.resolve(path.dirname(filePath), dependencyPath);
    }
    
    // Absolute import or other types
    return dependencyPath;
  }

  /**
   * Get line number for a position in text
   * @param {string} text - The text content
   * @param {number} position - Position in the text
   * @returns {number} - Line number (1-based)
   */
  getLineNumber(text, position) {
    const lines = text.slice(0, position).split('\n');
    return lines.length;
  }

  /**
   * Find circular dependencies in the graph
   * @returns {Object[]} - Array of circular dependency paths
   */
  findCircularDependencies() {
    const circularDeps = [];
    const visited = new Set();
    const recursionStack = new Set();
    
    const dfs = (node, path = []) => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart).concat(node);
        circularDeps.push(cycle);
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      recursionStack.add(node);
      
      const nodeData = this.nodes.get(node);
      if (nodeData && nodeData.dependencies) {
        for (const dep of nodeData.dependencies) {
          if (dep.path && this.nodes.has(dep.path)) {
            dfs(dep.path, [...path, node]);
          }
        }
      }
      
      recursionStack.delete(node);
    };
    
    // Start DFS from each node
    for (const node of this.nodes.keys()) {
      dfs(node);
    }
    
    return circularDeps;
  }

  /**
   * Find unused dependencies (files that are not imported anywhere)
   * @returns {string[]} - Array of unused file paths
   */
  findUnusedFiles() {
    const allDependencies = new Set();
    
    // Collect all dependencies
    for (const [, nodeData] of this.nodes) {
      for (const dep of nodeData.dependencies) {
        if (dep.path) {
          allDependencies.add(dep.path);
        }
      }
    }
    
    // Find files that are not dependencies of any other file
    const unused = [];
    for (const [path] of this.nodes) {
      if (!allDependencies.has(path)) {
        unused.push(path);
      }
    }
    
    return unused;
  }

  /**
   * Export the graph data for visualization
   * @returns {Object} - Graph data in a format suitable for visualization
   */
  exportForVisualization() {
    const nodes = [];
    const links = [];
    
    // Create nodes
    for (const [path, nodeData] of this.nodes) {
      nodes.push({
        id: path,
        group: this.getFileGroup(path)
      });
      
      // Create links
      for (const dep of nodeData.dependencies) {
        if (dep.path && this.nodes.has(dep.path)) {
          links.push({
            source: path,
            target: dep.path,
            value: 1
          });
        }
      }
    }
    
    return { nodes, links };
  }

  /**
   * Get a group identifier for a file (for visualization)
   * @param {string} filePath - Path to the file
   * @returns {number} - Group identifier
   */
  getFileGroup(filePath) {
    const ext = path.extname(filePath);
    
    // Map extensions to groups
    const groups = {
      '.js': 1,
      '.jsx': 1,
      '.ts': 2,
      '.tsx': 2,
      '.css': 3,
      '.scss': 3,
      '.json': 4,
      '.md': 5
    };
    
    return groups[ext] || 0;
  }
}

module.exports = DependencyGraph;