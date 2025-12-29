
const fetch = require('node-fetch');

const ENDPOINT = 'https://gestion-facturation-glass.vercel.app/api/auth/login';

async function measure(i) {
    const start = Date.now();
    try {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'bench_test@example.com', password: 'dummy' })
        });
        const duration = Date.now() - start;
        console.log(`Request #${i}: ${duration}ms (Status: ${res.status})`);
        return duration;
    } catch (e) {
        console.log(`Request #${i}: FAILED (${e.message})`);
        return 0;
    }
}

async function run() {
    console.log(`🔥 Benchmarking Production: ${ENDPOINT}`);
    console.log('------------------------------------------------');

    // Warmup / Cold Start detection
    await measure(1);

    // Burst measure
    for (let i = 2; i <= 5; i++) {
        await new Promise(r => setTimeout(r, 500)); // Small pause
        await measure(i);
    }
}

run();
