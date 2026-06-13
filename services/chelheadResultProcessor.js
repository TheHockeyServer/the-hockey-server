const eloService = require("./eloService");
const matchService = require("./matchService");
const { releaseMatchRoom } = require("./matchLobby");

function normalizeId(value) {
  return String(value ?? "").trim();
}

function getPayloadClubIds(payload) {
  return Object.keys(payload?.match?.clubs ?? {}).map(normalizeId).filter(Boolean);
}

function getPayloadPlayedAt(payload) {
  const timestamp = Number(payload?.match?.timestamp);

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return timestamp < 100_000_000_000 ? timestamp * 1000 : timestamp;
  }

  const parsed = Date.parse(payload?.timestamp);
  return Number.isFinite(parsed) ? parsed : null;
}

function getClubScore(payload, clubId) {
  const enhancedScore = payload?.match?._enhanced?.result?.[clubId]?.score;
  const rawScore = payload?.match?.clubs?.[clubId]?.gfraw;
  const score = Number(enhancedScore ?? rawScore);

  return Number.isFinite(score) && score >= 0 ? score : null;
}

function getMatchClubPair(match) {
  const teamAClubId = normalizeId(match.clubSetup?.teamAClubId);
  const teamBClubId = normalizeId(match.clubSetup?.teamBClubId);

  return teamAClubId && teamBClubId && teamAClubId !== teamBClubId
    ? { teamAClubId, teamBClubId }
    : null;
}

function findMatchingRankdMatches(payload) {
  const payloadClubIds = new Set(getPayloadClubIds(payload));
  const playedAt = getPayloadPlayedAt(payload);

  if (payloadClubIds.size !== 2) return [];

  return matchService.getActiveMatches().filter(match => {
    if (match.status === "closed" || match.status === "completed") return false;
    if (!match.clubSetup?.finalized) return false;

    const pair = getMatchClubPair(match);

    if (!pair) return false;
    if (!payloadClubIds.has(pair.teamAClubId) || !payloadClubIds.has(pair.teamBClubId)) return false;
    if (playedAt && playedAt < match.createdAt) return false;
    return true;
  });
}

function parseCompletedResult(payload) {
  if (payload?.event !== "match.completed") {
    return { valid: false, reason: "not_match_completed" };
  }

  const chelheadMatchId = normalizeId(payload?.match?.matchId);
  const clubIds = getPayloadClubIds(payload);
  const matchType = normalizeId(payload?.match?.matchType).toLowerCase();

  if (!chelheadMatchId || clubIds.length !== 2) {
    return { valid: false, reason: "missing_match_or_clubs" };
  }

  if (matchType !== "reg") {
    return { valid: false, reason: "not_regulation_match" };
  }

  return {
    valid: true,
    chelheadMatchId,
    clubIds,
    matchType,
    playedAt: getPayloadPlayedAt(payload),
  };
}

async function processCompletedMatch(payload, { signatureVerified = false } = {}) {
  const parsed = parseCompletedResult(payload);

  if (!parsed.valid) {
    return { status: "ignored", reason: parsed.reason };
  }

  if (!signatureVerified && process.env.CHELHEAD_ALLOW_UNSIGNED_WEBHOOKS !== "true") {
    return {
      status: "stored_unverified",
      reason: "signature_required",
      chelheadMatchId: parsed.chelheadMatchId,
    };
  }

  const candidates = findMatchingRankdMatches(payload);

  if (candidates.length === 0) {
    return {
      status: "unmatched",
      reason: "no_exact_active_club_pair",
      chelheadMatchId: parsed.chelheadMatchId,
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      reason: "multiple_active_club_pairs",
      chelheadMatchId: parsed.chelheadMatchId,
      rankdMatchIds: candidates.map(match => match.id),
    };
  }

  const match = candidates[0];
  const { teamAClubId, teamBClubId } = getMatchClubPair(match);
  const teamAScore = getClubScore(payload, teamAClubId);
  const teamBScore = getClubScore(payload, teamBClubId);

  if (teamAScore === null || teamBScore === null || teamAScore === teamBScore) {
    return {
      status: "invalid_result",
      reason: "missing_scores_or_tie",
      chelheadMatchId: parsed.chelheadMatchId,
      rankdMatchId: match.id,
    };
  }

  const eloResult = await eloService.recordMatchResult(match, teamAScore, teamBScore);
  match.chelheadMatchId = parsed.chelheadMatchId;
  match.chelheadPayload = payload;
  matchService.completeMatch(match.id, teamAScore, teamBScore);
  await releaseMatchRoom(
    match.id,
    `Match ${match.id} verified by CHELHead: Team A ${teamAScore}, Team B ${teamBScore}.`
  );

  return {
    status: "completed",
    chelheadMatchId: parsed.chelheadMatchId,
    rankdMatchId: match.id,
    teamAScore,
    teamBScore,
    eloResult,
  };
}

module.exports = {
  findMatchingRankdMatches,
  parseCompletedResult,
  processCompletedMatch,
};
