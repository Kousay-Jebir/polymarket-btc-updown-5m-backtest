export interface PriceChange {
    asset_id: string;
    price: string;
    size: string;
    side: 'BUY' | 'SELL';
    hash: string;
    best_bid: string;
    best_ask: string;
}

export interface CleanPriceChange extends Omit<PriceChange, 'best_ask' | 'best_bid' | 'price'> {
    best_ask: number;
    best_bid: number;
    price: number;
}

export interface MarketEntry {
    timestamp: string;
    price_changes: PriceChange[];
}

export type Market = MarketEntry[];

export interface LoadedMarket {
    upTokenId: string;
    downTokenId: string;
    slug: string;
    outcome: string;
    data: Market;
}