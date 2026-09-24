import * as fs from 'fs';
import { backTest, collectMetrics, filterTrades, plotBalance } from "polymarket-btc-updown-5m-backtest";

const naiveStrategy = () => {
    return (marketEntry, { buy, up, down, end, differenceInSeconds, firstMarketEntry, lastMarketEntry }) => {
        if (up.best_ask >= 0.9) {
            buy('up', 1)
            if (up.best_ask >= 0.95) {
                //buy('down', 1)
            }
            end()
        }
        else if (down.best_ask >= 0.9) {
            buy('down', 1)
            if (down.best_ask >= 0.95) {
                //buy('up', 1)
            }
            end()
        }
    }
}

const naiveStrategy4 = () => {
    return (marketEntry, { buy, up, down, end, differenceInSeconds, firstMarketEntry, lastMarketEntry }) => {
        if (up.best_ask <= 0.13 && up.best_ask >= 0.12) {
            buy('up', 1)
            if (up.best_ask >= 0.95) {
                //buy('down', 1)
            }
            end()
        }
        else if (down.best_ask <= 0.13 && down.best_ask >= 0.12) {
            buy('down', 1)
            if (down.best_ask >= 0.95) {
                //buy('up', 1)
            }
            end()
        }
    }
}



const naiveStrategy2 = () => {
    return (marketEntry, { buy, up, down, end, differenceInSeconds, firstMarketEntry, lastMarketEntry }) => {
        if (up.best_ask >= 0.9 && up.best_ask <= 0.91 && differenceInSeconds(marketEntry.timestamp, lastMarketEntry.timestamp) >= 40 && differenceInSeconds(marketEntry.timestamp, lastMarketEntry.timestamp) <= 45) {
            buy('down', 1)
            if (up.best_ask >= 0.95) {
                //buy('up', 5)
            }
            end()
        }
        else if (down.best_ask >= 0.9 && down.best_ask <= 0.91 && differenceInSeconds(marketEntry.timestamp, lastMarketEntry.timestamp) >= 40 && differenceInSeconds(marketEntry.timestamp, lastMarketEntry.timestamp) <= 45) {
            buy('up', 1)
            if (down.best_ask >= 0.95) {
                //buy('up', 5)
            }
            end()
        }
    }
}


const naiveStrategy3 = () => {
    return (marketEntry, { buy, up, down, end, differenceInSeconds, firstMarketEntry, lastMarketEntry }) => {
        if (up.best_ask >= 0.9
        ) {
            buy('up', 1)
            if (up.best_ask >= 0.95) {

            }
            end()
        }
        else if (down.best_ask >= 0.9) {
            buy('down', 1)
            if (down.best_ask >= 0.95) {

            }
            end()
        }
    }
}

backTest('../backtest-data', naiveStrategy4, {
    balance: 10
}).then((result) => {
    fs.writeFileSync(
        `backtest.json`,
        JSON.stringify(result, null, 2),
        'utf-8'
    );
    const metrics = collectMetrics(result, { balance: 10 })
    console.log(metrics.winRate)
    console.log(metrics.numberOfTrades)
    console.log(metrics.averageTradePrice)
    console.log(metrics.tradeProportion)
    plotBalance(metrics.balanceEvolution)
    console.log(filterTrades(result.actionsTrace, { winning: false, maxPrice: 0.05 }).length)
    console.log(filterTrades(result.actionsTrace, { winning: true, maxPrice: 0.05 }).length)
})