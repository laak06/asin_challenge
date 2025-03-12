#!/usr/bin/env node

/**
 * Visualize Performance Results
 * 
 * This script generates HTML charts from performance test results.
 * 
 * Usage: node examples/visualize-performance.js [input-file] [output-file]
 * 
 * Arguments:
 * input-file  - JSON file with performance results (default: performance-results.json)
 * output-file - HTML file to write the charts to (default: performance-results.html)
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const inputFile = process.argv[2] || 'performance-results.json';
const outputFile = process.argv[3] || 'performance-results.html';

// Read the performance results
const resultsPath = path.resolve(process.cwd(), inputFile);
if (!fs.existsSync(resultsPath)) {
  console.error(`Error: Input file not found: ${resultsPath}`);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Generate HTML with charts
function generateHtml(results) {
  // Extract data for charts
  const dbTypes = [...new Set(results.filter(r => !r.testType).map(r => r.dbType))];
  const recordCounts = [...new Set(results.filter(r => !r.testType).map(r => r.recordCount))].sort((a, b) => a - b);
  
  // Prepare data for the charts
  const connectTimeData = prepareChartData(results, 'connectTime');
  const saveTimeData = prepareChartData(results, 'saveTime');
  const totalTimeData = prepareChartData(results, 'totalTime');
  const recordsPerSecondData = prepareChartData(results, 'recordsPerSecond');
  
  // Prepare stress test data if available
  let stressTestData = null;
  const stressTest = results.find(r => r.testType === 'stress');
  if (stressTest) {
    stressTestData = {
      dbTypes,
      recordCounts,
      totalRecordsPerSecond: {},
      avgSaveTime: {}
    };
    
    for (const result of stressTest.stressResults) {
      if (!stressTestData.totalRecordsPerSecond[result.recordCount]) {
        stressTestData.totalRecordsPerSecond[result.recordCount] = {};
        stressTestData.avgSaveTime[result.recordCount] = {};
      }
      
      stressTestData.totalRecordsPerSecond[result.recordCount][result.dbType] = result.metrics.totalRecordsPerSecond;
      stressTestData.avgSaveTime[result.recordCount][result.dbType] = result.metrics.avgSaveTime;
    }
  }
  
  // Generate HTML
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Database Performance Results</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: white;
      padding: 20px;
      border-radius: 5px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }
    h1, h2 {
      color: #333;
    }
    .chart-container {
      margin-bottom: 30px;
      padding: 15px;
      background-color: white;
      border-radius: 5px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .chart-row {
      display: flex;
      flex-wrap: wrap;
      margin: 0 -10px;
    }
    .chart-col {
      flex: 1;
      min-width: 300px;
      padding: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
    }
    th, td {
      padding: 8px 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Database Performance Results</h1>
    
    <div class="chart-row">
      <div class="chart-col">
        <div class="chart-container">
          <h2>Connection Time (ms)</h2>
          <canvas id="connectTimeChart"></canvas>
        </div>
      </div>
      <div class="chart-col">
        <div class="chart-container">
          <h2>Save Time (ms)</h2>
          <canvas id="saveTimeChart"></canvas>
        </div>
      </div>
    </div>
    
    <div class="chart-row">
      <div class="chart-col">
        <div class="chart-container">
          <h2>Total Time (ms)</h2>
          <canvas id="totalTimeChart"></canvas>
        </div>
      </div>
      <div class="chart-col">
        <div class="chart-container">
          <h2>Records Per Second</h2>
          <canvas id="recordsPerSecondChart"></canvas>
        </div>
      </div>
    </div>
    
    ${stressTestData ? `
    <h2>Stress Test Results (${stressTest.numClients} Concurrent Clients)</h2>
    
    <div class="chart-row">
      <div class="chart-col">
        <div class="chart-container">
          <h2>Total Records Per Second (Stress Test)</h2>
          <canvas id="stressRecordsPerSecondChart"></canvas>
        </div>
      </div>
      <div class="chart-col">
        <div class="chart-container">
          <h2>Average Save Time (ms) (Stress Test)</h2>
          <canvas id="stressAvgSaveTimeChart"></canvas>
        </div>
      </div>
    </div>
    ` : ''}
    
    <h2>Summary Table</h2>
    <table>
      <thead>
        <tr>
          <th>Database Type</th>
          <th>Record Count</th>
          <th>Avg Connect Time (ms)</th>
          <th>Avg Save Time (ms)</th>
          <th>Avg Total Time (ms)</th>
          <th>Avg Records/sec</th>
        </tr>
      </thead>
      <tbody>
        ${results.filter(r => !r.testType).map(r => `
          <tr>
            <td>${r.dbType}</td>
            <td>${r.recordCount}</td>
            <td>${Math.round(r.avgMetrics.connectTime)}</td>
            <td>${Math.round(r.avgMetrics.saveTime)}</td>
            <td>${Math.round(r.avgMetrics.totalTime)}</td>
            <td>${Math.round(r.avgMetrics.recordsPerSecond)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    
    ${stressTestData ? `
    <h2>Stress Test Summary Table</h2>
    <table>
      <thead>
        <tr>
          <th>Database Type</th>
          <th>Record Count</th>
          <th>Total Records/sec</th>
          <th>Avg Save Time (ms)</th>
        </tr>
      </thead>
      <tbody>
        ${stressTest.stressResults.map(r => `
          <tr>
            <td>${r.dbType}</td>
            <td>${r.recordCount}</td>
            <td>${r.metrics.totalRecordsPerSecond}</td>
            <td>${Math.round(r.metrics.avgSaveTime)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}
  </div>

  <script>
    // Chart colors
    const colors = {
      sqlite: 'rgba(54, 162, 235, 0.7)',
      mysql: 'rgba(255, 99, 132, 0.7)',
      postgres: 'rgba(75, 192, 192, 0.7)'
    };
    
    // Create charts
    const ctx1 = document.getElementById('connectTimeChart').getContext('2d');
    const ctx2 = document.getElementById('saveTimeChart').getContext('2d');
    const ctx3 = document.getElementById('totalTimeChart').getContext('2d');
    const ctx4 = document.getElementById('recordsPerSecondChart').getContext('2d');
    
    // Connection Time Chart
    new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: ${JSON.stringify(connectTimeData)}
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    
    // Save Time Chart
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: ${JSON.stringify(saveTimeData)}
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    
    // Total Time Chart
    new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: ${JSON.stringify(totalTimeData)}
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    
    // Records Per Second Chart
    new Chart(ctx4, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: ${JSON.stringify(recordsPerSecondData)}
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Records/sec'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    
    ${stressTestData ? `
    // Stress Test Charts
    const ctx5 = document.getElementById('stressRecordsPerSecondChart').getContext('2d');
    const ctx6 = document.getElementById('stressAvgSaveTimeChart').getContext('2d');
    
    // Prepare stress test data
    const stressRecordsPerSecondData = [];
    const stressAvgSaveTimeData = [];
    
    ${JSON.stringify(dbTypes)}.forEach(dbType => {
      const recordsPerSecondDataset = {
        label: dbType,
        backgroundColor: colors[dbType],
        data: []
      };
      
      const avgSaveTimeDataset = {
        label: dbType,
        backgroundColor: colors[dbType],
        data: []
      };
      
      ${JSON.stringify(recordCounts)}.forEach(recordCount => {
        recordsPerSecondDataset.data.push(
          ${JSON.stringify(stressTestData.totalRecordsPerSecond)}[recordCount]?.[dbType] || 0
        );
        
        avgSaveTimeDataset.data.push(
          ${JSON.stringify(stressTestData.avgSaveTime)}[recordCount]?.[dbType] || 0
        );
      });
      
      stressRecordsPerSecondData.push(recordsPerSecondDataset);
      stressAvgSaveTimeData.push(avgSaveTimeDataset);
    });
    
    // Stress Test Records Per Second Chart
    new Chart(ctx5, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: stressRecordsPerSecondData
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Records/sec'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    
    // Stress Test Average Save Time Chart
    new Chart(ctx6, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(recordCounts)},
        datasets: stressAvgSaveTimeData
      },
      options: {
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Time (ms)'
            }
          },
          x: {
            title: {
              display: true,
              text: 'Record Count'
            }
          }
        }
      }
    });
    ` : ''}
  </script>
</body>
</html>
  `;
}

// Prepare data for charts
function prepareChartData(results, metricName) {
  const dbTypes = [...new Set(results.filter(r => !r.testType).map(r => r.dbType))];
  const recordCounts = [...new Set(results.filter(r => !r.testType).map(r => r.recordCount))].sort((a, b) => a - b);
  
  const datasets = [];
  
  const colors = {
    sqlite: 'rgba(54, 162, 235, 0.7)',
    mysql: 'rgba(255, 99, 132, 0.7)',
    postgres: 'rgba(75, 192, 192, 0.7)'
  };
  
  for (const dbType of dbTypes) {
    const dataset = {
      label: dbType,
      backgroundColor: colors[dbType],
      data: []
    };
    
    for (const recordCount of recordCounts) {
      const result = results.find(r => !r.testType && r.dbType === dbType && r.recordCount === recordCount);
      if (result) {
        dataset.data.push(result.avgMetrics[metricName]);
      } else {
        dataset.data.push(0);
      }
    }
    
    datasets.push(dataset);
  }
  
  return datasets;
}

// Generate and write the HTML file
const html = generateHtml(results);
const outputPath = path.resolve(process.cwd(), outputFile);
fs.writeFileSync(outputPath, html);

console.log(`Performance visualization generated: ${outputPath}`); 