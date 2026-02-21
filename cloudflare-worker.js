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
 *   BOT_TOKEN  →  <your bot token here>   (add as Secret, never paste in code)
 *   CHAT_ID    →  <your chat id here>     (add as Text variable)
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

  // Reject requests from unknown origins (blocks Postman, bots, direct abuse)
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ ok: false, description: 'Method not allowed' }, 405, origin);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, description: 'Invalid JSON' }, 400, origin);
  }

  const message = (body.message || '').trim();
  if (!message) {
    return jsonResponse({ ok: false, description: 'Message is empty' }, 400, origin);
  }

  if (message.length > 1000) {
    return jsonResponse({ ok: false, description: 'Message too long' }, 400, origin);
  }

  const BOT_TOKEN_VAL = typeof BOT_TOKEN !== 'undefined' ? BOT_TOKEN : null;
  const CHAT_ID_VAL   = typeof CHAT_ID   !== 'undefined' ? CHAT_ID   : null;

  if (!BOT_TOKEN_VAL || !CHAT_ID_VAL) {
    return jsonResponse({ ok: false, description: 'Worker env vars not configured' }, 500, origin);
  }

  // Escape special Markdown chars to prevent broken formatting or injection
  const safeMessage = message.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const text = `💬 *Anonymous Message*\n\n${safeMessage}\n\n_Sent from bunraonepiece\\.me_`;

  try {
    const tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN_VAL}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: CHAT_ID_VAL, text, parse_mode: 'MarkdownV2' }),
      }
    );
    const tgData = await tgRes.json();
    return jsonResponse(tgData, tgRes.status, origin);
  } catch (err) {
    return jsonResponse({ ok: false, description: 'Upstream error' }, 502, origin);
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
