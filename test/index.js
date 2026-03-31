import * as fs from 'fs';
import { backTest, collectMetrics, filterTrades, plotBalance } from "polymarket-btc-updown-5m-backtest";

const naiveStrategy = (marketEntry, { buy, up, down, end }) => {
    if (up.best_ask >= 0.9) {
        buy('up', 25)
        if (Number(up.best_ask) >= 0.95) {
            buy('down', 1)
        }
        end()
    }
    else if (down.best_ask >= 0.9) {
        buy('down', 25)
        if (down.best_ask >= 0.95) {
            buy('up', 1)
        }
        end()
    }
}

backTest('../backtest-data', naiveStrategy, {
    balance: 1000
}).then((result) => {
    fs.writeFileSync(
        `backtest.json`,
        JSON.stringify(result, null, 2),
        'utf-8'
    );
    const metrics = collectMetrics(result, { balance: 1000 })
    console.log(metrics.winRate)
    console.log(metrics.numberOfTrades)
    console.log(metrics.averageTradePrice)
    console.log(metrics.tradeProportion)
    plotBalance(metrics.balanceEvolution)
    console.log(filterTrades(result.actionsTrace, { winning: false, maxPrice: 0.05 }).length)
    console.log(filterTrades(result.actionsTrace, { winning: true, maxPrice: 0.05 }).length)
})