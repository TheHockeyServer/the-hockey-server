const crypto = require("crypto");
const express = require("express");

const chelheadWebhookStore = require("./chelheadWebhookStore");

const DEFAULT_PORT = 8080;

function getSignatureDigest(signature) {
  const value = String(signature ?? "").trim();
  return value.startsWith("sha256=") ? value.slice("sha256=".length) : value;
}

function safeCompareHex(a, b) {
  const left = Buffer.from(String(a), "hex");
  const right = Buffer.from(String(b), "hex");

  if (left.length !== right.length) return false;

  return crypto.timingSafeEqual(left, right);
}

function verifyChelheadSignature(rawBody, signature, timestamp, secret) {
  if (!secret) {
    return { verified: false, skipped: true };
  }

  if (!rawBody || !signature || !timestamp) {
    return { verified: false, skipped: false };
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  return {
    verified: safeCompareHex(getSignatureDigest(signature), expected),
    skipped: false,
  };
}

function createWebServer() {
  const app = express();

  app.get("/", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "RANKD bot",
    });
  });

  app.get("/health", (_req, res) => {
    res.status(200).json({
      ok: true,
      service: "RANKD bot",
    });
  });

  app.post("/webhooks/chelhead", express.raw({ type: "application/json" }), async (req, res) => {
    const rawBody = req.body?.toString("utf8") ?? "";
    const signature = req.headers["x-chelhead-signature"];
    const timestamp = req.headers["x-chelhead-timestamp"];
    const signatureResult = verifyChelheadSignature(
      rawBody,
      signature,
      timestamp,
      process.env.CHELHEAD_WEBHOOK_SECRET
    );

    if (!signatureResult.skipped && !signatureResult.verified) {
      return res.status(401).send("Invalid signature");
    }

    let payload;

    try {
      payload = JSON.parse(rawBody);
    } catch (error) {
      return res.status(400).send("Invalid JSON payload");
    }

    try {
      const result = await chelheadWebhookStore.recordWebhookEvent({
        payload,
        headers: req.headers,
        signatureVerified: signatureResult.verified,
      });

      if (result.duplicate) {
        console.log(`Duplicate CHELHead webhook ignored for match ${result.matchId ?? "unknown"}`);
      } else {
        console.log(`CHELHead webhook stored for match ${result.matchId ?? "unknown"}`);
      }

      return res.status(200).json({
        ok: true,
        duplicate: result.duplicate,
      });
    } catch (error) {
      console.error("Failed to process CHELHead webhook:", error);
      return res.status(500).send("Webhook processing failed");
    }
  });

  return app;
}

function startWebServer() {
  const app = createWebServer();
  const port = Number(process.env.PORT ?? DEFAULT_PORT);

  return app.listen(port, "0.0.0.0", () => {
    console.log(`RANKD web server listening on port ${port}`);
  });
}

module.exports = {
  createWebServer,
  startWebServer,
  verifyChelheadSignature,
};
