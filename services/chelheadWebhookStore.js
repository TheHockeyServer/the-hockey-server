const fs = require("fs");
const path = require("path");

const database = require("./database");

const DATA_PATH = path.join(__dirname, "..", "data", "chelheadWebhooks.json");

function ensureStore() {
  const dir = path.dirname(DATA_PATH);

  fs.mkdirSync(dir, { recursive: true });

  if (!fs.existsSync(DATA_PATH)) {
    fs.writeFileSync(DATA_PATH, JSON.stringify({ events: [] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(DATA_PATH, JSON.stringify(store, null, 2));
}

function getMatchId(payload) {
  return payload?.match?.matchId ? String(payload.match.matchId) : null;
}

function cleanHeaders(headers) {
  return {
    "content-type": headers["content-type"],
    "x-chelhead-event": headers["x-chelhead-event"],
    "x-chelhead-webhook-id": headers["x-chelhead-webhook-id"],
    "x-chelhead-timestamp": headers["x-chelhead-timestamp"],
  };
}

async function recordWebhookEvent({ payload, headers, signatureVerified }) {
  const event = payload?.event ?? headers["x-chelhead-event"] ?? "unknown";
  const matchId = getMatchId(payload);
  const webhookId = payload?.webhook?.id ?? headers["x-chelhead-webhook-id"] ?? null;
  const receivedAt = Date.now();

  if (!database.isDatabaseEnabled()) {
    const store = readStore();

    if (matchId && store.events.some(item => item.chelheadMatchId === matchId)) {
      return { inserted: false, duplicate: true, matchId };
    }

    const record = {
      event,
      chelheadMatchId: matchId,
      chelheadWebhookId: webhookId,
      payload,
      headers: cleanHeaders(headers),
      signatureVerified,
      receivedAt,
    };

    store.events.push(record);
    writeStore(store);

    return { inserted: true, duplicate: false, matchId, record };
  }

  const result = await database.query(
    `
      INSERT INTO chelhead_webhook_events (
        event, chelhead_match_id, chelhead_webhook_id,
        payload, headers, signature_verified, received_at
      )
      VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
      ON CONFLICT (chelhead_match_id) DO NOTHING
      RETURNING *
    `,
    [
      event,
      matchId,
      webhookId,
      JSON.stringify(payload),
      JSON.stringify(cleanHeaders(headers)),
      Boolean(signatureVerified),
      receivedAt,
    ]
  );

  return {
    inserted: result.rowCount > 0,
    duplicate: result.rowCount === 0,
    matchId,
    record: result.rows[0] ?? null,
  };
}

module.exports = {
  recordWebhookEvent,
};
