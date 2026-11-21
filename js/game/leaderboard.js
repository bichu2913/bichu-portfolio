// Global leaderboard on Supabase (project "bichu-portfolio").
// The publishable key is safe to ship: visitors can only call the two checked functions
// top_drift_scores / submit_drift_score; the table itself is locked.
const URL = 'https://cvfpiwpuzunrvndjzzga.supabase.co/rest/v1/rpc';
const KEY = 'sb_publishable_C1bRWuCq-fnHsKLrHMLIcg_t5-qfGiF';

async function rpc(fn, body) {
    const res = await fetch(`${URL}/${fn}`, {
        method: 'POST',
        headers: { apikey: KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
    return data;
}

export const leaderboard = {
    top: (limit = 10) => rpc('top_drift_scores', { p_limit: limit }),
    submit: (name, score) => rpc('submit_drift_score', { p_name: name, p_score: Math.round(score) }),
};

export function cleanName(raw) {
    return String(raw || '').replace(/[^A-Za-z0-9 _.\-]/g, '').trim().slice(0, 16);
}
