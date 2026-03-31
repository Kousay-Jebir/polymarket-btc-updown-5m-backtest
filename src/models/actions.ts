import { CleanPriceChange, MarketEntry } from "./market.js";

export interface TradeStrategyAction {
    type: 'trade';
    token: 'up' | 'down';
    price: number;
    shares: number;
    stake: number;
    timestamp?: string;
    humanReadableDate?: string;
}

export interface IdleStrategyAction {
    type: 'idle';
}

export type StrategyAction = TradeStrategyAction | IdleStrategyAction;

export interface StrategyHelpers {
    buy: (token: 'up' | 'down', stake: number) => void;
    up: CleanPriceChange;
    down: CleanPriceChange;
    end: () => void;
}

export type Strategy = (marketEntry: MarketEntry, helpers: StrategyHelpers) => void;