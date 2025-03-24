const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { fetchAIRecommendation } = require('./ai');

/**
 * Analyzes project dependencies across different package managers
 */
class DependencyAnalyzer {
  constructor() {
    this.supportedManagers = ['npm', 'yarn', 'pip', 'maven', 'gradle'];
    this.dependencyFiles = {
      npm: ['package.json', 'package-lock.json'],
      yarn: ['package.json', 'yarn.lock'],
      pip: ['requirements.txt', 'Pipfile', 'pyproject.toml'],
      maven: ['pom.xml'],
      gradle: ['build.gradle', 'build.gradle.kts']
    };
  }

  /**
   * Detects what package managers are used in the project
   * @param {string} projectPath - Path to the project root
   * @returns {Array} - Array of detected package managers
   */
  detectPackageManagers(projectPath) {
    const detectedManagers = [];
    
    for (const manager of this.supportedManagers) {
      const files = this.dependencyFiles[manager];
      for (const file of files) {
        if (fs.existsSync(path.join(projectPath, file))) {
          detectedManagers.push(manager);
          break;
        }
      }
    }
    
    return detectedManagers;
  }

  /**
   * Analyzes dependencies for issues
   * @param {string} projectPath - Path to the project
   * @returns {Array} - Array of dependency issues
   */
  async analyzeDependencies(projectPath) {
    const issues = [];
    const managers = this.detectPackageManagers(projectPath);
    
    for (const manager of managers) {
      switch (manager) {
        case 'npm':
        case 'yarn':
          issues.push(...this.analyzeNodeDependencies(projectPath, manager));
          break;
        case 'pip':
          issues.push(...this.analyzePythonDependencies(projectPath));
          break;
        case 'maven':
        case 'gradle':
          issues.push(...this.analyzeJavaDependencies(projectPath, manager));
          break;
      }
    }
    
    // Add AI-powered analysis for complex dependency issues
    if (issues.length > 0) {
      const enhancedIssues = await this.enhanceWithAI(issues, projectPath);
      return enhancedIssues;
    }
    
    return issues;
  }

