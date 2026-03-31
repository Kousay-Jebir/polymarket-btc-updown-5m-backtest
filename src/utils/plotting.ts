import * as fs from 'fs';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { ChartConfiguration } from 'chart.js';

export async function plotBalance(balanceEvolution: number[]) {
    const width = 1920;
    const height = 1080;

    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const configuration: ChartConfiguration<'line'> = {
        type: 'line',
        data: {
            labels: balanceEvolution.map((_, i) => i),
            datasets: [
                {
                    label: 'Balance Evolution',
                    data: balanceEvolution,
                    borderWidth: 1,
                    fill: false,
                    pointRadius: 0,
                },
            ],
        },
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    fs.writeFileSync('balance.png', buffer);
}