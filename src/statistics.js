const fs = require('fs');
const { of, from, timestamp } = require('rxjs');
const path = require('path');

const fileNames = fs.readdirSync('./final-cleaned-data').map((fileName) => fileName.split('.')[0]);
const marketOutcomes = {

}

fileNames.forEach((fileName) => {
    const outcome = fileName.split('-')[4];
    marketOutcomes[fileName] = outcome.split('.')[0]
})

const frequency = Object.values(marketOutcomes).reduce((accumulator, currentValue) => {
    if (currentValue === 'up') {
        accumulator.up++
    }
    else {
        accumulator.down++
    }
    return accumulator
}, {
    up: 0,
    down: 0
})


async function loadMarkets(dirPath) {
    const files = await fs.promises.readdir(dirPath);
    const results = [];
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const parsed = JSON.parse(content);
            results.push({ file, data: parsed });
        } catch (err) {
            console.error(`Error reading/parsing file ${file}:`, err.message);
        }
    }
    return results;
}

function streamMarkets(markets) {
    return from(markets)
}

async function backTest(marketsDataPath, settings) {
    let trade;
    let price;
    streamMarkets(await loadMarkets(marketsDataPath)).subscribe({
        next: ({ file, data }) => {
            if (!Array.isArray(data) || data.length === 0) {
                return;
            }

            const lastTrade = data[data.length - 10];
            const first = lastTrade.price_changes[0];
            const second = lastTrade.price_changes[1];
            up = first.asset_id === file.split('.')[0].split('-').pop() ? first : second;
            down = first.asset_id === file.split('.')[0].split('-').pop() ? second : first
            const outcome = file.split('.')[0].split('-')[4];

            if (up.best_ask <= 0.1) {
                trade = "up"
                price = up.best_ask
            }
            else if (down.best_ask <= 0.1) {
                trade = "down"
                price = down.best_ask
            }
            settings.accumulator.push({
                trade,
                outcome,
                price,
                date: new Date(Number(lastTrade.timestamp))

            })

        },
        error: () => {
            return
        }
    });

    settings.accumulator.forEach((trade) => {
        if (trade.trade === trade.outcome) {
            settings.balance += settings.quantityPerTrade * (1 - trade.price) / trade.price
        }
        else {
            settings.balance -= settings.quantityPerTrade
        }
    })
    return settings
}
backTest('./final-cleaned-data3', {
    balance: 1000,
    quantityPerTrade: 1,
    accumulator: []

}).then((value) => {
    fs.writeFileSync(
        `backtest.json`,
        JSON.stringify(value, null, 2),
        'utf-8'
    );
})