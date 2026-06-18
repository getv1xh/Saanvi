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

        const canvas = createCanvas(900, 280);
        const ctx    = canvas.getContext('2d');

        ctx.fillStyle = '#111214';
        ctx.fillRect(0, 0, 900, 280);

        const chart = new Chart(ctx, {
                type: 'line',
                data: {
                        labels,
                        datasets: [{
                                data: values,
                                borderColor: lineColor,
                                backgroundColor: fillColor,
                                borderWidth: 2.5,
                                pointRadius: 0,
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
                                        text: `7d  ·  ${isUp ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%`,
                                        color: isUp ? '#4ade80' : '#f87171',
                                        font: { size: 13, weight: 'bold', family: 'sans-serif' },
                                        padding: { top: 14, bottom: 6 },
                                        align: 'end',
                                },
                        },
                        scales: {
                                x: {
                                        ticks: { color: '#555', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 },
                                        grid:  { color: 'rgba(255,255,255,0.04)' },
                                        border: { color: 'rgba(255,255,255,0.08)' },
                                },
                                y: {
                                        position: 'right',
                                        ticks: {
                                                color: '#555',
                                                font: { size: 10 },
                                                callback: (v) =>
                                                        `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
                                        },
                                        grid:  { color: 'rgba(255,255,255,0.04)' },
                                        border: { color: 'rgba(255,255,255,0.08)' },
                                },
                        },
                        layout: { padding: { left: 16, right: 16, bottom: 14, top: 0 } },
                },
        });

        chart.draw();
        return canvas.toBuffer('image/png');
}
