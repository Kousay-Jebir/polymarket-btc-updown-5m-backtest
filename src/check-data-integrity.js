// summarize-backtest-data-to-file.js
const fs = require("fs");
const path = require("path");

// Folder with processed backtest data
const DATA_DIR = "./backtest-data";

// Output summary file
const OUTPUT_FILE = "./backtest-summary.txt";

// Helper: convert milliseconds to h m s
function msToHHMMSS(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
}

function summarizeFiles() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));
    let summary = "";

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        try {
            const rawData = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(rawData);

            if (!Array.isArray(data) || data.length === 0) {
                summary += `${file} → empty\n-------------------------------------\n`;
                continue;
            }

            const firstObj = data[0];
            const lastObj = data[data.length - 1];

            const firstTime = new Date(Number(firstObj.timestamp)).toLocaleString();
            const lastTime = new Date(Number(lastObj.timestamp)).toLocaleString();
            const duration = Number(lastObj.timestamp) - Number(firstObj.timestamp);

            summary += `File: ${file}\n`;
            summary += `  Number of objects: ${data.length}\n`;
            summary += `  First timestamp: ${firstTime}\n`;
            summary += `  Last timestamp:  ${lastTime}\n`;
            summary += `  Duration: ${msToHHMMSS(duration)}\n`;
            summary += `-------------------------------------\n`;

        } catch (err) {
            summary += `Error reading ${file}: ${err}\n-------------------------------------\n`;
        }
    }

    // Write the summary to a file
    fs.writeFileSync(OUTPUT_FILE, summary, "utf-8");
    console.log(`Summary written to ${OUTPUT_FILE}`);
}

summarizeFiles();