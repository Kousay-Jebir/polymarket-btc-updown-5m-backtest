import { loadMarkets } from '../utils/loader.js';
import { strategyRunner } from './strategy-runner.js';
import { Strategy } from '../models/actions.js';
import { BacktestResult, InitialState, FinalState } from '../models/results.js';

export async function backTest(
    dataPath: string,
    strategy: Strategy,
    initialState: InitialState
): Promise<BacktestResult> {

    const actions: any[] = [];
    const markets = await loadMarkets(dataPath);

    markets.forEach((market) => {
        const strategyActions = strategyRunner(market, strategy);

        strategyActions.forEach((action) => {
            actions.push({
                ...action,
                outcome: market.outcome,
                slug: market.slug,
            });
        });
    });

    const finalState: FinalState = {
        balance: initialState.balance,
        error: null,
    };

    actions.forEach((action, index) => {
        if (action.type === 'trade') {
            if (action.token === action.outcome) {
                finalState.balance += action.shares - action.stake;
            } else {
                finalState.balance -= action.stake;
            }

            if (finalState.balance < 0) {
                finalState.error = {
                    actionIndex: index,
                    message: 'Low balance',
                };
            }
        }
    });

    return { actionsTrace: actions, finalState };
}