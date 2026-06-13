# CHELHead API Integration

## Railway Variables

Add these variables to the RANKD bot service:

```text
CHELHEAD_API_KEY=<your CHELHead API key>
CHELHEAD_API_BASE_URL=https://api.chelhead.com
```

`CHELHEAD_API_BASE_URL` is optional and defaults to `https://api.chelhead.com`.

Do not add the API key to Postgres, `.env` files committed to GitHub, screenshots, Discord messages,
or source code.

## Authentication

RANKD sends the API key using CHELHead's required header:

```text
X-API-Key: <your API key>
```

## Connection Check

After Railway redeploys, open:

```text
https://the-hockey-server-production.up.railway.app/api/chelhead/status
```

A successful response looks like:

```json
{
  "configured": true,
  "ok": true
}
```

The webhook receiver is:

```text
https://the-hockey-server-production.up.railway.app/webhooks/chelhead
```

Add the same secret used when creating the CHELHead webhook to the RANKD bot service:

```text
CHELHEAD_WEBHOOK_SECRET=<a long random secret>
```

Completed match payloads are stored and deduplicated by CHELHead match ID. RANKD only applies a
result automatically when all of these checks pass:

- The webhook signature is valid.
- The event is `match.completed`.
- The match type is `reg`.
- The payload contains exactly two clubs.
- Those clubs exactly match both clubs finalized for one active RANKD match.
- The CHELHead game timestamp is not older than the RANKD match.
- The payload contains a winner and valid final scores.

Unsigned payloads are stored for investigation but do not update ELO. Setting
`CHELHEAD_ALLOW_UNSIGNED_WEBHOOKS=true` bypasses that protection and should only be used briefly
for controlled testing.

Webhook subscription creation will be added after confirming CHELHead's exact `POST /webhooks`
request, response, and deletion contracts.
