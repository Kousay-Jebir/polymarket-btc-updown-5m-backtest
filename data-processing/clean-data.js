const fs = require('fs')

async function getMarketOutcome(slug) {
    const response = await fetch(`https://gamma-api.polymarket.com/markets/slug/${slug}`);
    const outcomePrices = JSON.parse((await response.json()).outcomePrices);
    return outcomePrices[0] === '1' ? 'up' : 'down'
}

async function cleanData() {
    let marketId = 1774274400;
    const slug = 'btc-updown-5m-'
    while (true) {
        try {
            const fileName = `${slug}${marketId}.json`
            file = fs.readFileSync(`./data/${fileName}`, {
                encoding: 'utf-8'
            })
            const data = JSON.parse(JSON.parse(file)[0].data).data
            const outcome = await getMarketOutcome(`${slug}${marketId}`)
            fs.writeFileSync(`./cleaned-data/btc-updown-5m-${marketId}-${outcome}`, data, {
                encoding: 'utf-8'
            })
            marketId += 300
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                console.log("Data cleaned successfully.")
            }
            else {
                throw error
            }
            break
        }
    }
}

cleanData()