import { NextResponse } from "next/server";
import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction } from "@solana/spl-token";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { readJson, readRaffleData, writeRaffleData } from "../utils";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PURCHASES_FILE = path.join(DATA_DIR, "purchases.json");

// Configuration 
const RPC_URL = process.env.NEXT_PUBLIC_CARV_RPC || "https://rpc.testnet.carv.io/rpc";
const TREASURY_PUBKEY = process.env.NEXT_PUBLIC_TREASURY_PUBKEY || "5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA";
const TREASURY_SECRET = process.env.TREASURY_SECRET;
const CARV_MINT = "D7WVEw9Pkf4dfCCE3fwGikRCCTvm9ipqTYPHRENLiw3s";
const CARV_DECIMALS = 9;

function toTokenAmountRaw(amountDecimal: number) {
  if (!Number.isFinite(amountDecimal) || amountDecimal <= 0) return BigInt(0);
  const parts = String(amountDecimal).split(".");
  const whole = parts[0] || "0";
  const frac = (parts[1] || "").slice(0, CARV_DECIMALS).padEnd(CARV_DECIMALS, "0");
  const combined = whole + frac;
  const normalized = combined.replace(/^0+(?=\d)|^$/, "0");
  return BigInt(normalized);
}

function pickRandom<T>(arr: T[]) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({} as any));
    const { eventId, winnersCount = 1, token = "CARV" } = body;
    if (!eventId) {
      return NextResponse.json({ error: "eventId required" }, { status: 400 });
    }

    const purchasesData = readJson(PURCHASES_FILE, { purchases: [] });
    const purchases: any[] = purchasesData.purchases ?? [];

    // Filter purchases for this event
    const entries = purchases.filter(p => String(p.eventId) === String(eventId));
    if (!entries.length) {
      return NextResponse.json({ error: "no entries for event" }, { status: 400 });
    }

    // choose unique winners up to winnersCount
    const winners: string[] = [];
    const chosenIndices = new Set<number>();
    const maxW = Math.min(Number(winnersCount) || 1, entries.length);
    while (winners.length < maxW) {
      const idx = Math.floor(Math.random() * entries.length);
      if (chosenIndices.has(idx)) continue;
      chosenIndices.add(idx);
      winners.push(String(entries[idx].buyer));
    }

    // Send payout to winner
    const connection = new Connection(RPC_URL, "confirmed");
    const treasuryWallet = new PublicKey(TREASURY_PUBKEY);
    const winnerWallet = new PublicKey(winners[0]); // First winner
    const mintPubkey = new PublicKey(CARV_MINT);

    // Calculate prize pool (0.5 CARV per entry)
    const entryFee = 0.5;
    const prizePool = entries.length * entryFee;
    const winnerPayout = prizePool * 0.8; // 80% to winner
    const payoutAmount = toTokenAmountRaw(winnerPayout);

    // Get ATAs
    const fromATA = await getAssociatedTokenAddress(mintPubkey, treasuryWallet);
    const toATA = await getAssociatedTokenAddress(mintPubkey, winnerWallet);

    // Create transfer instruction
    const transferIx = createTransferInstruction(
      fromATA,
      toATA,
      treasuryWallet,
      payoutAmount,
      [],
      TOKEN_PROGRAM_ID
    );

    // Create and send transaction
    const tx = new Transaction().add(transferIx);
    let txHash = ""; // Store this to include in the record

    try {
      if (!TREASURY_SECRET) {
        throw new Error("Treasury private key not configured");
      }

      // Create Keypair from private key array
      const secretKey = new Uint8Array(JSON.parse(TREASURY_SECRET));
      const treasuryKeypair = Keypair.fromSecretKey(secretKey);

      // Check if recipient's ATA exists
      const toATAInfo = await connection.getAccountInfo(toATA);
      if (!toATAInfo) {
        // If not, add instruction to create it
        tx.add(
          createAssociatedTokenAccountInstruction(
            treasuryWallet,
            toATA,
            winnerWallet,
            mintPubkey
          )
        );
      }

      tx.feePayer = treasuryWallet;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
      tx.recentBlockhash = blockhash;
      
      // Sign and send the transaction
      tx.sign(treasuryKeypair);
      const rawTx = tx.serialize();
      txHash = await connection.sendRawTransaction(rawTx);
      
      // Wait for confirmation
      try {
        await connection.confirmTransaction({
          signature: txHash,
          blockhash,
          lastValidBlockHeight
        }, "confirmed");
      } catch (confError) {
        console.warn("Confirmation error:", confError);
      }

    } catch (err: any) {
      console.error("Transaction error:", err);
      txHash = (err && err.message) ? err.message : "failed";
    }

    // create raffle record
    const rec = {
      id: `${eventId}-${uuidv4()}`,
      eventId: String(eventId),
      date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      winners,
      buyerCount: entries.length,
      entries: entries.map(e => ({ id: e.id, buyer: e.buyer, txid: e.txid, timestamp: e.timestamp })),
      token,
      createdAt: new Date().toISOString(),
      prizePool,
      winnerPayout,
      txHash
    };

    // Write to individual file
    writeRaffleData(eventId, rec);
    return NextResponse.json({ ok: true, result: rec });
  } catch (e) {
    console.error("raffle payout error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}
