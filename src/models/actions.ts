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
    up: any;
    down: any;
    end: () => void;
}

export type Strategy = (marketEntry: any, helpers: StrategyHelpers) => void;