import * as fs from 'fs';
import { of, from, timestamp, Observable } from 'rxjs';
import * as path from 'path';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

export interface PriceChange {
    asset_id: string;
    price: string;
    size: string;
    side: 'BUY' | 'SELL';
    hash: string;
    best_bid: string;
    best_ask: string;
}

export interface MarketEntry {
    timestamp: string;
    price_changes: PriceChange[];
}

export type Market = MarketEntry[];

export interface LoadedMarket {
    upTokenId: string,
    downTokenId: string,
    slug: string,
    outcome: string,
    data: Market;
}

export interface StrategyInitialState {
    assetIds: {
        upToken: string,
        downToken?: string
    }
}

async function loadMarkets(dirPath: string): Promise<LoadedMarket[]> {
    const files = await fs.promises.readdir(dirPath);
    const results: LoadedMarket[] = [];
    for (const file of files) {
        const fullPath = path.join(dirPath, file);
        try {
            const content = await fs.promises.readFile(fullPath, 'utf-8');
            const parsed: Market = JSON.parse(content);
            const upTokenId = file.split('.')[0].split('-')[5]
            const downTokenId = file.split('.')[0].split('-')[6]
            const outcome = file.split('.')[0].split('-')[4]
            const slug = file.split('.')[0].split('-').slice(0, 4).join('-');
            results.push({ outcome, upTokenId, downTokenId, slug, data: parsed });
        } catch (err: any) {
            console.error(`Error reading/parsing file ${file}:`, err.message);
            throw err
        }
    }
    return results;
}

function streamMarkets(markets: LoadedMarket[]): Observable<LoadedMarket> {
    return from(markets)
}

export interface TradeStrategyAction {
    type: 'trade',
    token: 'up' | 'down',
    price: number,
    shares: number,
    timestamp?: string,
    humanReadableDate?: string
}

export interface IdleStrategyAction {
    type: 'idle';
}

export interface InitialState {
    balance: number,
    stake: number
}

export interface FinalState {
    balance: number,
    error: { actionIndex: number, message: string } | null
}

export interface BacktestStatisticsResult {
    winRate: number;
    idleProportion: number;
    tradeProportion: number;
    winningTradeIndexes: number[];
    losingTradeIndexes: number[];
    balanceEvolution: number[];
    averageTradePrice: number | null;
    averageWinningTradePrice: number | null;
    numberOfTrades: number;
}

export interface BacktestResult {
    actionsTrace: (StrategyAction & { outcome: string, slug: string })[],
    finalState: FinalState
}

export type StrategyAction = TradeStrategyAction | IdleStrategyAction;

type Strategy = (loadedMarket: LoadedMarket, initialState: InitialState) => StrategyAction[]; //initialState: StrategyInitialState) => void


async function backTest(
    dataPath: string,
    strategy: Strategy,
    initialState: InitialState
): Promise<BacktestResult> {

    const actions: (StrategyAction & { outcome: string, slug: string })[] = [];

    const markets = await loadMarkets(dataPath);

    markets.forEach((loadedMarket: LoadedMarket) => {
        if (!Array.isArray(loadedMarket.data) || loadedMarket.data.length === 0) {
            return;
        }

        const strategyActions = strategy(loadedMarket, initialState);

        strategyActions.forEach((action) => {
            actions.push({
                ...action,
                outcome: loadedMarket.outcome,
                slug: loadedMarket.slug
            });
        });
    });

    const finalState: FinalState = {
        balance: initialState.balance,
        error: null
    };

    for (let index = 0; index < actions.length; index++) {
        const action = actions[index];

        if (action.type === 'trade') {

            if (action.token === action.outcome) {
                finalState.balance += (action.shares - initialState.stake);
            } else {
                finalState.balance -= initialState.stake;
            }

            if (finalState.balance < 0) {
                finalState.error = {
                    actionIndex: index,
                    message: `Action with index ${index} cannot be executed due to low balance.`
                };
            }
        }
    }

    return {
        actionsTrace: actions,
        finalState
    };
}