  /**
   * Analyzes Node.js dependencies
   * @param {string} projectPath - Project path
   * @param {string} manager - Package manager (npm or yarn)
   * @returns {Array} - Dependency issues
   */
  analyzeNodeDependencies(projectPath, manager) {
    const issues = [];
    const packageJsonPath = path.join(projectPath, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      return issues;
    }
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const dependencies = { 
        ...(packageJson.dependencies || {}), 
        ...(packageJson.devDependencies || {}) 
      };
      
      // Check for outdated dependencies
      try {
        const outdatedCommand = manager === 'npm' ? 'npm outdated --json' : 'yarn outdated --json';
        const outdatedOutput = execSync(outdatedCommand, { cwd: projectPath, stdio: ['pipe', 'pipe', 'ignore'] });
        const outdatedDeps = JSON.parse(outdatedOutput.toString());
        
        for (const [dep, info] of Object.entries(outdatedDeps)) {
          issues.push({
            type: 'outdated-dependency',
            name: dep,
            currentVersion: info.current,
            latestVersion: info.latest,
            manager,
            file: 'package.json',
            fix: {
              type: 'command',
              command: manager === 'npm' 
                ? `npm install ${dep}@latest` 
                : `yarn upgrade ${dep} --latest`
            }
          });
        }
      } catch (err) {
        // Outdated command might fail, but we can continue
      }
      
      // Check for unused dependencies
      try {
        const files = this.getAllFiles(projectPath, ['.js', '.jsx', '.ts', '.tsx']);
        const usedDependencies = new Set();
        
        for (const file of files) {
          const content = fs.readFileSync(file, 'utf8');
          
          // Check for import statements
          const importRegex = /import\s+.*?from\s+['"]([@\w\d\-/]+)['"]/g;
          let match;
          while ((match = importRegex.exec(content)) !== null) {
            // Extract the package name (get root package)
            const fullImport = match[1];
            const packageName = fullImport.startsWith('@') 
              ? fullImport.split('/').slice(0, 2).join('/')
              : fullImport.split('/')[0];
            
            usedDependencies.add(packageName);
          }
          
          // Check for require statements
          const requireRegex = /require\s*\(\s*['"]([@\w\d\-/]+)['"]\s*\)/g;
          while ((match = requireRegex.exec(content)) !== null) {
            const fullImport = match[1];
            const packageName = fullImport.startsWith('@') 
              ? fullImport.split('/').slice(0, 2).join('/')
              : fullImport.split('/')[0];
            
            usedDependencies.add(packageName);
          }
        }
        
        // Find unused deps
        for (const [dep, version] of Object.entries(dependencies)) {
          // Skip built-in and special packages
          if (['react', 'react-dom'].includes(dep)) continue;
          
          if (!usedDependencies.has(dep)) {
            issues.push({
              type: 'unused-dependency',
              name: dep,
              version,
              manager,
              file: 'package.json',
              fix: {
                type: 'remove-dependency',
                name: dep
              }
            });
          }
        }
      } catch (err) {
        // Analysis of unused deps might fail, but we can continue
      }
      
    } catch (err) {
      issues.push({
        type: 'invalid-package-json',
        file: 'package.json',
        message: `Invalid package.json: ${err.message}`,
        fix: {
          type: 'ai-fix',
          description: 'Fix invalid package.json structure'
        }
      });
    }
    
    return issues;
  }

  /**
   * Analyzes Python dependencies
   * @param {string} projectPath - Project path
   * @returns {Array} - Dependency issues
   */
  analyzePythonDependencies(projectPath) {
    const issues = [];
    // Implementation for Python
    // Look for requirements.txt or Pipfile
    const requirementsPath = path.join(projectPath, 'requirements.txt');
    
    if (fs.existsSync(requirementsPath)) {
      try {
        const content = fs.readFileSync(requirementsPath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
        
        // Check for potentially insecure version constraints
        for (const line of lines) {
          const parts = line.split('==');
          if (parts.length === 2) {
            const [package_name, version] = parts;
            
            // Check if explicitly pinned to a potentially vulnerable version
            // This is just an example - in a real implementation we would check against a vulnerability database
            if (package_name.trim() === 'django' && version.startsWith('1.')) {
              issues.push({
                type: 'vulnerable-dependency',
                name: package_name.trim(),
                version: version.trim(),
                manager: 'pip',
                file: 'requirements.txt',
                message: `Potentially vulnerable version of ${package_name.trim()}`,
                fix: {
                  type: 'replace-in-file',
                  file: 'requirements.txt',
                  find: line,
                  replace: `${package_name.trim()}>=3.2.0`
                }
              });
            }
          }
        }
      } catch (err) {
        // Continue if there's an error reading the file
      }
    }
    
    return issues;
  }

  /**
   * Analyzes Java dependencies (Maven/Gradle)
   * @param {string} projectPath - Project path
   * @param {string} manager - Package manager 
   * @returns {Array} - Dependency issues
   */
  analyzeJavaDependencies(projectPath, manager) {
    const issues = [];
    
    if (manager === 'maven') {
      const pomPath = path.join(projectPath, 'pom.xml');
      
      if (fs.existsSync(pomPath)) {
        // Simple parsing of Maven pom.xml to find dependencies
        try {
          const content = fs.readFileSync(pomPath, 'utf8');
          
          // Very simple regex-based extraction - in production use a proper XML parser
          const dependencyRegex = /<dependency>[\s\S]*?<groupId>(.*?)<\/groupId>[\s\S]*?<artifactId>(.*?)<\/artifactId>[\s\S]*?<version>(.*?)<\/version>[\s\S]*?<\/dependency>/g;
          
          let match;
          while ((match = dependencyRegex.exec(content)) !== null) {
            const [_, groupId, artifactId, version] = match;
            
            // Example check for Spring Boot vulnerable versions
            if (groupId === 'org.springframework.boot' && artifactId === 'spring-boot-starter' 
                && version.match(/^1\./)) {
              issues.push({
                type: 'outdated-dependency',
                name: `${groupId}:${artifactId}`,
                currentVersion: version,
                recommendedVersion: '2.7.0',
                manager: 'maven',
                file: 'pom.xml',
                message: 'Outdated Spring Boot version',
                fix: {
                  type: 'replace-in-file',
                  file: 'pom.xml',
                  find: `<version>${version}</version>`,
                  replace: '<version>2.7.0</version>'
                }
              });
            }
          }
        } catch (err) {
          // Continue if there's an error parsing the file
        }
      }
    } else if (manager === 'gradle') {
      // Gradle parsing would go here
    }
    
    return issues;
  }

  /**
   * Get all files recursively from directory
   * @param {string} dir - Directory path
   * @param {Array} extensions - Array of file extensions to include
   * @returns {Array} - Array of file paths
   */
  getAllFiles(dir, extensions = []) {
    const results = [];
    
    function traverse(currentDir) {
      const files = fs.readdirSync(currentDir);
      
      for (const file of files) {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory() && !file.startsWith('node_modules') && !file.startsWith('.git')) {
          traverse(filePath);
        } else if (stat.isFile()) {
          const ext = path.extname(file);
          if (extensions.length === 0 || extensions.includes(ext)) {
            results.push(filePath);
          }
        }
      }
    }
    
    traverse(dir);
    return results;
  }

  /**
   * Enhance dependency issues with AI recommendations
   * @param {Array} issues - Detected issues
   * @param {string} projectPath - Project path
   * @returns {Array} - Enhanced issues with AI recommendations
   */
  async enhanceWithAI(issues, projectPath) {
    if (issues.length === 0) return issues;
    
    // Prepare context for AI
    const packageJsonPath = path.join(projectPath, 'package.json');
    let packageContext = '';
    
    if (fs.existsSync(packageJsonPath)) {
      packageContext = fs.readFileSync(packageJsonPath, 'utf8');
    }
    
    // Sample of code files for context
    const files = this.getAllFiles(projectPath, ['.js', '.jsx', '.ts', '.tsx']).slice(0, 3);
    let codeContext = '';
    
    for (const file of files) {
      codeContext += `\n// ${path.relative(projectPath, file)}\n`;
      codeContext += fs.readFileSync(file, 'utf8').slice(0, 500) + '...\n';
    }
    
    const context = `
Project dependencies context:
${packageContext}

Sample code:
${codeContext}
    `;
    
    // AI enhancement for complex issues
    for (let i = 0; i < issues.length; i++) {
      const issue = issues[i];
      
      if (issue.fix && issue.fix.type === 'ai-fix') {
        try {
          const prompt = `
You are analyzing a project with dependency issues. Based on the following context and issue, provide a specific fix recommendation:

Context:
${context}

Issue:
${JSON.stringify(issue, null, 2)}

Provide a specific recommendation for fixing this issue. Format your response as a JSON object with:
1. "fixDescription": Brief description of what needs to be done
2. "fixCode": The exact code or commands to fix the issue
3. "confidence": A number between 0-1 indicating your confidence in this fix
          `;
          
          const aiRecommendation = await fetchAIRecommendation(prompt);
          
          if (aiRecommendation && aiRecommendation.fixCode) {
            issue.fix.aiRecommendation = aiRecommendation;
          }
        } catch (err) {
          console.error('Error fetching AI recommendation:', err);
        }
      }
    }
    
    return issues;
  }

  /**
   * Apply fixes for dependency issues
   * @param {Array} issues - Dependency issues to fix
   * @param {string} projectPath - Project path
   * @returns {Array} - Results of applied fixes
   */
  applyFixes(issues, projectPath) {
    const results = [];
    
    for (const issue of issues) {
      const result = {
        issue,
        success: false,
        message: ''
      };
      
      try {
        if (!issue.fix) {
          result.message = 'No fix available';
          results.push(result);
          continue;
        }
        
        switch (issue.fix.type) {
          case 'command':
            execSync(issue.fix.command, { cwd: projectPath });
            result.success = true;
            result.message = `Successfully executed: ${issue.fix.command}`;
            break;
            
          case 'remove-dependency':
            const packageJsonPath = path.join(projectPath, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
              
              if (packageJson.dependencies && packageJson.dependencies[issue.name]) {
                delete packageJson.dependencies[issue.name];
              }
              
              if (packageJson.devDependencies && packageJson.devDependencies[issue.name]) {
                delete packageJson.devDependencies[issue.name];
              }
              
              fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
              result.success = true;
              result.message = `Removed unused dependency: ${issue.name}`;
            } else {
              result.message = 'package.json not found';
            }
            break;
            
          case 'replace-in-file':
            const filePath = path.join(projectPath, issue.fix.file);
            if (fs.existsSync(filePath)) {
              let content = fs.readFileSync(filePath, 'utf8');
              content = content.replace(issue.fix.find, issue.fix.replace);
              fs.writeFileSync(filePath, content);
              result.success = true;
              result.message = `Updated ${issue.fix.file}`;
            } else {
              result.message = `File not found: ${issue.fix.file}`;
            }
            break;
            
          case 'ai-fix':
            if (issue.fix.aiRecommendation && issue.fix.aiRecommendation.fixCode) {
              // Apply the AI-recommended fix
              const fix = issue.fix.aiRecommendation;
              
              if (fix.fixCode.startsWith('npm ') || fix.fixCode.startsWith('yarn ')) {
                execSync(fix.fixCode, { cwd: projectPath });
              } else if (issue.file) {
                fs.writeFileSync(path.join(projectPath, issue.file), fix.fixCode);
              }
              
              result.success = true;
              result.message = `Applied AI fix: ${fix.fixDescription}`;
            } else {
              result.message = 'No AI fix recommendation available';
            }
            break;
            
          default:
            result.message = `Unknown fix type: ${issue.fix.type}`;
        }
      } catch (err) {
        result.message = `Error applying fix: ${err.message}`;
      }
      
      results.push(result);
    }
    
    return results;
  }
}

module.exports = new DependencyAnalyzer();