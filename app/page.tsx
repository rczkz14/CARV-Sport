// app/page.tsx
"use client";

import React, { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from 'next/navigation';
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { SettingsModal } from "./components/SettingsModal";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";

type RawEvent = {
  id: string;
  league: string;
  home: string;
  away: string;
  datetime: string | null;
  venue?: string | null;
  homeScore?: number | null;
  awayScore?: number | null;
  status?: string | null;
  // whether this event is currently buyable (computed by server or client)
  buyable?: boolean;
  // optional ISO datetime indicating when buying opens for this event
  buyableFrom?: string | null;
  raw?: any;
  rawDetail?: any;
};

const MAX_PER_SPORT = 2;

// token config
const CARV_MINT_STR = "D7WVEw9Pkf4dfCCE3fwGikRCCTvm9ipqTYPHRENLiw3s";
const CARV_DECIMALS = 9;
const CARV_CHARGE = 0.5; // 0.5 CARV

// env / fallback
const RPC_URL = (process.env.NEXT_PUBLIC_CARV_RPC as string) || "https://rpc.testnet.carv.io/rpc";
const TREASURY_PUB = (process.env.NEXT_PUBLIC_TREASURY_PUBKEY as string) || "5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA";

declare global {
  interface Window {
    backpack?: any;
    solana?: any;
  }
}

function formatHMS(ms: number) {
  if (ms <= 0) return "00:00:00";
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Format date in WIB (Asia/Jakarta)
 */
function formatInWIB(date: Date): string {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })).toLocaleString();
}

/**
 * Get timezone based on league
 */
function getLeagueTimezone(league: string): string {
  const leagueLower = String(league).toLowerCase();
  if (leagueLower.includes("nba") || leagueLower.includes("basketball")) {
    return "America/New_York"; // NBA default (Eastern Time)
  } else if (leagueLower.includes("premier league") || leagueLower.includes("english premier") || leagueLower.includes("epl")) {
    return "Europe/London"; // EPL
  } else if (leagueLower.includes("la liga") || leagueLower.includes("laliga") || leagueLower.includes("spanish")) {
    return "Europe/Madrid"; // La Liga
  }
  return "UTC"; // Default
}

/**
 * Format date in specific timezone
 */
function formatInTimezone(date: Date, timeZone: string): string {
  return new Date(date.toLocaleString('en-US', { timeZone })).toLocaleString('en-GB');
}

/**
 * Convert WIB window times to user's local timezone
 * @param league - NBA, EPL, or LaLiga
 * @returns Window times in user's local timezone
 */
function getLocalWindowTimes(league: string): string {
  // All windows defined in WIB (UTC+7)
  let wibStart: number, wibEnd: number, label: string;
  
  if (league === "NBA") {
    // NBA: 13:00 (D) — 04:00 (D+1) WIB
    wibStart = 13;
    wibEnd = 28; // 04:00 next day = 28 in 24h range
    label = "NBA";
  } else if (league === "EPL" || league === "LaLiga") {
    // Soccer: 01:00 — 16:00 (D) WIB
    wibStart = 1;
    wibEnd = 16;
    label = league === "EPL" ? "EPL" : "LaLiga";
  } else {
    return "";
  }

  // Create dummy dates to convert times
  const today = new Date();
  
  // Create WIB time (UTC+7) and convert to user's local timezone
  const wibStartDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  wibStartDate.setHours(wibStart, 0, 0, 0);
  
  const wibEndDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  if (wibEnd >= 24) {
    wibEndDate.setDate(wibEndDate.getDate() + 1);
    wibEndDate.setHours(wibEnd - 24, 0, 0, 0);
  } else {
    wibEndDate.setHours(wibEnd, 0, 0, 0);
  }

  // Format in user's local timezone
  const startFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  
  const endFormatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const localStart = startFormatter.format(wibStartDate);
  const localEnd = endFormatter.format(wibEndDate);

  // Show day indicator if end is next day
  const isNextDay = wibEnd >= 24;
  const dayIndicator = isNextDay ? " (D+1)" : " (D)";

  return `${label}: ${localStart} (D) — ${localEnd}${dayIndicator}`;
}

/**
 * Convert an ISO (assumed UTC) to local parts for the visitor.
 * Returns date (YYYY-MM-DD), hour (number), minute (number) and an ISO-like local string.
 */