function collectMetrics(
    result: BacktestResult,
    initialState: InitialState
): BacktestStatisticsResult {

    const actions = result.actionsTrace;

    let totalTrades = 0;
    let idleCount = 0;
    let wins = 0;

    const winningTradeIndexes: number[] = [];
    const losingTradeIndexes: number[] = [];
    const balanceEvolution: number[] = [];

    let balance = initialState.balance;

    let totalTradePrice = 0;
    let totalWinningTradePrice = 0;

    actions.forEach((action: any, index) => {

        // Track balance evolution BEFORE applying action
        balanceEvolution.push(balance);

        if (action.type === 'idle') {
            idleCount++;
            return;
        }

        // Trade
        totalTrades++;

        const isWin = action.token === action.outcome;

        if (isWin) {
            wins++;
            winningTradeIndexes.push(index);
            totalWinningTradePrice += action.price;
        }
        else {
            losingTradeIndexes.push(index);
        }

        totalTradePrice += action.price;

        // Apply PnL
        if (isWin) {
            balance += (action.shares - initialState.stake);
        } else {
            balance -= initialState.stake;
        }
    });

    // push final balance
    balanceEvolution.push(balance);

    const totalActions = actions.length;

    return {
        winRate: totalTrades > 0 ? wins / totalTrades : 0,
        idleProportion: totalActions > 0 ? idleCount / totalActions : 0,
        tradeProportion: totalActions > 0 ? totalTrades / totalActions : 0,
        winningTradeIndexes,
        losingTradeIndexes,
        balanceEvolution,
        averageTradePrice: totalTrades > 0 ? totalTradePrice / totalTrades : null,
        averageWinningTradePrice: wins > 0 ? totalWinningTradePrice / wins : null,
        numberOfTrades: totalTrades
    };
}

//example usage of backtest

const tradeReversals: Strategy = (loadedMarket, initialState) => {
    let trade: 'up' | 'down';
    let price: string;
    const { data, upTokenId, downTokenId, outcome, slug } = loadedMarket;
    const actions: StrategyAction[] = []
    for (let index = 0; index < data.length; index++) {
        const lastTrade = data[index];
        const first = lastTrade.price_changes[0];
        const second = lastTrade.price_changes[1];
        const up = first.asset_id === upTokenId ? first : second;
        const down = first.asset_id === downTokenId ? first : second;

        if (Number(up.best_ask) <= 0.05 && Number(up.best_ask) >= 0.01) {
            trade = "up"
            price = up.best_ask
            actions.push({
                type: 'trade',
                token: trade,
                price: Number(price),
                shares: Math.floor((initialState.stake / Number(price)) * 10000) / 10000
            })
            break
        }
        else if (Number(down.best_ask) <= 0.05 && Number(down.best_ask) >= 0.01) {
            trade = "down"
            price = down.best_ask
            actions.push({
                type: 'trade',
                token: trade,
                price: Number(price),
                shares: Math.floor((initialState.stake / Number(price)) * 10000) / 10000
            })
            break
        }
    }
    return actions.length == 0 ? [{
        type: 'idle'
    }] : actions

}


const naiveStrategy: Strategy = (loadedMarket, initialState) => {
    const { data, upTokenId, downTokenId, outcome, slug } = loadedMarket;
    const actions: StrategyAction[] = []
    for (let index = 0; index < data.length; index++) {
        const lastTrade = data[index];
        const first = lastTrade.price_changes[0];
        const second = lastTrade.price_changes[1];
        const up = first.asset_id === upTokenId ? first : second;
        const down = first.asset_id === downTokenId ? first : second;

        if (Number(up.best_ask) >= 0.9 && Number(up.best_ask)) {
            actions.push({ type: 'trade', token: 'up', price: Number(up.best_ask), shares: Math.floor((initialState.stake / Number(up.best_ask)) * 10000) / 10000, timestamp: data[index].timestamp, humanReadableDate: new Date(Number(data[index].timestamp)).toISOString() })
            break
        }
        else if (Number(down.best_ask) >= 0.9) {
            actions.push({ type: 'trade', token: 'down', price: Number(down.best_ask), shares: Math.floor((initialState.stake / Number(down.best_ask)) * 10000) / 10000, timestamp: data[index].timestamp, humanReadableDate: new Date(Number(data[index].timestamp)).toISOString() })
            break
        }
    }
    return actions
}


function filterTrades(
    actions: (StrategyAction & { outcome: string; slug: string })[],
    winningIndexes: number[]
): (StrategyAction & { outcome: string; slug: string })[] {

    return winningIndexes
        .filter(index => index >= 0 && index < actions.length)
        .map(index => actions[index]);
}

async function plotBalance(balanceEvolution: number[]) {
    const width = 800;
    const height = 400;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration: ChartConfiguration<'line'> = {
        type: 'line',
        data: {
            labels: balanceEvolution.map((_, i) => i),
            datasets: [
                {
                    label: 'Balance Evolution',
                    data: balanceEvolution,
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0,
                },
            ],
        },
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('balance.png', buffer);
}

backTest('./backtest-data', naiveStrategy, {
    balance: 1000,
    stake: 1
}).then((result) => {
    fs.writeFileSync(
        `backtest.json`,
        JSON.stringify(result, null, 2),
        'utf-8'
    );
    const metrics = collectMetrics(result, { balance: 1000, stake: 1 })
    console.log(metrics.winRate)
    console.log(metrics.numberOfTrades)
    console.log(metrics.averageTradePrice)
    console.log(metrics.tradeProportion)
    plotBalance(metrics.balanceEvolution)
    console.log(filterTrades(result.actionsTrace, metrics.losingTradeIndexes,))
})