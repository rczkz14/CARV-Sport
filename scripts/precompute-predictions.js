// scripts/precompute-predictions.js
const fetch = require("node-fetch");
const fs = require("fs");
const path = require("path");

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

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

  // Use the correct worker endpoint based on sport
  let workerEndpoint = '';
  if (SPORTS === 'nba') {
    workerEndpoint = '/api/worker/auto-predict-nba';
  } else if (SPORTS === 'epl' || SPORTS === 'soccer') {
    workerEndpoint = '/api/worker/auto-predict-epl';
  } else if (SPORTS === 'laliga') {
    workerEndpoint = '/api/worker/auto-predict-laliga';
  } else {
    console.error("Unsupported sport:", SPORTS);
    return process.exit(1);
  }

  try {
    const pUrl = `${BASE_URL}${workerEndpoint}`;
    console.log("requesting predictions for", SPORTS, "date", TARGET_DATE);

    // Add authorization header if WORKER_API_KEY is set
    const headers = { "Content-Type": "application/json" };
    if (process.env.WORKER_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.WORKER_API_KEY}`;
    }

    const pr = await fetch(pUrl, {
      method: "GET",
      headers: headers
    });

    const pj = await pr.json();
    if (pj?.ok) {
      console.log("predictions generated successfully:", pj.message);
      console.log("generated count:", pj.generatedCount || 0);
    } else {
      console.error("prediction generation failed:", pj);
    }
  } catch (e) {
    console.error("error generating predictions:", e);
  }

  console.log("done precompute");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