function localPartsFromUtcIso(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso); // ISO assumed UTC; Date will convert to local when formatting
  const fmt = new Intl.DateTimeFormat(undefined, {
    // undefined => use visitor locale & timezone
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    // isoLocal is a human-readable local ISO style: YYYY-MM-DDTHH:MM:SS (local)
    isoLocal: `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

function normalizePubkey(input: any): string | null {
  try {
    if (!input) return null;
    if (typeof input === "string") return input;
    if (input?.toBase58 && typeof input.toBase58 === "function") return input.toBase58();
    if (input?.toString && typeof input.toString === "function") {
      const s = input.toString();
      if (s && !s.startsWith("[object")) return s;
    }
    if (input?.publicKey) return normalizePubkey(input.publicKey);
    return String(input);
  } catch {
    return null;
  }
}

/**
 * Compute window status per sport using UTC hours internally.
 *
 * The original windows are defined in Jakarta (WIB = UTC+7):
 *   NBA: 13:00 (D) — 04:00 (D+1) WIB
 *   Soccer : 01:00 — 16:00 (D) WIB
 *
 * Convert these to UTC and evaluate using current UTC hour so internal logic is deterministic.
 *
 * Converted:
 * - NBA in UTC: 06:00 — 20:59 UTC  (i.e. hour >= 6 && hour < 21)
 * - Soccer in UTC: 18:00 — 08:59 UTC  (i.e. hour >= 18 || hour < 9)
 */
function computeWindowStatusPerSport() {
  const now = new Date();
  const hourUtc = now.getUTCHours();

  const openNBA = hourUtc >= 6 && hourUtc < 21; // 06:00..20:59 UTC
  const openSoccer = hourUtc >= 18 || hourUtc < 9; // 18:00..23:59 OR 00:00..08:59 UTC

  // compute next change target (a Date object) — return a JS Date in UTC/local timezone (same epoch)
  // We'll find the nearest boundary among the 4 daily boundaries converted to UTC.
  const makeUtcDate = (base: Date, targetHourUtc: number, mm = 0, ss = 0, dayOffset = 0) => {
    // build a Date at UTC target hour
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), targetHourUtc, mm, ss));
    if (dayOffset !== 0) d.setUTCDate(d.getUTCDate() + dayOffset);
    return d;
  };

  const nextCandidates: Date[] = [];

  // NBA next change candidates:
  // if currently openNBA then next change is when it closes at 21:00 UTC today (if now <21) or tomorrow (if passed)
  // if closed then next open at 06:00 UTC (today or tomorrow)
  if (openNBA) {
    // next close at 21:00 UTC (same UTC day if now <21, else next day)
    const nextClose = makeUtcDate(now, 21, 0, 0, 0);
    if (nextClose.getTime() <= Date.now()) nextClose.setUTCDate(nextClose.getUTCDate() + 1);
    nextCandidates.push(nextClose);
  } else {
    // next open at 06:00 UTC (today or tomorrow)
    const nextOpen = makeUtcDate(now, 6, 0, 0, 0);
    if (nextOpen.getTime() <= Date.now()) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    nextCandidates.push(nextOpen);
  }

  // EPL / Soccer next change candidates:
  if (openSoccer) {
    // soccer closes at 09:00 UTC
    const nextClose = makeUtcDate(now, 9, 0, 0, 0);
    if (nextClose.getTime() <= Date.now()) nextClose.setUTCDate(nextClose.getUTCDate() + 1);
    nextCandidates.push(nextClose);
  } else {
    // soccer opens at 18:00 UTC
    const nextOpen = makeUtcDate(now, 18, 0, 0, 0);
    if (nextOpen.getTime() <= Date.now()) nextOpen.setUTCDate(nextOpen.getUTCDate() + 1);
    nextCandidates.push(nextOpen);
  }

  // pick nearest candidate
  let nearest = nextCandidates[0] ?? new Date(Date.now() + 3600_000);
  const nowMs = Date.now();
  for (const c of nextCandidates) {
    if (Math.abs(c.getTime() - nowMs) < Math.abs(nearest.getTime() - nowMs)) nearest = c;
  }

  return { openNBA, openSoccer, nextTarget: nearest };
}

// Treat 'started' if datetime <= now OR status includes keywords
function isMatchStarted(ev: RawEvent) {
  if (ev.datetime) {
    const t = Date.parse(ev.datetime);
    if (!Number.isNaN(t)) {
      return t <= Date.now();
    }
  }
  const s = String(ev.status ?? "").toLowerCase();
  return /live|in progress|started|playing|ft|final|finished|ended|closed|match finished/.test(s);
}

import { getTeamLogo } from '@/lib/teamLogoUtils';

export default function Page() {
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(true);
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isWindowOpenNBA, setIsWindowOpenNBA] = useState(false);
  const [isWindowOpenSoccer, setIsWindowOpenSoccer] = useState(false);
  const [countdown, setCountdown] = useState("00:00:00");
  const [activeTab, setActiveTab] = useState("status");

    // showHistory toggles whether Status view shows history (started/finished) OR buyable upcoming (when false)
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const ITEMS_PER_PAGE = 6;
  const [matchPredictions, setMatchPredictions] = useState<Record<string, string>>({}); // eventId -> prediction text
  
  // Raffle functionality moved to /raffle/page.tsx

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const [docsOpen, setDocsOpen] = useState(false);
  
  // Close wallet menu when clicking outside
  useEffect(() => {
    const closeMenu = () => setWalletMenuOpen(false);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  type LeagueType = "ALL" | "NBA" | "EPL" | "LaLiga";
  const [leagueFilter, setLeagueFilter] = useState<LeagueType>("ALL");
  const [purchasedByWallet, setPurchasedByWallet] = useState<Record<string, boolean>>({});
  const [processing, setProcessing] = useState<Record<string, boolean>>({});
  const [predictionModalOpen, setPredictionModalOpen] = useState(false);
  const [currentPredictionText, setCurrentPredictionText] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [purchasedEvent, setPurchasedEvent] = useState<RawEvent | null>(null);
  const [buyerCounts, setBuyerCounts] = useState<Record<string, number>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [currentLocalTime, setCurrentLocalTime] = useState<string>('--:--');
  const [predictionResults, setPredictionResults] = useState<Record<string, { actualWinner: string; isCorrect: boolean; homeScore?: number; awayScore?: number; status?: string }>>({});

  // wallet listeners (unchanged)
  useEffect(() => {
    setIsMounted(true);
    // Initialize background worker
    fetch('/api/init').catch(e => console.warn('Worker init failed:', e));
    
    // Update local time on client only
    setCurrentLocalTime(new Date().toLocaleString());
    const timeInterval = setInterval(() => {
      setCurrentLocalTime(new Date().toLocaleString());
    }, 1000);
    
    return () => clearInterval(timeInterval);
  }, []);

  useEffect(() => {
    try {
      if ((window as any).backpack) {
        (window as any).backpack.on?.("connect", (pk: any) => setPublicKey(normalizePubkey(pk)));
        (window as any).backpack.on?.("disconnect", () => setPublicKey(null));
        if ((window as any).backpack.publicKey) setPublicKey(normalizePubkey((window as any).backpack.publicKey));
      }
      if ((window as any).solana && !(window as any).backpack) {
        (window as any).solana.on?.("connect", (pk: any) => setPublicKey(normalizePubkey(pk)));
        (window as any).solana.on?.("disconnect", () => setPublicKey(null));
        if ((window as any).solana.isConnected) setPublicKey(normalizePubkey((window as any).solana.publicKey));
      }
    } catch (e) { console.warn("wallet attach failed", e); }
  }, []);

  const connectWallet = async () => {
    try {
      if ((window as any).backpack && typeof (window as any).backpack.connect === "function") {
        const resp = await (window as any).backpack.connect();
        setPublicKey(normalizePubkey(resp?.publicKey ?? resp));
        return;
      }
      if ((window as any).solana && typeof (window as any).solana.connect === "function") {
        const resp = await (window as any).solana.connect();
        setPublicKey(normalizePubkey(resp?.publicKey ?? resp));
        return;
      }
      alert("Wallet not found. Install Backpack or Phantom-compatible extension and set network to CARV SVM / Devnet.");
    } catch (err) {
      console.error("connectWallet", err);
      alert("Connection failed.");
    }
  };
  const disconnectWallet = async () => {
    try {
      if ((window as any).backpack && typeof (window as any).backpack.disconnect === "function") await (window as any).backpack.disconnect();
      else if ((window as any).solana && typeof (window as any).solana.disconnect === "function") await (window as any).solana.disconnect();
    } catch (e) { console.warn(e); }
    finally { setPublicKey(null); setPurchasedByWallet({}); }
  };

  // fetchMatches with options (history=true => /api/matches?history=true)
  const fetchMatches = useCallback(async (opts?: { history?: boolean; force?: boolean; purchasesOnly?: boolean; closedWindow?: boolean }) => {
    try {
      setLoading(true);
      const q = new URLSearchParams();
      if (opts?.history) q.set("history", "true");
      if (opts?.force) q.set("force", "true");
      if (opts?.purchasesOnly) q.set("purchasesOnly", "true");
      if (opts?.closedWindow) q.set("closedWindow", "true");
      const url = "/api/matches" + (q.toString() ? "?" + q.toString() : "");
      const res = await fetch(url);
      const j = await res.json();
      if (!j?.ok || !Array.isArray(j.events)) {
        setEvents([]);
        return;
      }

      const mapped: RawEvent[] = j.events.map((ev: any) => {
        const base: RawEvent = {
          id: ev.id,
          league: ev.league ?? "",
          home: ev.home,
          away: ev.away,
          datetime: ev.datetime ?? null,
          venue: ev.venue ?? null,
          homeScore: (ev.homeScore !== undefined ? ev.homeScore : null),
          awayScore: (ev.awayScore !== undefined ? ev.awayScore : null),
          status: ev.status ?? null,
          raw: ev.raw ?? null,
          rawDetail: ev.rawDetail ?? null,
          buyable: ev.buyable ?? isOpenForLeague(ev.league),
          buyableFrom: ev.buyableFrom ?? null,
        };
        return base;
      });

      setEvents(mapped);
    } catch (e) {
      console.error("fetchMatches", e);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBuyerCounts = useCallback(async (eventIds: string[]) => {
    try {
      const counts: Record<string, number> = {};
      await Promise.all(
        eventIds.map(async (id) => {
          try {
            const res = await fetch(`/api/purchases/count?eventId=${id}`);
            const j = await res.json();
            counts[id] = j.buyerCount ?? 0;
          } catch (e) {
            counts[id] = 0;
          }
        })
      );
      setBuyerCounts(counts);
    } catch (e) {
      console.warn("fetchBuyerCounts failed", e);
    }
  }, []);

  // Fetch buyer counts when events change
  useEffect(() => {
    if (events.length > 0) {
      fetchBuyerCounts(events.map(e => e.id));
    }
  }, [events, fetchBuyerCounts]);

  const updatePurchasedForWallet = useCallback(async (walletPub?: string | null) => {
    try {
      if (!walletPub) { setPurchasedByWallet({}); return; }
      const q = new URLSearchParams();
      q.set("buyer", walletPub);
      const res = await fetch("/api/purchases?" + q.toString());
      const j = await res.json();
      const purchases: any[] = Array.isArray(j?.purchases) ? j.purchases : (j?.purchases ?? []);
      const map: Record<string, boolean> = {};
      for (const p of purchases) { map[String(p.eventId)] = true; }
      setPurchasedByWallet(map);
    } catch (e) {
      console.warn("updatePurchasedForWallet failed", e);
      setPurchasedByWallet({});
    }
  }, []);

  const loadPredictionForMatch = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/purchases?eventId=${eventId}`);
      const j = await res.json();
      if (Array.isArray(j.purchases) && j.purchases[0]?.prediction) {
        setMatchPredictions(prev => ({
          ...prev,
          [eventId]: j.purchases[0].prediction
        }));
      }
    } catch (e) {
      console.error("Failed to load prediction for", eventId, e);
    }
  }, []);

  const loadPredictionResult = useCallback(async (eventId: string) => {
    try {
      const res = await fetch(`/api/raffle?eventId=${eventId}`);
      const j = await res.json();
      if (j.ok && j.raffle) {
        setPredictionResults(prev => ({
          ...prev,
          [eventId]: {
            actualWinner: j.raffle.actualWinner,
            isCorrect: j.raffle.isCorrect,
            homeScore: j.raffle.homeScore,
            awayScore: j.raffle.awayScore,
            status: j.raffle.status
          }
        }));
      }
    } catch (e) {
      console.error("Failed to load prediction result for", eventId, e);
    }
  }, []);

  useEffect(() => {
    const upd = () => {
      const st = computeWindowStatusPerSport();
      setIsWindowOpenNBA(st.openNBA);
      setIsWindowOpenSoccer(st.openSoccer);
      setCountdown(formatHMS(st.nextTarget.getTime() - Date.now()));
    };
    upd();
    const t = setInterval(upd, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Fetch matches when showHistory changes
    fetchMatches({ history: showHistory });
    // Only refresh history view every 3 hours for final scores
    if (showHistory) {
      const id = setInterval(() => fetchMatches({ history: true }), 3 * 60 * 60 * 1000);
      return () => clearInterval(id);
    }
  }, [fetchMatches, showHistory]);

  useEffect(() => { updatePurchasedForWallet(publicKey); }, [publicKey, updatePurchasedForWallet]);

  // Load predictions for finished matches in history view
  useEffect(() => {
    if (showHistory) {
      const finishedMatches = events.filter(ev => ev.status && /finished|final|ft/i.test(ev.status));
      finishedMatches.forEach(ev => {
        if (!matchPredictions[ev.id]) {
          loadPredictionForMatch(ev.id);
        }
        // Load prediction result (actualWinner, isCorrect)
        if (!predictionResults[ev.id]) {
          loadPredictionResult(ev.id);
        }
      });
    }
  }, [events, showHistory, matchPredictions, loadPredictionForMatch, predictionResults]);

  // Handle video looping
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnded = () => {
      console.log('Video ended, restarting...');
      video.currentTime = 0;
      video.play().catch((err: any) => console.log('Video play error:', err));
    };

    const handleCanPlay = () => {
      console.log('Video can play');
      video.play().catch((err: any) => console.log('Autoplay error:', err));
    };

    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);

    // Try to play on mount
    if (leagueFilter === "NBA") {
      video.play().catch((err: any) => console.log('Initial play error:', err));
    }

    return () => {
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [leagueFilter]);

  function toTokenAmountRaw(amountDecimal: number, decimals: number) {
    if (!Number.isFinite(amountDecimal) || amountDecimal <= 0) return BigInt(0);
    const parts = String(amountDecimal).split(".");
    const whole = parts[0] || "0";
    const frac = (parts[1] || "").slice(0, decimals).padEnd(decimals, "0");
    const combined = whole + frac;
    const normalized = combined.replace(/^0+(?=\d)|^$/, "0");
    return BigInt(normalized);
  }

  async function getTokenBalanceRaw(connection: Connection, ata: PublicKey) {
    try {
      const resp = await connection.getTokenAccountBalance(ata);
      return BigInt(resp?.value?.amount ?? "0");
    } catch {
      return BigInt(0);
    }
  }

  // buy flow unchanged (kept same as your file)
  const handleBuy = async (ev: RawEvent) => {
    if (!publicKey) { alert("Please connect your Backpack wallet first."); return; }

    // check buyable computed
    if (!ev.buyable) { alert("Buying disabled: not in buy window yet."); return; }

    if (purchasedByWallet[ev.id]) { alert("You already bought this prediction (one wallet = one prediction per event)."); return; }
    if (processing[ev.id]) return;

    setProcessing(prev => ({ ...prev, [ev.id]: true }));

    try {
      const provider = (window as any).backpack ?? (window as any).solana;
      if (!provider) { alert("Wallet provider not found."); return; }

      const walletPubKeyStr = normalizePubkey(provider.publicKey);
      if (!walletPubKeyStr) { alert("Wallet not ready — connect again."); return; }

      // server pre-check
      try {
        const respChk = await fetch("/api/purchases");
        const jChk = await respChk.json();
        const purchases: any[] = Array.isArray(jChk?.purchases) ? jChk.purchases : (jChk?.purchases ?? []);
        const already = purchases.find(p => String(p.eventId) === String(ev.id) && String(p.buyer) === String(walletPubKeyStr));
        if (already) {
          setPurchasedByWallet(prev => ({ ...prev, [ev.id]: true }));
          alert("You already bought this prediction (server shows existing purchase).");
          return;
        }
      } catch (e) { console.warn("pre-check purchases failed", e); }

      const connection = new Connection(RPC_URL, "confirmed");
      const fromPub = new PublicKey(walletPubKeyStr);
      const toPub = new PublicKey(TREASURY_PUB);
      const CARV_MINT = new PublicKey(CARV_MINT_STR);

      const senderATA = await getAssociatedTokenAddress(CARV_MINT, fromPub);
      const receiverATA = await getAssociatedTokenAddress(CARV_MINT, toPub);

      const senderBal = await getTokenBalanceRaw(connection, senderATA);
      const amountRaw = toTokenAmountRaw(CARV_CHARGE, CARV_DECIMALS);
      if (senderBal < amountRaw) {
        // Show modal instead of alert
        const modal = document.createElement("div");
        modal.className = "fixed inset-0 flex items-center justify-center z-50";
        modal.innerHTML = `
          <div class="absolute inset-0 bg-black/50"></div>
          <div class="relative bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg p-6 max-w-md w-full mx-4">
            <div class="flex flex-col items-center text-center gap-4">
              <img src="/images/not-enough.gif" alt="Insufficient Balance" class="w-64 h-64 object-contain" />
              <h3 class="text-xl font-semibold">Insufficient CARV Balance</h3>
              <p class="text-gray-600 dark:text-gray-400">Need ${CARV_CHARGE} CARV to purchase this prediction.</p>
              <button 
                class="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                onclick="this.closest('.fixed').remove()"
              >
                Close
              </button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);
        return;
      }

      const instructions: any[] = [];
      const recvInfo = await connection.getAccountInfo(receiverATA);
      if (!recvInfo) instructions.push(createAssociatedTokenAccountInstruction(fromPub, receiverATA, toPub, CARV_MINT));
      instructions.push(createTransferInstruction(senderATA, receiverATA, fromPub, amountRaw, [], TOKEN_PROGRAM_ID));

      let tx = new Transaction();
      for (const ix of instructions) tx.add(ix);
      tx.feePayer = fromPub;

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = blockhash;

      if (provider.signTransaction) {
        try {
          const signedTx = await provider.signTransaction(tx);
          const raw = signedTx.serialize();
          const txid = await connection.sendRawTransaction(raw);
          try { await connection.confirmTransaction({ signature: txid, blockhash, lastValidBlockHeight }, "confirmed"); } catch (c) { console.warn("confirm warn", c); }

          await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: ev.id, buyer: walletPubKeyStr, txid, amount: CARV_CHARGE, token: "CARV" }),
          });

          setPurchasedByWallet(prev => ({ ...prev, [ev.id]: true }));
          
          // Refresh buyer counts to show the new purchase immediately
          await fetchBuyerCounts([ev.id]);
          
          setPurchasedEvent(ev);
          setShowSuccessModal(true);
          return;
        } catch (e) {
          console.warn("signTransaction failed", e);
        }
      }

      if (provider.signAndSendTransaction) {
        try {
          const res = await provider.signAndSendTransaction(tx);
          const sig = res?.signature ?? res;
          try { await connection.confirmTransaction({ signature: String(sig), blockhash, lastValidBlockHeight }, "confirmed"); } catch (c) { console.warn("confirm warn", c); }

          await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: ev.id, buyer: walletPubKeyStr, txid: String(sig), amount: CARV_CHARGE, token: "CARV" }),
          });

          setPurchasedByWallet(prev => ({ ...prev, [ev.id]: true }));
          
          // Refresh buyer counts to show the new purchase immediately
          await fetchBuyerCounts([ev.id]);
          
          // Show success modal
          const modal = document.createElement("div");
          modal.className = "fixed inset-0 flex items-center justify-center z-50";
          modal.innerHTML = `
            <div class="absolute inset-0 bg-black/50"></div>
            <div class="relative bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg p-6 max-w-md w-full mx-4">
              <div class="flex flex-col items-center text-center gap-4">
                <img src="/images/buy-prediction.gif" alt="Success" class="w-64 h-64 object-contain" />
                <h3 class="text-xl font-semibold">Purchase Successful!</h3>
                <button 
                  class="px-3 py-1 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 transition-colors"
                  onclick="(() => { this.closest('.fixed').remove(); document.querySelector('[data-prediction-event=\\'${ev.id}\\']').click(); })()"
                >
                  See Prediction
                </button>
                <button 
                  class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
                  onclick="this.closest('.fixed').remove()"
                >
                  Close
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          return;
        } catch (e) {
          console.warn("signAndSendTransaction failed", e);
        }
      }

      if (provider.sendTransaction) {
        try {
          const txid = await provider.sendTransaction(tx, connection);
          try { await connection.confirmTransaction({ signature: String(txid), blockhash, lastValidBlockHeight }, "confirmed"); } catch (c) { console.warn("confirm warn", c); }

          await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: ev.id, buyer: walletPubKeyStr, txid, amount: CARV_CHARGE, token: "CARV" }),
          });

          setPurchasedByWallet(prev => ({ ...prev, [ev.id]: true }));
          
          // Show success modal
          setPurchasedEvent(ev);
          setShowSuccessModal(true);
          return;
        } catch (e) {
          console.warn("sendTransaction failed", e);
        }
      }

      const manual = confirm("Automatic signing not supported by your wallet provider. Do you want to paste a txid manually (testing only, CARV SVM devnet)? WARNING: server will verify tx on-chain before accepting.");
      if (manual) {
        const txid = prompt("Paste txid here:");
        if (txid) {
          await fetch("/api/purchases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventId: ev.id, buyer: walletPubKeyStr, txid, amount: CARV_CHARGE, token: "CARV" }),
          });
          setPurchasedByWallet(prev => ({ ...prev, [ev.id]: true }));
          setPurchasedEvent(ev);
          setShowSuccessModal(true);
          return;
        }
      } else {
        alert("Purchase cancelled.");
      }
    } catch (err: any) {
      console.error("handleBuy err", err);
      alert("Purchase error: " + (err?.message ?? String(err)));
    } finally {
      setProcessing(prev => {
        const np = { ...prev };
        delete np[ev.id];
        return np;
      });
    }
  };

  const [currentMatch, setCurrentMatch] = useState<{home: string; away: string} | null>(null);
  const [predictionDetails, setPredictionDetails] = useState<{
    predictedScore: string;
    totalScore: string;
    predictedWinner: string;
    confidence: number;
    generatedAt: string;
  } | null>(null);

  const handleViewPrediction = async (ev: RawEvent) => {
    if (!publicKey) { alert("Connect wallet first."); return; }
    try {
      const q = new URLSearchParams();
      q.set("eventId", ev.id);
      q.set("buyer", publicKey);
      console.log(`[Debug] Looking for purchase: eventId=${ev.id}, buyer=${publicKey}`);
      const res = await fetch(`/api/purchases?${q.toString()}`);
      const j = await res.json();
      console.log(`[Debug] Purchase lookup result:`, j);
      let found = Array.isArray(j.purchases) && j.purchases[0];
      
      // If not a buyer, allow viewing if match is finished
      if (!found && ev.status && /finished|ft|final/i.test(String(ev.status))) {
        // Get any prediction for this event (not just from this buyer)
        const res2 = await fetch(`/api/purchases?eventId=${ev.id}`);
        const j2 = await res2.json();
        found = Array.isArray(j2.purchases) && j2.purchases[0];
        if (!found) { alert("No prediction available for this match yet."); return; }
      } else if (!found) { 
        // Show debugging info before alerting
        console.log(`[Debug] No purchase found. Available purchases for this event:`, 
                   j.purchases || 'none');
        alert(`Purchase record not found. Match must be finished to view predictions.\n\nDebug: eventId=${ev.id}, buyer=${publicKey}`); 
        return; 
      }
      
      setCurrentMatch({ home: ev.home, away: ev.away });
      
      // Parse the prediction data
      const prediction = found.prediction;
      const lines = prediction.split('\n');
      setPredictionDetails({
        predictedScore: lines.find((l: string) => l.includes('Predicted Score'))?.split(':')[1]?.trim() ?? '',
        totalScore: lines.find((l: string) => l.includes('Total Score'))?.split(':')[1]?.trim() ?? '',
        predictedWinner: lines.find((l: string) => l.includes('Predicted Winner'))?.split(':')[1]?.trim() ?? '',
        confidence: parseInt(lines.find((l: string) => l.includes('Confidence'))?.split(':')[1]?.replace('%', '')?.trim() ?? '0'),
        generatedAt: lines.find((l: string) => l.includes('Generated'))?.split('Generated:')[1]?.trim() ?? ''
      });

      // Set the review text
      const reviewStart = prediction.indexOf('Review:');
      const reviewEnd = prediction.indexOf('Generated:');
      setCurrentPredictionText(prediction.slice(reviewStart + 7, reviewEnd).trim());
      
      setPredictionModalOpen(true);
    } catch (e) {
      console.error("view prediction", e);
      alert("Failed to fetch prediction.");
    }
  };

  const isOpenForLeague = (league?: string | null) => {
    if (!league) return isWindowOpenNBA || isWindowOpenSoccer;
    if (/nba/i.test(league)) return isWindowOpenNBA;
    if (/premier league|english premier|epl|soccer|football/i.test(league)) return isWindowOpenSoccer;
    return isWindowOpenNBA;
  };

  // Click logo => set league and show BUY list (not history)
  const onSelectLeague = (which: "NBA" | "EPL" | "LaLiga") => {
    setLeagueFilter(which);
    setActiveTab("status");
    setShowHistory(false); // show buyable upcoming matches for selected league
    setSearchQuery(""); // Clear search query when switching to BUY view
    setCurrentPage(1); // Reset to first page
    fetchMatches({ history: false });
  };

  // Click header "Status and Predictor History" => show history for selected league
  const onOpenHistory = (which?: "NBA" | "EPL" | "LaLiga") => {
    if (which) setLeagueFilter(which);
    setActiveTab("status");
    setShowHistory(true);
    setSearchQuery(""); // Clear search query when opening history
    setCurrentPage(1); // Reset to first page
    fetchMatches({ closedWindow: true });
  };

  const backToLeagueSelection = () => {
    setLeagueFilter("ALL");
    setShowHistory(true);
    setSearchQuery(""); // Clear search query when going back
    setCurrentPage(1); // Reset to first page
    fetchMatches({ history: false });
  };

  return (
    <div 
      className={`${darkMode ? "text-white" : "text-gray-900"} min-h-screen transition-colors relative overflow-hidden`}
      style={{ backgroundColor: darkMode ? '#111827' : '#ffffff' }}
    >
      {/* Video Background */}
      {(leagueFilter === "NBA" || leagueFilter === "EPL" || leagueFilter === "LaLiga" || leagueFilter === "ALL") && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '150vh',
          zIndex: 0,
          overflow: 'hidden',
          transform: 'scale(0.68)',
          transformOrigin: 'top center'
        }}>
          <video
            key={`video-${leagueFilter}`}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block'
            }}
          >
            {leagueFilter === "NBA" ? (
              <>
                <source src="/images/NBA-Background.mp4" type="video/mp4" />
                <source src="/images/NBA-Background.mov" type="video/quicktime" />
              </>
            ) : leagueFilter === "EPL" || leagueFilter === "LaLiga" ? (
              <>
                <source src="/images/Bola-Background.mp4" type="video/mp4" />
              </>
            ) : (
              <>
                <source src="/images/Main-Background.mp4" type="video/mp4" />
              </>
            )}
          </video>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.2)',
            pointerEvents: 'none'
          }}></div>

        </div>
      )}
      
      {/* Content */}
      <div style={{ position: 'relative', zIndex: 10 }}>

      <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <img src="/images/CARV-Logo.png" alt="CARV Logo" className="w-32 h-16 rounded object-contain" />
            <div>
              <h1 className="text-3xl font-bold">CARV Sports Prediction</h1>
              <p className="text-sm opacity-80">Buy predictions for <strong>{CARV_CHARGE} $CARV</strong>. One wallet = one prediction per event.</p>

                      <nav className="mt-4 flex items-center gap-4">
              <a
                href="/raffle"
                className="px-4 py-2.5 rounded-lg font-medium transition-all hover:bg-indigo-700 hover:text-white
                  border border-indigo-500/30 hover:border-indigo-500"
              >
                Raffle Results
              </a>

              <a
                href="/analytics"
                className="px-4 py-2.5 rounded-lg font-medium transition-all hover:bg-purple-700 hover:text-white
                  border border-purple-500/30 hover:border-purple-500"
              >
                Analytics
              </a>

              <button
                disabled
                title="Coming soon"
                className="px-4 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2
                  opacity-75 cursor-not-allowed border border-yellow-500/30"
              >
                <span>Be a Predictor</span>
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-400/10 text-yellow-400">Coming Soon</span>
              </button>
            </nav>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
              <div className="relative">
                <button onClick={() => setDocsOpen(true)} className="px-3 py-1 rounded border text-sm">Docs</button>
              </div>            {publicKey ? (
                                <div className="relative group">
                    <div className="flex items-center gap-2">
                      <div className="px-3 py-1 border rounded bg-gray-800/40 text-sm">
                        {publicKey.slice(0, 6)}...{publicKey.slice(-6)}
                      </div>
                    </div>
                    
                    <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 text-black dark:text-white rounded shadow-lg divide-y divide-gray-200 dark:divide-gray-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-150">
                      <div className="absolute w-full h-2 -top-2 bg-transparent"></div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push('/profile');
                        }} 
                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Profile
                      </button>
                      <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettingsOpen(true);
                          }} 
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between"
                        >
                          <span>Setting</span>
                          <span>⚙️</span>
                      </button>
                      <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectWallet();
                          }} 
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-red-500 hover:text-red-600"
                        >
                          Disconnect
                      </button>
                    </div>
                  </div>
            ) : (
              <button onClick={connectWallet} className="p-0 rounded" title="Connect Backpack Wallet">
                <img src="/images/backpack-logo.png" alt="Connect Backpack" className="w-36 h-8" />
              </button>
            )}
          </div>
        </header>

        {/* Breadcrumb/back */}
        {leagueFilter !== "ALL" && (
          <div className="mt-6 flex items-center gap-3">
            <button onClick={backToLeagueSelection} className="px-2 py-1 rounded border text-sm">← Back to league selection</button>
            <div className="text-sm text-gray-400">League &nbsp;›&nbsp; <span className="font-semibold">{leagueFilter}</span></div>
            <div className="ml-auto text-xs text-gray-400">
              {showHistory ? "Viewing: Status & Predictor History" : "Viewing: Buyable Matches"}
            </div>
          </div>
        )}

        {/* Selection screen when no league chosen */}
        {leagueFilter === "ALL" && (
          <section className="mt-8 flex flex-col items-center">
            <div className="w-full max-w-3xl p-6 rounded-xl text-center" style={{ border: "1px solid", borderColor: darkMode ? "#2d3748" : "#e5e7eb" }}>
              <div className="text-xs text-gray-400">Windows (Jakarta)</div>
              <div className="font-semibold mt-2">
                <div>NBA: 13:00 (D) — 04:00 (D+1) WIB</div>
                <div className="mt-1">Soccer: 01:00 — 16:00 (D) WIB</div>
              </div>

              <div className="mt-4 text-sm text-gray-400">Next change in <span className="font-mono">{countdown}</span></div>

              <h2 className="text-xl font-semibold mt-6 mb-2">Select a League to Continue</h2>
              <p className="text-sm text-gray-400 mb-6">Click a logo to view matches you can buy predictions for.</p>

              <div className="flex items-center justify-center gap-12">
                <button
                  onClick={() => onSelectLeague("NBA")}
                  className="flex flex-col items-center gap-3"
                  aria-label="Select NBA"
                >
                  <img src="/images/NBA-Logo.png" alt="NBA" className="w-36 h-36 object-contain rounded-lg" />
                  <div className="mt-2 font-semibold">NBA</div>
                </button>

                <button
                  onClick={() => onSelectLeague("EPL")}
                  className="flex flex-col items-center gap-3"
                  aria-label="Select EPL"
                >
                  <img src="/images/epl-logo.png" alt="EPL" className="w-56 h-56 object-contain rounded-lg" />
                  <div className="mt-2 font-semibold">EPL</div>
                </button>

                <button
                  onClick={() => onSelectLeague("LaLiga")}
                  className="flex flex-col items-center gap-3"
                  aria-label="Select LaLiga"
                >
                  <img src="/images/laliga-logo.png" alt="LaLiga" className="w-36 h-36 object-contain rounded-lg" />
                  <div className="mt-2 font-semibold">LaLiga</div>
                </button>
              </div>
            </div>

            {/* Footer with text on left and social links on right */}
            <div className="mt-8 flex items-center justify-between w-full max-w-3xl">
              <div className="text-sm text-gray-400 italic">
                Please select a league above to view buyable matches.
              </div>
              <div className="flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg">
                <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X" className="hover:scale-110 transition-transform">
                  <img src="/images/twitter-logo.png" alt="Twitter" className="w-7 h-7 object-contain cursor-pointer" />
                </a>
                <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile" className="hover:scale-110 transition-transform">
                  <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-7 h-7 object-contain cursor-pointer" />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* Windows + info panel (visible when league selected) */}
        {leagueFilter !== "ALL" && (
          <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 rounded-xl" style={{ border: "1px solid", borderColor: darkMode ? "#2d3748" : "#e5e7eb" }}>
              <div className="text-xs text-gray-400 mb-2">Windows (Jakarta)</div>
              <div className="text-sm">
                <div className="bg-indigo-500/10 rounded-lg p-4 mt-2">
                  <div className="font-semibold">
                    {getLocalWindowTimes(leagueFilter)}
                  </div>
                  <div className={`mt-3 ${(isWindowOpenNBA || isWindowOpenSoccer) ? "text-green-400" : "text-red-400"}`}>
                    {isWindowOpenNBA || isWindowOpenSoccer ? "Open" : "Closed"} — next change in <span className="font-mono">{countdown}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-2">Now (local): {currentLocalTime}</div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => { 
                        setShowHistory(false); 
                        fetchMatches({ history: false }); 
                      }} 
                      className="px-3 py-1 rounded border"
                    >
                      Matches
                    </button>
                    <button onClick={() => onOpenHistory(leagueFilter)} className="px-3 py-1 rounded border">View Status & History</button>
                  </div>
                  <div className="flex justify-start">
                    <img 
                      src={
                        leagueFilter === "NBA" ? "/images/NBA-Logo.png" : 
                        leagueFilter === "EPL" ? "/images/epl-logo.png" :
                        "/images/laliga-logo.png"
                      } 
                      alt={leagueFilter} 
                      className="h-16 w-16 object-contain" 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl" style={{ border: "1px solid", borderColor: darkMode ? "#2d3748" : "#e5e7eb" }}>
              <div className="text-xs text-gray-400 mb-2">Raffle Information</div>
              <div className="text-sm">
                <div className="bg-indigo-500/10 rounded-lg p-4 mt-2">
                  <div className="font-medium text-indigo-400 mb-2">How it works:</div>
                  <ul className="list-disc pl-4 space-y-2 text-gray-300">
                    <li>Buy predictions for matches during the open window</li>
                    <li>Each prediction purchase gives you one raffle entry</li>
                    <li><span className="text-yellow-400">80%</span> of total prediction buyers will be allocated to <span className="text-green-400">1 winner</span></li>
                    <li>Winners are drawn at <span className="text-blue-400">08:00 UTC</span> if the match finishes</li>
                  </ul>
                </div>
                <div className="mt-3 text-center text-xs text-gray-500">
                  View winners on the <a href="/raffle" className="text-blue-400 hover:underline">raffle page</a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Main content section */}
        <main className="mt-8">
          {leagueFilter === "ALL" ? (
            // Show league selection message
            <div></div>
          ) : !showHistory ? (
            // Show buyable matches for selected league
            <div>
              <h2 className="text-xl font-semibold mb-4">Buy Predictions — {leagueFilter}</h2>
              {loading && <div className="text-sm opacity-70">Loading matches…</div>}
              <div className="space-y-4">
                {events
                  .filter(ev => {
                    if (leagueFilter === "NBA") return /nba/i.test(ev.league ?? "");
                    if (leagueFilter === "EPL") return /premier league|english premier|epl/i.test(ev.league ?? "") || /soccer|football/i.test(ev.league ?? "");
                    if (leagueFilter === "LaLiga") return /laliga|la liga/i.test(ev.league ?? "") || /spanish|la\s+liga/i.test(ev.league ?? "");
                    return true;
                  })
                  // exclude started/closed matches
                  .filter(ev => !isMatchStarted(ev))
                  // Sort by datetime (earliest first)
                  .sort((a, b) => {
                    const timeA = a.datetime ? new Date(a.datetime).getTime() : Number.MAX_SAFE_INTEGER;
                    const timeB = b.datetime ? new Date(b.datetime).getTime() : Number.MAX_SAFE_INTEGER;
                    return timeA - timeB;
                  })
                  .map(ev => {
                    const jk = localPartsFromUtcIso(ev.datetime ?? null);
                    const localDate = jk ? jk.date : "(unknown)";
                    const localTime = jk ? `${String(jk.hour).padStart(2,"0")}:${String(jk.minute).padStart(2,"0")}` : "";
                    const alreadyBought = Boolean(purchasedByWallet[ev.id]);
                    const busy = Boolean(processing[ev.id]);

                    return (
                      <div key={ev.id} className={`p-4 rounded-xl ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-gray-100 border border-gray-300"}`}>
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-indigo-400">{ev.league}</span>
                            <span className="text-xs text-gray-500">Event #{ev.id}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold">0.5 $CARV</span>
                            <img src="/images/carv-token.png" alt="CARV" className="w-4 h-4 object-contain" />
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center justify-center gap-6">
                                <div className="flex flex-col items-center gap-2">
                                  {getTeamLogo(ev.home, ev.league) ? (
                                    <img
                                      src={getTeamLogo(ev.home, ev.league)}
                                      alt={ev.home}
                                      className="w-24 h-24 object-contain"
                                    />
                                  ) : (
                                    <div className="w-24 h-24 bg-gray-700/30 rounded-lg flex items-center justify-center text-2xl font-bold opacity-70">
                                      {ev.home.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-sm font-semibold">{ev.home}</span>
                                </div>
                                <div className="font-bold opacity-60 text-xl">VS</div>
                                <div className="flex flex-col items-center gap-2">
                                  {getTeamLogo(ev.away, ev.league) ? (
                                    <img
                                      src={getTeamLogo(ev.away, ev.league)}
                                      alt={ev.away}
                                      className="w-24 h-24 object-contain"
                                    />
                                  ) : (
                                    <div className="w-24 h-24 bg-gray-700/30 rounded-lg flex items-center justify-center text-2xl font-bold opacity-70">
                                      {ev.away.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-sm font-semibold">{ev.away}</span>
                                </div>
                              </div>
                              {!alreadyBought && <div className="text-sm opacity-90 text-center"><i>Auto prediction coming soon</i></div>}
                              {ev.datetime && (
                                <div className="text-xs opacity-60 text-center">
                                  <div>{formatInWIB(new Date(ev.datetime))} (WIB)</div>
                                  <div>{new Date(ev.datetime).toLocaleString('en-US', { timeZone: 'UTC' })} (UTC)</div>
                                </div>
                              )}
                              {ev.venue && <div className="text-xs opacity-60 text-center">Venue: {ev.venue}</div>}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2 ml-4">
                            <div className="flex items-center gap-1 text-sm text-gray-400">
                              <span>👥</span>
                              <span>{buyerCounts[ev.id] ?? 0} buyer{(buyerCounts[ev.id] ?? 0) !== 1 ? 's' : ''}</span>
                            </div>
                            {alreadyBought || (ev.status && /finished|ft|final/i.test(String(ev.status))) ? (
                              <>
                                <button onClick={() => handleViewPrediction(ev)} className="px-3 py-1 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700">View Prediction</button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleBuy(ev)}
                                  disabled={!ev.buyable || busy}
                                  className={`px-3 py-1 rounded-lg text-sm ${(!ev.buyable) ? "opacity-50 cursor-not-allowed border" : "bg-indigo-600 text-white"}`}
                                >
                                  {busy ? "Processing…" : (ev.buyable ? "Buy Prediction" : "Not available")}
                                </button>
                                {!ev.buyable && ev.buyableFrom && (
                                  <div className="text-xs opacity-60 mt-1">Available from {new Date(ev.buyableFrom).toLocaleString()}</div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                <div className="mt-10 border-t border-gray-500 pt-6 text-sm opacity-70 flex justify-between items-center">
                  <div>Made by Erxie0x — powered by CARV SVM Testnet 🚀</div>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg">
                    <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X">
                      <img src="/images/twitter-logo.png" alt="Twitter" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
                    </a>
                    <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile">
                      <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            // Show history for selected league
            <div>
              <h2 className="text-xl font-semibold mb-4">Status & History — {leagueFilter}</h2>
              {loading && <div className="text-sm opacity-70">Loading matches…</div>}
              
              {/* Search bar */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="Search by team name or match ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1); // Reset to first page when searching
                  }}
                  className={`w-full px-4 py-2 rounded-lg border ${darkMode ? "bg-gray-800 border-gray-600 text-white" : "bg-white border-gray-300 text-black"} focus:outline-none focus:ring-2 focus:ring-indigo-500`}
                />
              </div>

              {/* Filtered and paginated events */}
              {(() => {
                const filtered = events
                  .filter(ev => {
                    if (leagueFilter === "NBA") return /nba/i.test(ev.league ?? "");
                    if (leagueFilter === "EPL") return /premier league|english premier|epl/i.test(ev.league ?? "") || /soccer|football/i.test(ev.league ?? "");
                    if (leagueFilter === "LaLiga") return /laliga|la liga/i.test(ev.league ?? "") || /spanish|la\s+liga/i.test(ev.league ?? "");
                    return true;
                  })
                  .filter(ev => {
                    const query = searchQuery.toLowerCase();
                    return (
                      ev.id.toLowerCase().includes(query) ||
                      ev.home.toLowerCase().includes(query) ||
                      ev.away.toLowerCase().includes(query)
                    );
                  })
                  // Sort by datetime (newest/latest first)
                  .sort((a, b) => {
                    const timeA = a.datetime ? new Date(a.datetime).getTime() : Number.MIN_SAFE_INTEGER;
                    const timeB = b.datetime ? new Date(b.datetime).getTime() : Number.MIN_SAFE_INTEGER;
                    return timeB - timeA;
                  });

                const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
                const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
                const paginatedEvents = filtered.slice(startIdx, startIdx + ITEMS_PER_PAGE);

                return (
                  <div>
                    <div className="space-y-4">
                      {paginatedEvents.length === 0 ? (
                        <div className="text-sm opacity-70 text-center py-8">
                          {filtered.length === 0 ? "No matches found in history." : "No results on this page."}
                        </div>
                      ) : (
                        paginatedEvents.map(ev => {
                          const jk = localPartsFromUtcIso(ev.datetime ?? null);
                          const localDate = jk ? jk.date : "(unknown)";
                          const localTime = jk ? `${String(jk.hour).padStart(2,"0")}:${String(jk.minute).padStart(2,"0")}` : "";
                          const alreadyBought = Boolean(purchasedByWallet[ev.id]);
                          const isFinished = ev.status && /finished|final|ft/i.test(ev.status);
                          const prediction = matchPredictions[ev.id];

                          return (
                            <div key={ev.id} className={`p-4 rounded-xl flex flex-col gap-4 ${darkMode ? "bg-gray-800 border border-gray-700" : "bg-gray-100 border border-gray-300"}`}>
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="text-sm text-gray-400">{ev.league}</div>

                                  <div className="text-lg font-semibold">
                                    {ev.homeScore !== null && ev.awayScore !== null ? (
                                      <div className="tracking-wider flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                          {getTeamLogo(ev.home, ev.league) && (
                                            <img src={getTeamLogo(ev.home, ev.league)} alt={ev.home} className="w-6 h-6 object-contain" />
                                          )}
                                          <span className="min-w-[120px]">{ev.home}</span>
                                        </div>
                                        <span className="font-mono font-bold px-2 py-1 bg-gray-700/30 rounded">{ev.homeScore}</span>
                                        <span className="opacity-50">-</span>
                                        <span className="font-mono font-bold px-2 py-1 bg-gray-700/30 rounded">{ev.awayScore}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="min-w-[120px]">{ev.away}</span>
                                          {getTeamLogo(ev.away, ev.league) && (
                                            <img src={getTeamLogo(ev.away, ev.league)} alt={ev.away} className="w-6 h-6 object-contain" />
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                          {getTeamLogo(ev.home, ev.league) && (
                                            <img src={getTeamLogo(ev.home, ev.league)} alt={ev.home} className="w-6 h-6 object-contain" />
                                          )}
                                          <span>{ev.home}</span>
                                        </div>
                                        <span className="opacity-80">vs</span>
                                        <div className="flex items-center gap-2">
                                          <span>{ev.away}</span>
                                          {getTeamLogo(ev.away, ev.league) && (
                                            <img src={getTeamLogo(ev.away, ev.league)} alt={ev.away} className="w-6 h-6 object-contain" />
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {ev.status && (
                                    <div className="mt-2">
                                      <span className={`text-sm px-2 py-1 rounded ${/finished|final|ft/i.test(predictionResults[ev.id]?.status || ev.status) ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                        {predictionResults[ev.id]?.status || ev.status}
                                      </span>
                                    </div>
                                  )}

                                  <div className="mt-1 text-sm opacity-90">
                                    <span className="mr-2">Status: <strong>{predictionResults[ev.id]?.status || ev.status || 'N/A'}</strong></span>
                                    <div>Match ID: <strong>{ev.id}</strong></div>
                                  </div>

                                  {ev.datetime && (
                                    <div className="text-xs opacity-60 mt-1">
                                      <div>{formatInWIB(new Date(ev.datetime))} (WIB)</div>
                                      <div>{new Date(ev.datetime).toLocaleString('en-US', { timeZone: 'UTC' })} (UTC)</div>
                                    </div>
                                  )}
                                  {ev.venue && <div className="text-xs opacity-60 mt-1">Venue: {ev.venue}</div>}
                                  
                                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                                    <span>👥</span>
                                    <span>{buyerCounts[ev.id] ?? 0} buyer{(buyerCounts[ev.id] ?? 0) !== 1 ? 's' : ''}</span>
                                  </div>
                                </div>

                                <div className="flex flex-col items-end gap-2">
                                  <div className="text-sm font-bold">{CARV_CHARGE} $CARV</div>

                                  {isFinished ? (
                                    <div className="flex flex-col items-end gap-2">
                                      <button onClick={() => handleViewPrediction(ev)} className="px-3 py-1 rounded-lg text-sm bg-green-600 text-white">View Prediction</button>
                                      {alreadyBought ? (
                                        <div className="text-xs opacity-70">Purchased ✅</div>
                                      ) : (
                                        <div className="text-xs opacity-70">Not purchased</div>
                                      )}
                                    </div>
                                  ) : (
                                    alreadyBought ? (
                                      <div className="flex flex-col items-end gap-2">
                                        <button onClick={() => handleViewPrediction(ev)} className="px-3 py-1 rounded-lg text-sm bg-green-600 text-white">View Prediction</button>
                                        <div className="text-xs opacity-70">Purchased ✅</div>
                                      </div>
                                    ) : (
                                      <div className="text-xs opacity-70">Not purchased</div>
                                    )
                                  )}
                                  
                                  {isFinished && predictionResults[ev.id] && (
                                    <span className={`text-xs px-2 py-1 rounded font-bold ${
                                      predictionResults[ev.id].isCorrect 
                                        ? 'bg-green-500/20 text-green-400' 
                                        : 'bg-red-500/20 text-red-400'
                                    }`}>
                                      {predictionResults[ev.id].isCorrect ? '✅ CORRECT' : '❌ INCORRECT'}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                      <div className="mt-6 flex justify-center items-center gap-2">
                        <button
                          onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                          disabled={currentPage === 1}
                          className={`px-3 py-2 rounded ${currentPage === 1 ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600/20"}`}
                        >
                          ← Previous
                        </button>
                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-2 py-1 rounded text-sm ${currentPage === page ? "bg-indigo-600 text-white" : "opacity-70 hover:opacity-100"}`}
                            >
                              {page}
                            </button>
                          ))}
                        </div>
                        <button
                          onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                          disabled={currentPage === totalPages}
                          className={`px-3 py-2 rounded ${currentPage === totalPages ? "opacity-50 cursor-not-allowed" : "hover:bg-indigo-600/20"}`}
                        >
                          Next →
                        </button>
                      </div>
                    )}

                    <div className="mt-10 border-t border-gray-500 pt-6 text-sm opacity-70">
                      Showing {startIdx + 1}-{Math.min(startIdx + ITEMS_PER_PAGE, filtered.length)} of {filtered.length} result{filtered.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })()}

              <div className="mt-10 border-t border-gray-500 pt-6 text-sm opacity-70 flex justify-between items-center">
                <div>Made by Erxie0x — powered by CARV SVM Testnet 🚀</div>
                <div className="flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg">
                  <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X">
                    <img src="/images/twitter-logo.png" alt="Twitter" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
                  </a>
                  <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile">
                    <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
                  </a>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      </div>

      {predictionModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setPredictionModalOpen(false)} />
          <div className="relative bg-white text-black rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Prediction</h2>
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-xl mb-2">🏀 {currentMatch?.home} vs {currentMatch?.away}</h3>
                <div className="space-y-1">
                  <div><strong>Predicted Score:</strong> {predictionDetails?.predictedScore}</div>
                  <div><strong>Total Score:</strong> {predictionDetails?.totalScore}</div>
                  <div><strong>Predicted Winner:</strong> {predictionDetails?.predictedWinner}</div>
                  <div><strong>Confidence:</strong> {predictionDetails?.confidence}%</div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Review:</h4>
                <div className="text-gray-700 whitespace-pre-wrap">{currentPredictionText}</div>
              </div>

              <div className="text-sm text-gray-500 mt-4">
                Generated: {predictionDetails?.generatedAt}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <button onClick={() => setPredictionModalOpen(false)} className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800">Close</button>
            </div>
          </div>
        </div>
      )}

      {docsOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDocsOpen(false)} />
          <div className="relative bg-white text-black rounded-lg p-8 max-w-2xl w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">How CARV Prediction Market Works</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-600">Overview</h3>
                <p className="text-gray-700">
                  CARV Prediction Market is a unique platform where users can purchase sports predictions and participate in daily raffles.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-600">How It Works</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>Purchase predictions for upcoming sports matches during open windows</li>
                  <li>Each purchase automatically enters you into the daily raffle</li>
                  <li><span className="font-semibold">80%</span> of all prediction purchases goes to the raffle pool</li>
                  <li>One lucky buyer is selected as the winner each day at 08:00 UTC</li>
                  <li>Winners receive the entire raffle pool for that day</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-600">Predictions & Betting</h3>
                <ul className="list-disc pl-5 space-y-2 text-gray-700">
                  <li>After purchase, access your prediction details instantly</li>
                  <li>Use predictions to inform your betting decisions</li>
                  <li>Place bets on your preferred betting platforms</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2 text-indigo-600">Treasury</h3>
                <p className="text-gray-700">
                  20% of purchases are allocated to the treasury, supporting:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-gray-700">
                  <li>Marketing initiatives</li>
                  <li>Platform development</li>
                  <li>Community rewards</li>
                  <li>Operational expenses</li>
                </ul>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button 
                onClick={() => setDocsOpen(false)} 
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSuccessModal && purchasedEvent && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSuccessModal(false)} />
          <div className="relative bg-white dark:bg-gray-800 text-black dark:text-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex flex-col items-center text-center gap-4">
              <img src="/images/buy-prediction.gif" alt="Success" className="w-64 h-64 object-contain" />
              <h3 className="text-xl font-semibold">Purchase Successful!</h3>
              <div className="flex flex-col gap-3 w-full">
                <button 
                  className="w-full px-4 py-2 rounded-lg text-sm bg-green-600 text-white hover:bg-green-700 transition-colors font-medium"
                  onClick={() => {
                    const ev = purchasedEvent;
                    setShowSuccessModal(false);
                    if (ev) handleViewPrediction(ev);
                  }}
                >
                  See Prediction
                </button>
                <button 
                  className="w-full px-4 py-2 bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
      />
    </div>
  );
}
