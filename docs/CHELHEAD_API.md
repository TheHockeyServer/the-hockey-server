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

The existing webhook receiver is:

```text
https://the-hockey-server-production.up.railway.app/webhooks/chelhead
```

Webhook subscription creation and automatic match-result processing will be added after confirming
CHELHead's `POST /webhooks` request and response contract.
