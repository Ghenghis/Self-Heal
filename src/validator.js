const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * The Validator class handles validation of fixes before they are applied
 * and confirms that applied fixes don't break the codebase.
 */
class Validator {
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.validationMethods = this.detectValidationMethods();
  }

  /**
   * Detect available validation methods in the project
   * @returns {Object} Available validation methods
   */
  detectValidationMethods() {
    const methods = {
      hasTests: false,
      hasLinter: false,
      hasTypeChecker: false,
      testCommand: null,
      lintCommand: null,
      typeCheckCommand: null
    };

    // Check for package.json
    const packageJsonPath = path.join(this.projectPath, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        
        // Check for test scripts
        if (packageJson.scripts) {
          if (packageJson.scripts.test) {
            methods.hasTests = true;
            methods.testCommand = 'npm test';
          }
          if (packageJson.scripts.lint) {
            methods.hasLinter = true;
            methods.lintCommand = 'npm run lint';
          }
          if (packageJson.scripts.typecheck || packageJson.scripts['type-check']) {
            methods.hasTypeChecker = true;
            methods.typeCheckCommand = packageJson.scripts.typecheck ? 
              'npm run typecheck' : 'npm run type-check';
          }
        }
        
        // Check for dev dependencies
        if (packageJson.devDependencies) {
          if (!methods.hasLinter) {
            if (packageJson.devDependencies.eslint) {
              methods.hasLinter = true;
              methods.lintCommand = 'npx eslint .';
            }
          }
          
          if (!methods.hasTypeChecker) {
            if (packageJson.devDependencies.typescript) {
              methods.hasTypeChecker = true;
              methods.typeCheckCommand = 'npx tsc --noEmit';
            }
          }
        }
      } catch (error) {
        console.error('Error parsing package.json:', error.message);
      }
    }
    
    return methods;
  }

  /**
   * Validate if a fix would break the codebase
   * @param {string} filePath - Path to the file being fixed
   * @param {string} originalContent - Original file content
   * @param {string} fixedContent - Fixed file content
   * @returns {Promise<Object>} - Validation result
   */
  async validateFix(filePath, originalContent, fixedContent) {
    const result = {
      valid: true,
      reason: null
    };
    
    // Create a backup of the original file
    const backupPath = `${filePath}.backup`;
    fs.writeFileSync(backupPath, originalContent);
    
    // Write the fixed content to the file
    fs.writeFileSync(filePath, fixedContent);
    
    try {
      // Run validation methods
      const validationResults = await this.runValidations();
      
      if (!validationResults.valid) {
        result.valid = false;
        result.reason = validationResults.reason;
      }
    } catch (error) {
      result.valid = false;
      result.reason = `Validation error: ${error.message}`;
    } finally {
      // Restore the original file
      fs.writeFileSync(filePath, originalContent);
      fs.unlinkSync(backupPath);
    }
    
    return result;
  }

  /**
   * Run available validation methods
   * @returns {Promise<Object>} - Validation results
   */
  async runValidations() {
    const result = {
      valid: true,
      reason: null
    };
    
    // Run linter if available
    if (this.validationMethods.hasLinter) {
      const lintResult = await this.runCommand(this.validationMethods.lintCommand);
      if (!lintResult.success) {
        result.valid = false;
        result.reason = `Linting failed: ${lintResult.output}`;
        return result;
      }
    }
    
    // Run type checker if available
    if (this.validationMethods.hasTypeChecker) {
      const typeCheckResult = await this.runCommand(this.validationMethods.typeCheckCommand);
      if (!typeCheckResult.success) {
        result.valid = false;
        result.reason = `Type checking failed: ${typeCheckResult.output}`;
        return result;
      }
    }
    
    // Run tests if available
    if (this.validationMethods.hasTests) {
      const testResult = await this.runCommand(this.validationMethods.testCommand);
      if (!testResult.success) {
        result.valid = false;
        result.reason = `Tests failed: ${testResult.output}`;
        return result;
      }
    }
    
    return result;
  }

  /**
   * Run a shell command
   * @param {string} command - Command to run
   * @returns {Promise<Object>} - Command result
   */
  runCommand(command) {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      
      const process = spawn(cmd, args, {
        cwd: this.projectPath,
        shell: true
      });
      
      let output = '';
      
      process.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      process.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      process.on('close', (code) => {
        resolve({
          success: code === 0,
          output
        });
      });
    });
  }
}

module.exports = Validator;