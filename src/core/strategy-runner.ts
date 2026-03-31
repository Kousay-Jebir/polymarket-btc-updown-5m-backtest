import { LoadedMarket, PriceChange } from '../models/market.js';
import { Strategy, StrategyAction } from '../models/actions.js';

function cleanAsset(asset: PriceChange) {
    return {
        ...asset,
        best_ask: Number(asset.best_ask),
        best_bid: Number(asset.best_bid),
        price: Number(asset.price),
    };
}

export function strategyRunner(loadedMarket: LoadedMarket, strategy: Strategy) {
    const { data, upTokenId } = loadedMarket;
    const actions: StrategyAction[] = [];

    function buy(token: 'up' | 'down', stake: number, asset: any, timestamp: string) {
        actions.push({
            type: 'trade',
            token,
            price: asset.best_ask,
            shares: Math.floor((stake / asset.best_ask) * 10000) / 10000,
            stake,
            timestamp,
            humanReadableDate: new Date(Number(timestamp)).toISOString(),
        });
    }

    for (const entry of data) {
        let exitSignal = false;

        const [first, second] = entry.price_changes;
        const [rawUp, rawDown] =
            first.asset_id === upTokenId ? [first, second] : [second, first];

        const up = cleanAsset(rawUp);
        const down = cleanAsset(rawDown);

        strategy(entry, {
            buy: (token, stake) => {
                buy(token, stake, token === 'up' ? up : down, entry.timestamp);
            },
            up,
            down,
            end: () => (exitSignal = true),
        });

        if (exitSignal) break;
    }

    return actions;
}