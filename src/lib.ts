import * as fs from 'fs';
import { of, from, timestamp, Observable, filter } from 'rxjs';
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

interface CleanPriceChange extends Omit<PriceChange, 'best_ask' | 'best_bid' | 'price'> {
    best_ask: number;
    best_bid: number,
    price: number
}

const cleanAsset = (asset: PriceChange): CleanPriceChange => ({
    ...asset,
    best_ask: Number(asset.best_ask),
    best_bid: Number(asset.best_bid),
    price: Number(asset.price)
});

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

export interface TradeStrategyAction {
    type: 'trade',
    token: 'up' | 'down',
    price: number,
    shares: number,
    stake: number,
    timestamp?: string,
    humanReadableDate?: string
}

export interface IdleStrategyAction {
    type: 'idle';
}

export interface InitialState {
    balance: number
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

type TradeFilterCriteria = {
    winning?: boolean;
    token?: 'up' | 'down';
    minPrice?: number;
    maxPrice?: number;
    minStake?: number;
    maxStake?: number;
};


export interface BacktestResult {
    actionsTrace: (StrategyAction & { outcome: string, slug: string })[],
    finalState: FinalState
}

export type StrategyAction = TradeStrategyAction | IdleStrategyAction;

interface StrategyHelpers {
    buy: (token: 'up' | 'down', stake: number) => void;
    up: CleanPriceChange;
    down: CleanPriceChange;
    end: () => void
}

type Strategy = (marketEntry: MarketEntry, strategyHelpers: StrategyHelpers) => void;

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

function strategyRunner(loadedMarket: LoadedMarket, strategy: Strategy) {
    const { data, upTokenId, downTokenId, outcome, slug } = loadedMarket;
    const actions: StrategyAction[] = []

    function buy(token: 'up' | 'down', stake: number, asset: CleanPriceChange, timestamp: string) {
        actions.push({ type: 'trade', token: token, price: asset.best_ask, shares: Math.floor((stake / asset.best_ask) * 10000) / 10000, timestamp: timestamp, humanReadableDate: new Date(Number(timestamp)).toISOString(), stake: stake },
        )
    }

    for (let index = 0; index < data.length; index++) {
        let exitSignal = false;
        const marketEntry = data[index];
        const first = marketEntry.price_changes[0];
        const second = marketEntry.price_changes[1];
        const [rawUp, rawDown] = first.asset_id === upTokenId ? [first, second] : [second, first];
        const up = cleanAsset(rawUp);
        const down = cleanAsset(rawDown)
        strategy(marketEntry, {
            buy: (token: 'up' | 'down', stake: number) => {
                switch (token) {
                    case 'up':
                        buy(token, stake, up, marketEntry.timestamp)
                        break;
                    case 'down':
                        buy(token, stake, down, marketEntry.timestamp)
                        break;
                    default:
                        break
                }
            },
            up,
            down,
            end: () => {
                exitSignal = true;
            }
        })

        if (exitSignal) {
            break
        }
    }
    return actions;
}

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

        const strategyActions = strategyRunner(loadedMarket, strategy);

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
                finalState.balance += (action.shares - action.stake);
            } else {
                finalState.balance -= action.stake;
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
            balance += (action.shares - action.stake);
        } else {
            balance -= action.stake;
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

const tradeReversals: Strategy = (marketEntry, { buy, up, down, end }) => {
    if (up.best_ask <= 0.05 && up.best_ask >= 0.01) {
        buy('up', 1)
        end()
    }
    else if (down.best_ask <= 0.05 && down.best_ask >= 0.01) {
        buy('down', 1)
        end()
    }
}

const naiveStrategy: Strategy = (marketEntry, { buy, up, down, end }) => {
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


export function filterTrades(
    actions: (StrategyAction & { outcome: string; slug: string })[],
    criteria: TradeFilterCriteria
): (StrategyAction & { outcome: string; slug: string })[] {
    return actions.filter(action => {
        if (action.type !== 'trade') return false;

        if (criteria.winning !== undefined) {
            const isWin = action.token === action.outcome;
            if (criteria.winning !== isWin) return false;
        }

        if (criteria.token && action.token !== criteria.token) return false;
        if (criteria.minPrice !== undefined && action.price < criteria.minPrice) return false;
        if (criteria.maxPrice !== undefined && action.price > criteria.maxPrice) return false;
        if (criteria.minStake !== undefined && action.stake < criteria.minStake) return false;
        if (criteria.maxStake !== undefined && action.stake > criteria.maxStake) return false;

        return true;
    });
}

async function plotBalance(balanceEvolution: number[]) {
    const width = 1920;
    const height = 1080;

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