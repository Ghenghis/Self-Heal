/**
 * Dependency Updater
 * 
 * Automatically updates dependencies with known vulnerabilities.
 * Integrates with the main self-healing system.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { queryAI } = require('../ai');

class DependencyUpdater {
  constructor(projectPath, options = {}) {
    this.projectPath = projectPath;
    this.options = {
      createBackup: true,
      testAfterUpdate: true,
      commitMessage: '🔒 Auto-fix: Update vulnerable dependencies',
      ...options
    };
    this.updatedDependencies = [];
    this.errors = [];
  }

  /**
   * Main healing method that fixes vulnerable dependencies
   */
  async heal(vulnerabilities) {
    console.log(`Attempting to heal ${vulnerabilities.length} vulnerable dependencies...`);
    
    // Filter autoFixable vulnerabilities
    const fixable = vulnerabilities.filter(v => v.fix && v.fix.autoFix);
    
    if (fixable.length === 0) {
      console.log('No auto-fixable vulnerabilities found.');
      return {
        updated: [],
        skipped: vulnerabilities.map(v => ({
          package: v.package,
          reason: 'Not marked as auto-fixable'
        })),
        errors: []
      };
    }
    
    // Create backup if needed
    if (this.options.createBackup) {
      await this.createBackup();
    }
    
    // Group by project type for more efficient healing
    const byType = this.groupByProjectType(fixable);
    
    // Fix each group
    for (const [type, vulns] of Object.entries(byType)) {
      await this.healByType(type, vulns);
    }
    
    // Run tests if configured
    if (this.options.testAfterUpdate && this.updatedDependencies.length > 0) {
      await this.runTests();
    }
    
    return {
      updated: this.updatedDependencies,
      skipped: vulnerabilities
        .filter(v => !this.updatedDependencies.find(u => u.package === v.package))
        .map(v => ({
          package: v.package,
          reason: 'Update failed or skipped'
        })),
      errors: this.errors
    };
  }

  /**
   * Group vulnerabilities by project type for batch processing
   */
  groupByProjectType(vulnerabilities) {
    const groups = {};
    
    vulnerabilities.forEach(vuln => {
      // Determine type from fix command
      let type = 'unknown';
      
      if (vuln.fix.command.startsWith('npm')) {
        type = 'npm';
      } else if (vuln.fix.command.startsWith('pip')) {
        type = 'pip';
      } else if (vuln.fix.command.startsWith('mvn')) {
        type = 'maven';
      } else if (vuln.fix.command.includes('build.gradle')) {
        type = 'gradle';
      }
      
      if (!groups[type]) {
        groups[type] = [];
      }
      
      groups[type].push(vuln);
    });
    
    return groups;
  }

  /**
   * Heal dependencies by project type
   */
  async healByType(type, vulnerabilities) {
    switch (type) {
      case 'npm':
        await this.healNpmDependencies(vulnerabilities);
        break;
      case 'pip':
        await this.healPipDependencies(vulnerabilities);
        break;
      case 'maven':
        await this.healMavenDependencies(vulnerabilities);
        break;
      case 'gradle':
        await this.healGradleDependencies(vulnerabilities);
        break;
      default:
        await this.healGenericDependencies(vulnerabilities);
        break;
    }
  }

  /**
   * Create a backup of dependency files before updating
   */
  async createBackup() {
    const backupDir = path.join(this.projectPath, '.self-heal', 'backups');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `deps-backup-${timestamp}`);
    
    try {
      // Create backup directory
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      // Backup package.json
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageLockPath = path.join(this.projectPath, 'package-lock.json');
        
        // Create backup folder
        fs.mkdirSync(backupPath, { recursive: true });
        
        // Copy package.json
        fs.copyFileSync(
          packageJsonPath,
          path.join(backupPath, 'package.json')
        );
        
        // Copy package-lock.json if exists
        if (fs.existsSync(packageLockPath)) {
          fs.copyFileSync(
            packageLockPath,
            path.join(backupPath, 'package-lock.json')
          );
        }
      }
      
      // Backup requirements.txt
      const requirementsPath = path.join(this.projectPath, 'requirements.txt');
      if (fs.existsSync(requirementsPath)) {
        // Create backup folder if not already created
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }
        
        // Copy requirements.txt
        fs.copyFileSync(
          requirementsPath,
          path.join(backupPath, 'requirements.txt')
        );
      }
      
      // Backup pom.xml
      const pomPath = path.join(this.projectPath, 'pom.xml');
      if (fs.existsSync(pomPath)) {
        // Create backup folder if not already created
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }
        
        // Copy pom.xml
        fs.copyFileSync(
          pomPath,
          path.join(backupPath, 'pom.xml')
        );
      }
      
      // Backup build.gradle
      const gradlePath = path.join(this.projectPath, 'build.gradle');
      if (fs.existsSync(gradlePath)) {
        // Create backup folder if not already created
        if (!fs.existsSync(backupPath)) {
          fs.mkdirSync(backupPath, { recursive: true });
        }
        
        // Copy build.gradle
        fs.copyFileSync(
          gradlePath,
          path.join(backupPath, 'build.gradle')
        );
      }
      
      console.log(`Created backup at ${backupPath}`);
    } catch (error) {
      console.error('Error creating backup:', error.message);
      this.errors.push({
        type: 'backup',
        message: `Failed to create backup: ${error.message}`
      });
    }
  }

  /**
   * Heal npm dependencies
   */
  async healNpmDependencies(vulnerabilities) {
    try {
      // Get unique packages to update
      const packagesToUpdate = [...new Set(vulnerabilities.map(v => {
        const { package: pkgName, fix } = v;
        return fix.target ? `${pkgName}@${fix.target}` : pkgName;
      }))];
      
      if (packagesToUpdate.length === 0) return;
      
      // Update packages in a single command
      const updateCommand = `npm install --save ${packagesToUpdate.join(' ')}`;
      console.log(`Running: ${updateCommand}`);
      
      execSync(updateCommand, { 
        cwd: this.projectPath,
        stdio: 'inherit'
      });
      
      // Record successful updates
      vulnerabilities.forEach(vuln => {
        this.updatedDependencies.push({
          package: vuln.package,
          from: vuln.currentVersion,
          to: vuln.fix.target || 'latest',
          severity: vuln.severity
        });
      });
    } catch (error) {
      console.error('Error updating npm dependencies:', error.message);
      this.errors.push({
        type: 'npm',
        message: `Failed to update dependencies: ${error.message}`
      });
      
      // Try updating one by one
      await this.healDependenciesOneByOne(vulnerabilities, 'npm');
    }
  }

  /**
   * Heal pip dependencies
   */
  async healPipDependencies(vulnerabilities) {
    try {
      // For pip, we'll update one by one since it's the safer approach
      await this.healDependenciesOneByOne(vulnerabilities, 'pip');
    } catch (error) {
      console.error('Error updating pip dependencies:', error.message);
      this.errors.push({
        type: 'pip',
        message: `Failed to update pip dependencies: ${error.message}`
      });
    }
  }

  /**
   * Heal Maven dependencies
   */
  async healMavenDependencies(vulnerabilities) {
    // This would require parsing and updating pom.xml
    // For complex files like pom.xml, we might need to use the AI approach
    await this.healComplexDependencies(vulnerabilities, 'maven', 'pom.xml');
  }

  /**
   * Heal Gradle dependencies
   */
  async healGradleDependencies(vulnerabilities) {
    // This would require parsing and updating build.gradle
    await this.healComplexDependencies(vulnerabilities, 'gradle', 'build.gradle');
  }

  /**
   * Heal generic dependencies
   */
  async healGenericDependencies(vulnerabilities) {
    // For unknown types, try to execute the fix commands directly
    await this.healDependenciesOneByOne(vulnerabilities, 'generic');
  }

  /**
   * Helper method to update dependencies one by one
   */
  async healDependenciesOneByOne(vulnerabilities, type) {
    for (const vuln of vulnerabilities) {
      try {
        console.log(`Updating ${vuln.package} from ${vuln.currentVersion} to ${vuln.fix.target || 'latest'}...`);
        
        execSync(vuln.fix.command, { 
          cwd: this.projectPath,
          stdio: 'inherit'
        });
        
        this.updatedDependencies.push({
          package: vuln.package,
          from: vuln.currentVersion,
          to: vuln.fix.target || 'latest',
          severity: vuln.severity
        });
      } catch (error) {
        console.error(`Error updating ${vuln.package}:`, error.message);
        this.errors.push({
          type,
          package: vuln.package,
          message: `Failed to update: ${error.message}`
        });
      }
    }
  }

  /**
   * Helper method to update dependencies in complex files using AI assistance
   */
  async healComplexDependencies(vulnerabilities, type, filename) {
    if (vulnerabilities.length === 0) return;
    
    const filePath = path.join(this.projectPath, filename);
    if (!fs.existsSync(filePath)) {
      this.errors.push({
        type,
        message: `${filename} not found`
      });
      return;
    }
    
    try {
      // Read the current file
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Prepare AI prompt
      const prompt = `
        I have a ${filename} file with vulnerable dependencies that need to be updated.
        Here is the current content:
        
        ${content}
        
        Please update the following dependencies to fix security vulnerabilities:
        ${vulnerabilities.map(v => `
        - ${v.package}: update from ${v.currentVersion} to ${v.fix.target || 'latest'}
        `).join('')}
        
        Return ONLY the updated file content, without explanation.
      `;
      
      // Query AI for updated content
      const updatedContent = await queryAI(prompt);
      
      // Write the updated content
      fs.writeFileSync(filePath, updatedContent, 'utf8');
      
      // Record successful updates
      vulnerabilities.forEach(vuln => {
        this.updatedDependencies.push({
          package: vuln.package,
          from: vuln.currentVersion,
          to: vuln.fix.target || 'latest',
          severity: vuln.severity,
          method: 'ai-assisted'
        });
      });
    } catch (error) {
      console.error(`Error updating ${filename}:`, error.message);
      this.errors.push({
        type,
        message: `Failed to update ${filename}: ${error.message}`
      });
    }
  }

  /**
   * Run tests after updating dependencies
   */
  async runTests() {
    try {
      // Detect appropriate test command
      let testCommand = null;
      
      // Check for npm project
      const packageJsonPath = path.join(this.projectPath, 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        if (packageJson.scripts && packageJson.scripts.test) {
          testCommand = 'npm test';
        }
      }
      
      // Check for pytest
      if (!testCommand && fs.existsSync(path.join(this.projectPath, 'pytest.ini'))) {
        testCommand = 'pytest';
      }
      
      // Check for Maven
      if (!testCommand && fs.existsSync(path.join(this.projectPath, 'pom.xml'))) {
        testCommand = 'mvn test';
      }
      
      // Check for Gradle
      if (!testCommand && fs.existsSync(path.join(this.projectPath, 'build.gradle'))) {
        testCommand = './gradlew test';
      }
      
      // Run tests if command found
      if (testCommand) {
        console.log(`Running tests: ${testCommand}`);
        execSync(testCommand, { 
          cwd: this.projectPath,
          stdio: 'inherit'
        });
        console.log('Tests passed successfully!');
      } else {
        console.log('No test command detected. Skipping tests.');
      }
    } catch (error) {
      console.error('Tests failed after dependency updates:', error.message);
      this.errors.push({
        type: 'test',
        message: `Tests failed after updates: ${error.message}`
      });
      
      // In a more advanced implementation, we might want to roll back changes here
    }
  }
}

module.exports = DependencyUpdater;