import { Redis } from '@upstash/redis';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env files
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN;

async function check() {
    console.log('🔍 Checking Redis Connection...');
    console.log('URL:', redisUrl);

    if (!redisUrl || !redisToken) {
        console.error('❌ Credentials missing in .env or .env.local');
        return;
    }

    try {
        const redis = new Redis({ url: redisUrl, token: redisToken });

        console.log('📡 Pinging Redis...');
        const result = await redis.ping();

        if (result === 'PONG') {
            console.log('✅ Success! Redis is online and responding.');
        } else {
            console.log('⚠️ Unexpected response:', result);
        }

        // Check if any stock keys exist
        console.log('📦 Checking for stock keys...');
        const keys = await redis.keys('stock:*');
        console.log(`📊 Found ${keys.length} stock keys in cache.`);

    } catch (err: any) {
        console.error('❌ Connection Failed:', err.message);
        if (err.message.includes('EAI_AGAIN') || err.message.includes('ENOTFOUND')) {
            console.log('\n💡 Tip: This looks like a DNS issue. Upstash might still be propagating your new database address. Please wait a few minutes and try again.');
        }
    }
}

check();
