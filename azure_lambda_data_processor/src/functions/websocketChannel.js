const { app } = require('@azure/functions');
const WebSocket = require('ws');
const zLib = require('zlib');

app.http('websocketChannel', {
    methods: ['POST'],
    authLevel: 'function',
    handler: async (request, context) => {
        context.log(`Starting Polymarket listener for request: "${request.url}"`);

        // 1. Get Input Data
        const body = await request.json();
        const tokenId = body.tokenId;

        if (!tokenId) {
            return { status: 400, body: "Missing tokenId in request body." };
        }

        const priceHistory = [];
        const POLYMARKET_WS_URL = 'wss://ws-subscriptions-clob.polymarket.com/ws/market';

        return new Promise((resolve) => {
            const ws = new WebSocket(POLYMARKET_WS_URL);
            const timeout = setTimeout(() => {
                ws.close();
                const compressed = zLib.gzipSync(JSON.stringify(priceHistory));
                resolve({
                    status: 200,
                    body: JSON.stringify({
                        status: "timeout",
                        data: compressed.toString('base64'),
                        encoding: "gzip+base64"
                    })
                });
            }, 180000);

            ws.on('open', () => {
                context.log(`Connected to Polymarket WS for Token: ${tokenId}`);
                const subscribeMsg = {
                    type: "market",
                    initial_dump: false,
                    assets_ids: [tokenId],
                };
                ws.send(JSON.stringify(subscribeMsg));
            });

            ws.on('message', (data) => {
                const event = JSON.parse(data);
                context.log("Received event")
                // 2. Record Price Change
                if (event.event_type === 'price_change') {
                    const record = {
                        timestamp: event.timestamp,
                        price_changes: event.price_changes
                    };
                    priceHistory.push(record);
                }

                // 3. Detect Resolution and Finish
                if (event.event_type === 'market_resolved') {
                    clearTimeout(timeout);
                    ws.close();
                    const compressed = zlib.gzipSync(JSON.stringify(priceHistory));
                    context.log(`Market ${tokenId} Resolved. Finalizing data.`);
                    resolve({
                        status: 200,
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            status: "success",
                            tokenId: tokenId,
                            data: compressed.toString('base64'),
                            encoding: "gzip+base64"
                        })
                    });
                }
            });

            ws.on('error', (err) => {
                context.log(`WS Error: ${err.message}`);
                clearTimeout(timeout);
                resolve({ status: 500, body: `WebSocket Error: ${err.message}` });
            });
        });
    }
});