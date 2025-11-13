// scripts/precompute-predictions.js
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const SPORTS = process.env.SPORT || "nba";
const TARGET_DATE = process.env.TARGET_DATE || (() => {
  const d = new Date();
  // by default use tomorrow (D+1) which is typical for NBA window
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0,10);
})();

async function main() {
  console.log("precompute: base", BASE_URL, "sport", SPORTS, "date", TARGET_DATE);
  const matchesUrl = `${BASE_URL}/api/matches?date=${TARGET_DATE}&sport=${SPORTS}&force=true`;
  const mRes = await fetch(matchesUrl);
  const mJson = await mRes.json();
  if (!mJson?.ok) {
    console.error("matches fetch failed", mJson);
    return process.exit(1);
  }
  const events = Array.isArray(mJson.events) ? mJson.events : [];
  console.log("found", events.length, "events for", TARGET_DATE);
  for (const ev of events) {
    try {
      const pUrl = `${BASE_URL}/api/prediction`;
      const body = { eventId: ev.id, home: ev.home, away: ev.away, datetime: ev.datetime };
      console.log("requesting prediction for", ev.id, ev.home, "vs", ev.away);
      const pr = await fetch(pUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const pj = await pr.json();
      if (pj?.ok) {
        console.log("prediction saved for", ev.id, "cached:", pj.cached ? true : false);
      } else {
        console.error("prediction failed for", ev.id, pj);
      }
      // small delay to avoid rate limit
      await new Promise(r => setTimeout(r, 600));
    } catch (e) {
      console.error("error for event", ev.id, e);
    }
  }
  console.log("done precompute");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
