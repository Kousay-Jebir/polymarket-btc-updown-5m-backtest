const fs = require('fs')
const readBase64GzipFile = require('./decode-file')
const prune = require('./prune-data')

const { lastValueFrom } = require('rxjs');
const { toArray } = require('rxjs/operators');

async function cleanData() {
    let marketId = 1774274400;
    const slug = 'btc-updown-5m-';

    while (true) {
        try {
            const fileName = fs.readdirSync('./cleaned-data')
                .find(f => f.startsWith(`${slug}${marketId}`));
            const response = await fetch(`https://gamma-api.polymarket.com/markets/slug/${slug}${marketId}`);
            const upTokenId = JSON.parse((await response.json()).clobTokenIds)[0]
            if (!fileName) break;

            const data = await readBase64GzipFile(`./cleaned-data/${fileName}`);
            const data$ = prune(data, 1000);
            const finalData = await lastValueFrom(data$.pipe(toArray()));
            fs.writeFileSync(
                `./final-cleaned-data3/${fileName}-${upTokenId}.json`,
                JSON.stringify(finalData, null, 2),
                'utf-8'
            );

            console.log(`Saved ${fileName}.json, ${finalData.length} items`);
            marketId += 300;
        } catch (error) {
            console.error(error);
            break;
        }
    }
}

cleanData()