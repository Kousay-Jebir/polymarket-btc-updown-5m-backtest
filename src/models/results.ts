import { StrategyAction } from './actions.js';

export interface InitialState {
    balance: number;
}

export interface FinalState {
    balance: number;
    error: { actionIndex: number; message: string } | null;
}

export interface BacktestResult {
    actionsTrace: (StrategyAction & { outcome: string; slug: string })[];
    finalState: FinalState;
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

export type TradeFilterCriteria = {
    winning?: boolean;
    token?: 'up' | 'down';
    minPrice?: number;
    maxPrice?: number;
    minStake?: number;
    maxStake?: number;
};