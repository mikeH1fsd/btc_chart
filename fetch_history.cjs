const fs = require('fs');
const https = require('https');
const path = require('path');

const SYMBOL = 'BTCUSDT';
const INTERVAL = '1h';
const LIMIT = 1000;
const TARGET_CANDLES = 43800; // ~5 years
const OUTPUT_FILE = path.join(__dirname, 'public', 'btc_h1_5y.json');

const fetchBatch = (endTime) => {
    return new Promise((resolve, reject) => {
        const url = `https://api.binance.com/api/v3/klines?symbol=${SYMBOL}&interval=${INTERVAL}&limit=${LIMIT}&endTime=${endTime}`;
        https.get(url, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed);
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', reject);
    });
};

async function main() {
    let allData = [];
    let currentEndTime = Date.now();
    const batches = Math.ceil(TARGET_CANDLES / LIMIT);
    
    console.log(`Starting download of ${TARGET_CANDLES} candles (~${batches} batches)...`);
    
    // Create public dir if not exists
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
    }

    for (let i = 0; i < batches; i++) {
        try {
            console.log(`Fetching batch ${i + 1}/${batches}...`);
            const data = await fetchBatch(currentEndTime);
            if (!data || data.length === 0) break;
            
            // Format data [time, open, high, low, close]
            const formatted = data.map(d => [
                d[0] / 1000,
                parseFloat(d[1]),
                parseFloat(d[2]),
                parseFloat(d[3]),
                parseFloat(d[4])
            ]);
            
            allData = [...formatted, ...allData];
            currentEndTime = data[0][0] - 1; // Set end time to just before the oldest candle in this batch
            
            // Binance API rate limit is 1200 requests/min, we should be fine, but adding a tiny sleep to be polite
            await new Promise(r => setTimeout(r, 50));
        } catch (err) {
            console.error(`Error fetching batch ${i}:`, err.message);
            break;
        }
    }
    
    // Remove duplicates and sort just in case
    const uniqueMap = new Map();
    allData.forEach(d => {
        uniqueMap.set(d[0], d);
    });
    
    const finalData = Array.from(uniqueMap.values()).sort((a, b) => a[0] - b[0]);
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData));
    console.log(`Successfully saved ${finalData.length} candles to ${OUTPUT_FILE}`);
}

main();
