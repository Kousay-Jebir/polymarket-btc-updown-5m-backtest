// clean-polymarket-data-backtest.js
const fs = require("fs");
const path = require("path");

// Input and output folders
const DATA_DIR = "./final-cleaned-data3";
const OUTPUT_DIR = "./backtest-data";

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR);
}

// Minimum duration to keep a file (2 minutes in ms)
const MIN_DURATION_MS = 2 * 60 * 1000;

const MONTHS = {
    January: 0, February: 1, March: 2, April: 3,
    May: 4, June: 5, July: 6, August: 7,
    September: 8, October: 9, November: 10, December: 11
};

async function processFiles() {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith(".json"));

    for (const file of files) {
        try {
            const filePath = path.join(DATA_DIR, file);
            const rawData = fs.readFileSync(filePath, "utf-8");
            let data = JSON.parse(rawData);

            if (!Array.isArray(data) || data.length === 0) {
                console.log(`Skipping empty array in ${file}`);
                continue;
            }
            const slugMatch = file.match(/^(.+?-\d+)-/);
            if (!slugMatch) {
                console.log(`Cannot parse slug from file ${file}`);
                continue;
            }
            const slug = slugMatch[1];

            // Fetch market info from Polymarket
            const url = `https://gamma-api.polymarket.com/markets/slug/${slug}`;
            const res = await fetch(url);
            if (!res.ok) {
                console.log(`Failed to fetch market for slug ${slug}`);
                continue;
            }
            const marketData = await res.json();

            if (!marketData?.question) {
                console.log(`No question field for slug ${slug}`);
                continue;
            }

            // Parse start and end time from question string
            // Example: "Bitcoin Up or Down - March 23, 11:05AM-11:10AM ET"
            const question = marketData.question;
            const match = question.match(/- ([\w\s,]+), (\d{1,2}:\d{2}[APM]+)-(\d{1,2}:\d{2}[APM]+) ET$/);
            console.log(match)
            if (!match) {
                console.log(`Cannot parse times from question for ${slug}: ${question}`);
                continue;
            }

            const [_, monthDay, startTime, endTime] = match;
            const parseDate = (timeStr) => {
                const year = 2026; // fixed year
                const [monthName, dayStr] = monthDay.trim().split(" ");
                const month = MONTHS[monthName];
                const day = parseInt(dayStr, 10);

                // Parse time like "11:05AM" or "4:10PM"
                const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(AM|PM)/);
                if (!timeMatch) throw new Error(`Invalid time string: ${timeStr}`);
                let [_, hourStr, minStr, ampm] = timeMatch;
                let hour = parseInt(hourStr, 10);
                const min = parseInt(minStr, 10);

                if (ampm === "PM" && hour !== 12) hour += 12;
                if (ampm === "AM" && hour === 12) hour = 0;

                // ET = UTC-4 → add 4 hours to convert ET → UTC for UTC timestamp
                const unixMillis = Date.UTC(year, month, day, hour + 4, min, 0);
                return unixMillis;
            };
            const startDate = parseDate(startTime);
            const endDate = parseDate(endTime);
            // Filter out objects with timestamps beyond endDate
            data = data.filter(obj => Number(obj.timestamp) <= endDate);

            // Discard file if empty or duration < 2 minutes
            if (data.length === 0) {
                console.log(`Discarding ${file}: all timestamps after market end`);
                continue;
            }

            const duration = Number(data[data.length - 1].timestamp) - Number(data[0].timestamp);
            if (duration < MIN_DURATION_MS) {
                console.log(`Discarding ${file}: duration < 2 min`);
                continue;
            }

            // Save filtered data to output folder
            const outPath = path.join(OUTPUT_DIR, file);
            fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
            console.log(`Processed ${file}: kept ${data.length} entries → saved to backtest-data`);

        } catch (err) {
            console.error(`Error processing ${file}:`, err);
        }
    }
}

processFiles();