import * as fs from 'fs';
import * as path from 'path';
import { Market, LoadedMarket } from '../models/market.js';

export async function loadMarkets(dirPath: string): Promise<LoadedMarket[]> {
    const files = await fs.promises.readdir(dirPath);
    const results: LoadedMarket[] = [];

    for (const file of files) {
        const fullPath = path.join(dirPath, file);

        const content = await fs.promises.readFile(fullPath, 'utf-8');
        const parsed: Market = JSON.parse(content);

        const upTokenId = file.split('.')[0].split('-')[5];
        const downTokenId = file.split('.')[0].split('-')[6];
        const outcome = file.split('.')[0].split('-')[4];
        const slug = file.split('.')[0].split('-').slice(0, 4).join('-');

        results.push({ outcome, upTokenId, downTokenId, slug, data: parsed });
    }

    return results;
}