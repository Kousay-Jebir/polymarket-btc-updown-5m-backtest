import { StrategyAction } from '../models/actions.js';
import { BacktestResult, BacktestStatisticsResult, TradeFilterCriteria, InitialState } from '../models/results.js';

export function collectMetrics(
    result: BacktestResult,
    initialState: InitialState
): BacktestStatisticsResult {

    const actions = result.actionsTrace;

    let totalTrades = 0, idle = 0, wins = 0;
    let balance = initialState.balance;

    const balanceEvolution: number[] = [];
    const winningTradeIndexes: number[] = [];
    const losingTradeIndexes: number[] = [];

    let totalPrice = 0, winningPrice = 0;

    actions.forEach((a: any, i) => {
        balanceEvolution.push(balance);

        if (a.type === 'idle') return idle++;

        totalTrades++;

        const win = a.token === a.outcome;

        if (win) {
            wins++;
            winningTradeIndexes.push(i);
            winningPrice += a.price;
        } else {
            losingTradeIndexes.push(i);
        }

        totalPrice += a.price;

        balance += win ? (a.shares - a.stake) : -a.stake;
    });

    balanceEvolution.push(balance);

    return {
        winRate: wins / totalTrades || 0,
        idleProportion: idle / actions.length || 0,
        tradeProportion: totalTrades / actions.length || 0,
        winningTradeIndexes,
        losingTradeIndexes,
        balanceEvolution,
        averageTradePrice: totalTrades ? totalPrice / totalTrades : null,
        averageWinningTradePrice: wins ? winningPrice / wins : null,
        numberOfTrades: totalTrades
    };
}

export function filterTrades(actions: (StrategyAction & { outcome: string; slug: string })[], criteria: TradeFilterCriteria) {
    return actions.filter(a => {
        if (a.type !== 'trade') return false;

        if (criteria.winning !== undefined) {
            const win = a.token === a.outcome;
            if (win !== criteria.winning) return false;
        }

        if (criteria.token && a.token !== criteria.token) return false;
        if (criteria.minPrice && a.price < criteria.minPrice) return false;
        if (criteria.maxPrice && a.price > criteria.maxPrice) return false;

        return true;
    });
}