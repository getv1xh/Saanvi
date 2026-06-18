import { createCanvas } from '@napi-rs/canvas';
import {
        Chart,
        LinearScale,
        LineElement,
        PointElement,
        LineController,
        CategoryScale,
        Filler,
        Title,
} from 'chart.js';
import https from 'https';

Chart.register(LinearScale, LineElement, PointElement, LineController, CategoryScale, Filler, Title);

const COINGECKO_IDS = {
        btc:    'bitcoin',
        eth:    'ethereum',
        ltc:    'litecoin',
        bch:    'bitcoin-cash',
        doge:   'dogecoin',
        zec:    'zcash',
        dash:   'dash',
        xrp:    'ripple',
        xlm:    'stellar',
        trx:    'tron',
        sol:    'solana',
        bnb:    'binancecoin',
        pol:    'matic-network',
        avax:   'avalanche-2',
        algo:   'algorand',
        ada:    'cardano',
        xtz:    'tezos',
        xmr:    'monero',
        dot:    'polkadot',
        near:   'near',
        flr:    'flare-networks',
        kaia:   'klay-token',
        cro:    'crypto-com-chain',
        arb:    'arbitrum',
        op:     'optimism',
        inj:    'injective-protocol',
        sui:    'sui',
        apt:    'aptos',
        sei:    'sei-network',
        mnt:    'mantle',
        hbar:   'hedera-hashgraph',
        kcs:    'kucoin-shares',
        usdt:   'tether',
        usdc:   'usd-coin',
        link:   'chainlink',
        shib:   'shiba-inu',
        uni:    'uniswap',
        aave:   'aave',
        etc:    'ethereum-classic',
        pepe:   'pepe',
        dai:    'dai',
        render: 'render-token',
        ena:    'ethena',
        nexo:   'nexo',
        wld:    'worldcoin-wld',
        ondo:   'ondo-finance',
        okb:    'okb',
        dot:    'polkadot',
        bgb:    'bitget-token',
        gt:     'gate',
};

const fetchJson = (url) =>
        new Promise((resolve, reject) => {
                https
                        .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
                                let data = '';
                                res.on('data', (c) => (data += c));
                                res.on('end', () => {
                                        try { resolve(JSON.parse(data)); }
                                        catch { reject(new Error('JSON parse failed')); }
                                });
                                res.on('error', reject);
                        })
                        .on('error', reject);
        });

/**
 * Generates a 7-day price performance chart for a coin.
 * @param {string} chainKey - Key from CHAINS config (e.g. 'btc')
 * @returns {Promise<Buffer|null>} PNG buffer, or null if unsupported/failed
 */
export async function generatePriceChart(chainKey) {
        const coinId = COINGECKO_IDS[chainKey?.toLowerCase()];
        if (!coinId) return null;

        let data;
        try {
                data = await fetchJson(
                        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7&interval=hourly`,
                );
        } catch {
                return null;
        }

        const prices = data?.prices;
        if (!prices?.length) return null;

        const sampled = prices.filter((_, i) => i % 6 === 0 || i === prices.length - 1);
        const labels  = sampled.map(([ts]) => {
                const d = new Date(ts);
                return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}h`;
        });
        const values = sampled.map(([, p]) => p);

        const startPrice = prices[0][1];
        const endPrice   = prices[prices.length - 1][1];
        const change     = ((endPrice - startPrice) / startPrice) * 100;
        const isUp       = change >= 0;
        const lineColor  = isUp ? '#4ade80' : '#f87171';
        const fillColor  = isUp ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)';

        const W = 900, H = 320;
        const canvas = createCanvas(W, H);
        const ctx    = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#0f1012';
        ctx.fillRect(0, 0, W, H);

        // Subtle top border line
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(0, 0, W, 1);

        const priceLabel = `$${endPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
        const changeLabel = `${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%  (7d)`;

        const chart = new Chart(ctx, {
                type: 'line',
                data: {
                        labels,
                        datasets: [{
                                data: values,
                                borderColor: lineColor,
                                backgroundColor: (ctx2) => {
                                        const grad = ctx2.chart.ctx.createLinearGradient(0, 0, 0, H);
                                        grad.addColorStop(0, isUp ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)');
                                        grad.addColorStop(1, 'rgba(0,0,0,0)');
                                        return grad;
                                },
                                borderWidth: 2.5,
                                pointRadius: 0,
                                pointHoverRadius: 0,
                                fill: true,
                                tension: 0.35,
                        }],
                },
                options: {
                        responsive: false,
                        animation: false,
                        plugins: {
                                legend: { display: false },
                                title: {
                                        display: true,
                                        text: [`${priceLabel}`, `${changeLabel}`],
                                        color: ['#ffffff', lineColor],
                                        font: [
                                                { size: 18, weight: 'bold', family: 'sans-serif' },
                                                { size: 13, weight: 'normal', family: 'sans-serif' },
                                        ],
                                        padding: { top: 18, bottom: 12 },
                                        align: 'center',
                                },
                        },
                        scales: {
                                x: {
                                        ticks: {
                                                color: '#666',
                                                font: { size: 11, family: 'sans-serif' },
                                                maxRotation: 0,
                                                maxTicksLimit: 9,
                                                padding: 6,
                                        },
                                        grid:  { color: 'rgba(255,255,255,0.05)' },
                                        border: { color: 'rgba(255,255,255,0.1)', dash: [4, 4] },
                                },
                                y: {
                                        position: 'right',
                                        ticks: {
                                                color: '#666',
                                                font: { size: 11, family: 'sans-serif' },
                                                padding: 8,
                                                callback: (v) =>
                                                        `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
                                        },
                                        grid:  { color: 'rgba(255,255,255,0.05)' },
                                        border: { color: 'rgba(255,255,255,0.1)', dash: [4, 4] },
                                },
                        },
                        layout: { padding: { left: 20, right: 20, bottom: 16, top: 0 } },
                },
        });

        chart.draw();
        return canvas.toBuffer('image/png');
}
