"use client";
import React, { useEffect, useState, useCallback } from "react";

type Purchase = {
  id: string;
  eventid: string;
  buyer: string;
  txid: string;
  amount: number;
  token: string;
  timestamp: string;
};

// Convert date to WIB (UTC+7)
function getJakartaTime(date: Date = new Date()): Date {
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 7)); // UTC+7
}

// Get next 15:00 WIB time
function getNext1500WIB(): Date {
  const now = getJakartaTime();
  const next = new Date(now);
  next.setHours(15, 0, 0, 0);
  
  if (now.getHours() >= 15) {
    // If it's past 15:00, get tomorrow's 15:00
    next.setDate(next.getDate() + 1);
  }
  
  return next;
}

export default function AdminDashboard() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nextRaffleTime, setNextRaffleTime] = useState<Date>(getNext1500WIB());
  const [autoRaffleEnabled, setAutoRaffleEnabled] = useState<boolean>(true);
  const [raffleStatuses, setRaffleStatuses] = useState<Record<string, any>>({});

  const runRaffle = useCallback(async (eventid: string) => {
    setMessage(null);
    try {
      // Trigger payout so winners receive CARV on-chain
      const res = await fetch("/api/raffle/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventid, winnersCount: 1, token: "CARV" }),
      });
      const json = await res.json();
      
      if (json.error && json.existing) {
        // If raffle already exists, update the UI with the existing raffle data
        setRaffleStatuses(prev => ({
          ...prev,
          [eventid]: json.existing
        }));
        setMessage("Raffle already completed for this event");
      } else if (json.ok && json.result) {
        // On success, immediately update the UI with the new raffle data
        setRaffleStatuses(prev => ({
          ...prev,
          [eventid]: json.result
        }));
        setMessage("Raffle completed successfully!");
      } else {
        setMessage("Raffle failed: " + JSON.stringify(json));
      }
    } catch (e) {
      console.error(e);
      setMessage("Raffle request failed");
    }
  }, []);

  async function loadPurchases() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/purchases");
      const json = await res.json().catch(() => ({} as any));
      setPurchases((json && json.purchases) || []);
      await loadRaffleStatuses(); // Refresh raffle statuses after loading purchases
    } catch (e) {
      console.error(e);
      setMessage("Failed to load purchases");
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }

  // Helper function to get pending events
  const getPendingEvents = useCallback(() => {
    // Group purchases by event ID
    const grouped = purchases.reduce<Record<string, Purchase[]>>((acc, p) => {
      const key = String(p.eventid);
      acc[key] = acc[key] || [];
      acc[key].push(p);
      return acc;
    }, {});
    return Object.keys(grouped);
  }, [purchases]);

  // Auto raffle function
  const runAllRaffles = useCallback(async () => {
    if (!autoRaffleEnabled) return;
    
    try {
      setMessage("Running auto raffles...");
      const pendingEvents = getPendingEvents();
      
      // Only run raffles for events that don't have completed txHash
      const eventsToRun = pendingEvents.filter(eventid => {
        const status = raffleStatuses[eventid];
        // Skip if raffle already completed (has valid txHash that's not "pending")
        if (status?.txHash && status.txHash !== "pending") {
          console.log(`[Auto Raffle] Skipping ${eventid} - already completed`);
          return false;
        }
        return true;
      });
      
      if (eventsToRun.length === 0) {
        setMessage("No pending raffles to run at this time");
        return;
      }
      
      for (const eventid of eventsToRun) {
        console.log(`[Auto Raffle] Running raffle for ${eventid}`);
        await runRaffle(eventid);
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay between raffles
      }
      
      setMessage("Auto raffles completed! Next run at " + getNext1500WIB().toLocaleString());
      setNextRaffleTime(getNext1500WIB());
    } catch (error) {
      console.error("Auto raffle error:", error);
      setMessage("Auto raffle error: " + String(error));
    }
  }, [autoRaffleEnabled, getPendingEvents, raffleStatuses, runRaffle]);

  // Initial load of purchases and raffle statuses
  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      try {
        // Load purchases first
        const purchasesRes = await fetch("/api/purchases");
        const purchasesJson = await purchasesRes.json();
        setPurchases((purchasesJson && purchasesJson.purchases) || []);

        // Then load raffle statuses
        const raffleRes = await fetch('/api/raffle');
        const raffleJson = await raffleRes.json();
        if (raffleJson.ok && Array.isArray(raffleJson.raffles)) {
          const statusMap = raffleJson.raffles.reduce((acc: Record<string, any>, raffle: any) => {
            acc[raffle.eventid] = raffle;
            return acc;
          }, {});
          setRaffleStatuses(statusMap);
        }
      } catch (e) {
        console.error("Failed to load initial data:", e);
        setMessage("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
    const interval = setInterval(loadInitialData, 60000);
    return () => clearInterval(interval);
  }, []);

  // Auto raffle timer - check every 10 seconds for exact 15:00 WIB time
  useEffect(() => {
    if (!autoRaffleEnabled) return;

    let raffleHasRun = false; // Track if raffle already ran at 15:00 today

    const checkAndRunRaffles = () => {
      const now = getJakartaTime();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const currentSecond = now.getSeconds();
      
      // If it's 15:00:xx (first 60 seconds of the hour), run raffle once
      if (currentHour === 15 && currentMinute === 0 && !raffleHasRun) {
        console.log("[Auto Raffle] Running at 15:00 WIB");
        runAllRaffles();
        raffleHasRun = true;
      }
      
      // Reset the flag when we move to a different minute
      if (currentMinute !== 0) {
        raffleHasRun = false;
      }
    };

    const interval = setInterval(checkAndRunRaffles, 10000); // Check every 10 seconds
    checkAndRunRaffles(); // Initial check immediately

    return () => clearInterval(interval);
  }, [autoRaffleEnabled, runAllRaffles]);

  function escapeCsvCell(cell: string) {
    // wrap in double quotes and escape existing double quotes by doubling them
    return `"${String(cell).replace(/"/g, '""')}"`;
  }

  function exportCSV() {
    if (!purchases.length) return;
    const header = ["id", "eventid", "buyer", "txid", "amount", "token", "timestamp"];
    const rows = purchases.map((p) => [
      p.id,
      p.eventid,
      p.buyer,
      p.txid,
      String(p.amount),
      p.token,
      p.timestamp,
    ]);
    const csvLines = [header, ...rows].map((row) => row.map((c) => escapeCsvCell(String(c))).join(","));
    const csv = csvLines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `purchases-${new Date().toISOString()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // This function was moved up as a useCallback

  const loadRaffleStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/raffle/latest');
      const data = await res.json();
      if (data.ok && data.raffle) {
        const statusMap = { [data.raffle.eventid]: data.raffle };
        setRaffleStatuses(statusMap);
      }
    } catch (error) {
      console.error('Error loading raffle statuses:', error);
    }
  }, []);

  // Load raffle statuses when component mounts or purchases change
  useEffect(() => {
    const loadRaffleStatuses = async () => {
      try {
        const res = await fetch('/api/raffle');
        const data = await res.json();
        if (data.ok && Array.isArray(data.raffles)) {
          const statusMap = data.raffles.reduce((acc: Record<string, any>, raffle: any) => {
            acc[raffle.eventid] = raffle;
            return acc;
          }, {});
          setRaffleStatuses(statusMap);
        }
      } catch (error) {
        console.error('Error loading raffle statuses:', error);
      }
    };

    loadRaffleStatuses();
  }, [purchases]); // Reload when purchases change to get updated raffle statuses

  // Group purchases by event (for display)
  const groupedByEvent = getPendingEvents().reduce<Record<string, Purchase[]>>((acc, eventid) => {
    acc[eventid] = purchases.filter(p => String(p.eventid) === eventid);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Admin Dashboard — Purchases</h1>
              <div className="text-sm text-gray-400 mt-2">
              Next auto raffle: {nextRaffleTime.toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })} WIB
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={() => setAutoRaffleEnabled(!autoRaffleEnabled)}
              className={`px-3 py-1 rounded border ${
                autoRaffleEnabled ? "bg-green-600" : "bg-gray-600"
              }`}
            >
              Auto Raffle: {autoRaffleEnabled ? "ON" : "OFF"}
            </button>
            <button onClick={loadPurchases} className="px-3 py-1 rounded border bg-gray-800">
              Refresh
            </button>
            <button onClick={exportCSV} className="px-3 py-1 rounded bg-indigo-600 text-white">
              Export CSV
            </button>
          </div>
        </div>

        {message && <pre className="bg-gray-800 p-3 rounded mb-4 whitespace-pre-wrap">{message}</pre>}

        {loading && <div className="mb-4">Loading…</div>}

        {Object.keys(groupedByEvent).length === 0 && !loading && (
          <div className="text-sm opacity-70">No purchases yet.</div>
        )}

        {Object.entries(groupedByEvent).map(([eventId, list]) => (
          <div key={eventId} className="mb-6 border border-gray-700 rounded p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-gray-400">Event</div>
                <div className="font-semibold">{eventId}</div>
                <div className="text-xs opacity-70 mt-1">Entries: {list.length}</div>
              </div>
              <div className="flex gap-2 flex-col items-end">
                {raffleStatuses[eventId]?.winners && raffleStatuses[eventId]?.txHash && raffleStatuses[eventId].txHash !== 'pending' ? (
                  <div className="flex flex-col items-end gap-2">
                    <div className="px-3 py-1 rounded bg-green-600 text-sm">Raffle Done</div>
                      <div className="text-sm text-right">
                      {raffleStatuses[eventId]?.winners && (
                        <div className="text-gray-400">Winner: <span className="text-green-400">{raffleStatuses[eventId].winners[0]}</span></div>
                      )}
                      {raffleStatuses[eventId]?.txHash && (
                        <div className="text-gray-400">
                          <a href={`https://explorer.carv.io/tx/${raffleStatuses[eventId].txHash}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="text-blue-400 hover:underline">
                            Tx: {raffleStatuses[eventId].txHash}
                          </a>
                        </div>
                      )}
                      {raffleStatuses[eventId]?.createdAt && (
                        <div className="text-gray-400 text-xs mt-1">
                          Raffled at: {new Date(raffleStatuses[eventId].createdAt).toISOString().replace('T', ' ').split('.')[0]}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => runRaffle(eventId)} 
                    className={`px-3 py-1 rounded ${
                      raffleStatuses[eventId] && raffleStatuses[eventId].txHash === "pending"
                        ? "bg-yellow-600 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-700"
                    }`}
                    disabled={raffleStatuses[eventId] && raffleStatuses[eventId].txHash === "pending"}
                  >
                    {raffleStatuses[eventId] && raffleStatuses[eventId].txHash === "pending"
                      ? "Raffle Pending..."
                      : "Run Raffle"}
                  </button>
                )}
              </div>
            </div>

            <table className="w-full table-auto text-left">
              <thead>
                <tr className="text-xs text-gray-400">
                  <th className="px-2 py-1">Buyer</th>
                  <th className="px-2 py-1">Txid</th>
                  <th className="px-2 py-1">Amount</th>
                  <th className="px-2 py-1">Time</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id} className="border-t border-gray-800">
                    <td className="px-2 py-2 text-sm">{p.buyer}</td>
                    <td className="px-2 py-2 text-sm break-all">{p.txid}</td>
                    <td className="px-2 py-2 text-sm">
                      {p.amount} {p.token}
                    </td>
                    <td className="px-2 py-2 text-sm">{new Date(p.timestamp).toISOString().replace('T', ' ').split('.')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}