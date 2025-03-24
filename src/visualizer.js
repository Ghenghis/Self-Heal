// src/visualizer.js
const fs = require('fs');
const path = require('path');

/**
 * Generate a D3.js-based visualization of the dependency graph
 */
class DependencyVisualizer {
  /**
   * Generate an HTML file with a D3.js visualization of the dependency graph
   * @param {Object} graphData - Graph data from DependencyGraph.exportForVisualization()
   * @param {string} outputPath - Path to save the HTML file
   */
  generateVisualization(graphData, outputPath) {
    const html = this.generateHtml(graphData);
    fs.writeFileSync(outputPath, html);
    return outputPath;
  }

  /**
   * Generate HTML with embedded D3.js visualization
   * @param {Object} graphData - Graph data
   * @returns {string} - HTML content
   */
  generateHtml(graphData) {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Project Dependency Graph</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    
    #container {
      position: relative;
      width: 100%;
      height: 100vh;
    }
    
    svg {
      display: block;
      width: 100%;
      height: 100%;
    }
    
    .node {
      stroke: #fff;
      stroke-width: 1.5px;
    }
    
    .link {
      stroke: #999;
      stroke-opacity: 0.6;
    }
    
    .tooltip {
      position: absolute;
      padding: 10px;
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      pointer-events: none;
      font-size: 14px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .controls {
      position: absolute;
      top: 10px;
      left: 10px;
      background-color: rgba(255, 255, 255, 0.8);
      border-radius: 4px;
      padding: 10px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
  </style>
</head>
<body>
  <div id="container">
    <div class="controls">
      <button id="togglePhysics">Toggle Physics</button>
      <button id="centerGraph">Center Graph</button>
      <div>
        <label for="filterGroup">Filter by type: </label>
        <select id="filterGroup">
          <option value="all">All</option>
          <option value="1">JavaScript</option>
          <option value="2">TypeScript</option>
          <option value="3">Styles</option>
          <option value="4">JSON</option>
          <option value="5">Documentation</option>
          <option value="0">Other</option>
        </select>
      </div>
    </div>
    <div id="tooltip" class="tooltip" style="display:none;"></div>
  </div>

  <script src="https://d3js.org/d3.v7.min.js"></script>
  <script>
    // Graph data
    const graphData = ${JSON.stringify(graphData)};
    
    // Set up the visualization
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Group colors
    const color = d3.scaleOrdinal()
      .domain([0, 1, 2, 3, 4, 5])
      .range(["#ccc", "#6baed6", "#fd8d3c", "#74c476", "#9e9ac8", "#969696"]);
    
    // Group labels
    const groupLabels = {
      0: "Other",
      1: "JavaScript",
      2: "TypeScript",
      3: "Styles",
      4: "JSON",
      5: "Documentation"
    };
    
    // Create SVG
    const svg = d3.select("#container")
      .append("svg")
      .attr("viewBox", [0, 0, width, height]);
    
    // Set up the simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links).id(d => d.id).distance(100))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(30));
    
    // Create links
    const link = svg.append("g")
      .selectAll("line")
      .data(graphData.links)
      .join("line")
      .attr("class", "link")
      .attr("stroke-width", d => Math.sqrt(d.value));
    
    // Create nodes
    const node = svg.append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .join("circle")
      .attr("class", "node")
      .attr("r", 8)
      .attr("fill", d => color(d.group))
      .call(drag(simulation))
      .on("mouseover", showTooltip)
      .on("mouseout", hideTooltip);
    
    // Add node labels
    const label = svg.append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .join("text")
      .text(d => {
        const parts = d.id.split('/');
        return parts[parts.length - 1];
      })
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4);
    
    // Set up simulation tick function
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
      
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });
    
    // Drag functions
    function drag(simulation) {
      function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
      }
      
      function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
      }
      
      function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
      }
      
      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    }
    
    // Tooltip functions
    function showTooltip(event, d) {
      const tooltip = d3.select("#tooltip");
      tooltip.style("display", "block")
        .html(\`
          <strong>File:</strong> \${d.id}<br>
          <strong>Type:</strong> \${groupLabels[d.group]}
        \`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");
    }
    
    function hideTooltip() {
      d3.select("#tooltip").style("display", "none");
    }
    
    // Controls
    let physicsEnabled = true;
    
    d3.select("#togglePhysics").on("click", () => {
      physicsEnabled = !physicsEnabled;
      if (physicsEnabled) {
        simulation.alpha(0.3).restart();
      } else {
        simulation.stop();
      }
    });
    
    d3.select("#centerGraph").on("click", () => {
      simulation.force("center", d3.forceCenter(width / 2, height / 2))
        .alpha(0.3).restart();
    });
    
    d3.select("#filterGroup").on("change", function() {
      const value = this.value;
      
      if (value === "all") {
        // Show all nodes and links
        node.style("display", "block");
        link.style("display", "block");
      } else {
        // Filter nodes by group
        node.style("display", d => d.group == value ? "block" : "none");
        
        // Filter links where either source or target is in the selected group
        link.style("display", d => {
          return d.source.group == value || d.target.group == value ? "block" : "none";
        });
      }
    });
  </script>
</body>
</html>
    `;
  }
}

module.exports = DependencyVisualizer;