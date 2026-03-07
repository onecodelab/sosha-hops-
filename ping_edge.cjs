require('dotenv').config({ path: '.env.local' });

async function pingEdgeFunction() {
    const url = 'https://pgglpdnxrvndwxwbmajf.supabase.co/functions/v1/place-order';
    console.log(`Pinging ${url}...`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No authorization header attached intentionally
            },
            body: JSON.stringify({ ping: true })
        });

        console.log("Status:", response.status);
        const text = await response.text();
        console.log("Raw Response Body:", text);
    } catch (e) {
        console.error("Fetch failed completely:", e);
    }
}

pingEdgeFunction();
