// src/index.js
const fs = require('fs');
const path = require('path');
const DependencyGraph = require('./dependency-graph');
const DependencyVisualizer = require('./visualizer');

/**
 * Main entry point for the Project Healer
 */
async function main() {
  const args = parseArgs();
  
  // Create output directory if it doesn't exist
  if (!fs.existsSync(args.output)) {
    fs.mkdirSync(args.output, { recursive: true });
  }
  
  // If graph option is enabled, create dependency graph
  if (args.graph) {
    console.log('Generating dependency graph...');
    await generateDependencyGraph(args.project, args.output);
  }
  
  // Other healing logic would go here...
  
  console.log('Done!');
}

/**
 * Parse command line arguments
 * @returns {Object} - Parsed arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    fix: true,
    report: true,
    graph: false,
    project: process.cwd(),
    output: path.join(process.cwd(), 'healer-report')
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--fix') {
      options.fix = true;
    } else if (arg === '--no-fix') {
      options.fix = false;
    } else if (arg === '--report') {
      options.report = true;
    } else if (arg === '--no-report') {
      options.report = false;
    } else if (arg === '--graph') {
      options.graph = true;
    } else if (arg === '--project' && i + 1 < args.length) {
      options.project = args[++i];
    } else if (arg === '--output' && i + 1 < args.length) {
      options.output = args[++i];
    }
  }
  
  return options;
}

/**
 * Generate a dependency graph visualization
 * @param {string} projectDir - The project directory
 * @param {string} outputDir - Output directory
 */
async function generateDependencyGraph(projectDir, outputDir) {
  const graph = new DependencyGraph();
  await graph.scanProject(projectDir);
  
  // Find issues
  const circularDeps = graph.findCircularDependencies();
  const unusedFiles = graph.findUnusedFiles();
  
  // Log issues
  if (circularDeps.length > 0) {
    console.log(`Found ${circularDeps.length} circular dependencies:`);
    circularDeps.forEach((cycle, i) => {
      console.log(`  ${i + 1}. ${cycle.join(' -> ')} -> ${cycle[0]}`);
    });
  }
  
  if (unusedFiles.length > 0) {
    console.log(`Found ${unusedFiles.length} unused files:`);
    unusedFiles.forEach((file, i) => {
      console.log(`  ${i + 1}. ${file}`);
    });
  }
  
  // Generate visualization
  const graphData = graph.exportForVisualization();
  const visualizer = new DependencyVisualizer();
  const outputPath = path.join(outputDir, 'dependency-graph.html');
  visualizer.generateVisualization(graphData, outputPath);
  
  console.log(`Dependency graph saved to ${outputPath}`);
  
  return {
    circularDependencies: circularDeps,
    unusedFiles
  };
}

// If this file is run directly (not imported)
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}

module.exports = {
  main,
  generateDependencyGraph
};