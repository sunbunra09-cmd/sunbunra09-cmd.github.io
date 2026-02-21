/**
 * Cloudflare Worker – Telegram Proxy
 * ─────────────────────────────────────────────────────────────────────────────
 * This keeps your Telegram bot token OFF the client (index.html).
 *
 * HOW TO DEPLOY (free, ~2 minutes):
 *  1. Go to https://dash.cloudflare.com/ → Workers & Pages → Create Worker
 *  2. Paste this entire file into the editor and click "Save and Deploy"
 *  3. Copy the Worker URL  (e.g. https://bunra-telegram.yourname.workers.dev)
 *  4. In index.html, replace the PROXY_URL value with that URL.
 *
 * ENVIRONMENT VARIABLES (set in the Worker's Settings → Variables & Secrets):
 *   BOT_TOKEN  →  8176614642:AAFnvzKiUkkg3eVd7rzdXOTaEWn4QRnFIoM   (Secret)
 *   CHAT_ID    →  629605778                                           (Text)
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* global BOT_TOKEN, CHAT_ID */   // these are injected by Cloudflare as globals

// All domains that are allowed to call this Worker
const ALLOWED_ORIGINS = [
  'https://bunraonepiece.me',
  'https://www.bunraonepiece.me',
  'https://sunbunra09-cmd.github.io',
];

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(allowed) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, description: 'Method not allowed' }, 405, allowed);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, description: 'Invalid JSON' }, 400, allowed);
  }

  const message = (body.message || '').trim();
  if (!message) {
    return jsonResponse({ ok: false, description: 'Message is empty' }, 400, allowed);
  }

  if (message.length > 1000) {
    return jsonResponse({ ok: false, description: 'Message too long' }, 400, allowed);
  }

  const BOT_TOKEN_VAL = typeof BOT_TOKEN !== 'undefined' ? BOT_TOKEN : null;
  const CHAT_ID_VAL   = typeof CHAT_ID   !== 'undefined' ? CHAT_ID   : null;

  if (!BOT_TOKEN_VAL || !CHAT_ID_VAL) {
    return jsonResponse({ ok: false, description: 'Worker env vars not configured' }, 500, allowed);
  }

  const text = `💬 *Anonymous Message*\n\n${message}\n\n_Sent from bunraonepiece.me_`;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN_VAL}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID_VAL, text, parse_mode: 'Markdown' }),
      }
    );
    const tgData = await tgRes.json();
    return jsonResponse(tgData, tgRes.status, allowed);
  } catch (err) {
    return jsonResponse({ ok: false, description: 'Upstream error' }, 502, allowed);
  }
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200, origin = ALLOWED_ORIGINS[0]) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin),
    },
  });
}
