"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type Purchase = {
  id: string;
  eventid: string;
  buyer: string;
  txid: string;
  amount: number;
  token: string;
  timestamp: string;
};

export default function AdminDashboard() {
  // Simple login state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Hardcoded credentials (change as needed)
  const ADMIN_USER = "erxie";
  const ADMIN_PASS = "adadeh";

  // Supabase client setup
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://YOUR_SUPABASE_URL";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Data state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [raffles, setRaffles] = useState<any[]>([]);
  const [raffleLoadingId, setRaffleLoadingId] = useState<string | null>(null);
  const [raffleResult, setRaffleResult] = useState<string | null>(null);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Helper to get raffle details for an event
  function getRaffleDetails(eventId: string) {
    return raffles.find(r => String(r.event_id) === String(eventId));
  }

  // Close dropdown when clicking outside (must be after all useState declarations)
  useEffect(() => {
    if (!openDropdownId) return;
    function handleClick(e: MouseEvent) {
      const dropdowns = document.querySelectorAll('.nba-dropdown');
      let clickedInside = false;
      dropdowns.forEach((dropdown) => {
        if (dropdown.contains(e.target as Node)) clickedInside = true;
      });
      if (!clickedInside) setOpenDropdownId(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [openDropdownId]);

  // Run raffle for a match
  async function handleRunRaffle(eventId: string) {
    setRaffleLoadingId(eventId);
    setRaffleResult(null);
    try {
      const res = await fetch('/api/raffle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventid: eventId })
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const winner = data.result.winners?.[0] || data.result.winner || 'N/A';
        const payout = data.result.winnerPayout || data.result.winner_payout || 0;
        const txHash = data.result.txHash || data.result.tx_hash || 'N/A';
        setRaffleResult(
          `Raffle complete!\nWinner: ${winner}\nPayout: ${payout} $CARV\nTxHash: ${txHash}`
        );
      } else {
        setRaffleResult(data.error || 'Raffle failed');
      }
    } catch (err: any) {
      setRaffleResult('Error running raffle');
    } finally {
      setRaffleLoadingId(null);
      fetchData(); // refresh data
    }
  }

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch purchases
      const { data: purchasesData, error: purchasesError } = await supabase
        .from('purchases')
        .select('*');
      if (purchasesError) throw purchasesError;
      setPurchases(purchasesData || []);

      // Fetch NBA matches history
      const { data: matchesData, error: matchesError } = await supabase
        .from('nba_matches_history')
        .select('*');
      if (matchesError) throw matchesError;
      setMatches(matchesData || []);

      // Fetch NBA raffles
      const { data: rafflesData, error: rafflesError } = await supabase
        .from('nba_raffle')
        .select('*');
      if (rafflesError) throw rafflesError;
      setRaffles(rafflesData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (username === ADMIN_USER && password === ADMIN_PASS) {
      setIsAuthenticated(true);
      setLoginError(null);
    } else {
      setLoginError("Invalid username or password");
    }
  }

  // Group purchases by event_id (to match nba_matches_history.event_id)
  const buyersByEventId: Record<string, any[]> = {};
  purchases.forEach((p) => {
    const key = String(p.eventid);
    if (!buyersByEventId[key]) buyersByEventId[key] = [];
    buyersByEventId[key].push(p);
  });

  // Check if raffle exists for each event
  const raffleExistsByEventId: Record<string, boolean> = {};
  raffles.forEach((r) => {
    raffleExistsByEventId[String(r.event_id)] = true;
  });

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <form onSubmit={handleLogin} className="bg-gray-800 p-8 rounded shadow-md w-full max-w-sm">
          <h2 className="text-2xl font-bold mb-6 text-white text-center">Admin Login</h2>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded bg-gray-700 text-white"
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full mb-4 px-3 py-2 rounded bg-gray-700 text-white"
          />
          {loginError && <div className="text-red-500 mb-4 text-center">{loginError}</div>}
          <button type="submit" className="w-full py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard — NBA Purchases & Match Status</h1>
        {loading && <div className="mb-4">Loading…</div>}
        {error && <div className="mb-4 text-red-400">{error}</div>}
        <table className="w-full table-auto text-left bg-gray-800 rounded">
          <thead>
            <tr className="text-xs text-gray-400">
              <th className="px-2 py-1">Event ID</th>
              <th className="px-2 py-1">Home</th>
              <th className="px-2 py-1">Away</th>
              <th className="px-2 py-1">Time</th>
              <th className="px-2 py-1">Status</th>
              <th className="px-2 py-1">Buyers</th>
              <th className="px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {matches
              .sort((a, b) => new Date(b.event_date || b.datetime || 0).getTime() - new Date(a.event_date || a.datetime || 0).getTime())
              .map((m) => (
              <tr key={m.event_id} className="border-t border-gray-700">
                <td className="px-2 py-2 text-sm">{m.event_id}</td>
                <td className="px-2 py-2 text-sm">{m.home_team}</td>
                <td className="px-2 py-2 text-sm">{m.away_team}</td>
                <td className="px-2 py-2 text-sm text-xs">
                  {m.event_date ? new Date(m.event_date).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </td>
                <td className="px-2 py-2 text-sm">
                  {m.status === 'final' || m.status === 'Full Time' ? (
                    <span style={{backgroundColor: 'red', color: 'white', padding: '4px 12px', borderRadius: '6px', fontWeight: 'bold'}}>
                      Status: Full Time
                    </span>
                  ) : m.status === 'AOT' || m.status === 'After Overtime' ? (
                    <span style={{backgroundColor: '#d32f2f', color: 'white', padding: '4px 12px', borderRadius: '6px', fontWeight: 'bold'}}>
                      Status: After Overtime
                    </span>
                  ) : (
                    <span className="px-2 py-1 rounded bg-yellow-700 text-white text-xs">{m.status}</span>
                  )}
                </td>
                <td className="px-2 py-2 text-sm">
                  {buyersByEventId[m.event_id]?.length || 0}
                </td>
                <td className="px-2 py-2 text-sm flex gap-2 items-center">
                  {(() => {
                    const buttonText = raffleLoadingId === m.event_id ? 'Running…' :
                                     raffleExistsByEventId[m.event_id] ? 'Raffle Done' :
                                     !buyersByEventId[m.event_id]?.length ? '0 Buyers' :
                                     (m.status !== 'final' && m.status !== 'AOT') ? 'Not Eligible' :
                                     'Run Raffle';

                    const getButtonClass = (text: string) => {
                      const baseClass = "px-3 py-1 rounded text-xs disabled:opacity-50";
                      switch (text) {
                        case 'Raffle Done':
                          return `${baseClass} bg-green-700 hover:bg-green-800`;
                        case '0 Buyers':
                          return `${baseClass} bg-gray-600 hover:bg-gray-700 cursor-not-allowed`;
                        case 'Not Eligible':
                          return `${baseClass} bg-red-700 hover:bg-red-800 cursor-not-allowed`;
                        case 'Running…':
                          return `${baseClass} bg-yellow-600 hover:bg-yellow-700`;
                        default:
                          return `${baseClass} bg-indigo-700 hover:bg-indigo-800`;
                      }
                    };

                    return (
                      <button
                        className={getButtonClass(buttonText)}
                        disabled={raffleLoadingId === m.event_id || (m.status !== 'final' && m.status !== 'AOT') || !buyersByEventId[m.event_id]?.length || raffleExistsByEventId[m.event_id]}
                        onClick={() => handleRunRaffle(m.event_id)}
                      >
                        {buttonText}
                      </button>
                    );
                  })()}
                  <button
                    className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-800 border border-gray-600"
                    onClick={() => setOpenDropdownId(openDropdownId === m.event_id ? null : m.event_id)}
                  >
                    ▼
                  </button>
                  {openDropdownId === m.event_id && (
                    <div className="nba-dropdown absolute z-10 mt-2 bg-gray-900 border border-gray-700 rounded shadow-lg p-4 text-xs min-w-[220px]">
                      {(() => {
                        const raffle = getRaffleDetails(m.event_id);
                        if (!raffle) return <div className="text-gray-400">No raffle details found</div>;
                        return (
                          <div>
                            <div className="font-bold text-indigo-400 mb-1">Raffle Details</div>
                            <div><span className="text-gray-400">Winner:</span> <span className="text-green-400">{raffle.winner || raffle.winners?.[0] || 'N/A'}</span></div>
                            <div><span className="text-gray-400">Prize:</span> <span className="text-yellow-400">{raffle.winner_payout || raffle.winnerPayout || 0} $CARV</span></div>
                            <div><span className="text-gray-400">Buyers:</span> {raffle.buyer_count || raffle.buyerCount || 0}</div>
                            <div><span className="text-gray-400">Drawn:</span> {raffle.created_at ? new Date(raffle.created_at).toLocaleString() : 'N/A'}</div>
                            {raffle.tx_hash && <div><span className="text-gray-400">TxHash:</span> <span className="break-all">{raffle.tx_hash}</span></div>}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </td>
              </tr>
            ))}
                {raffleResult && (
                  <div className="mt-6 p-4 rounded bg-gray-700 text-yellow-300 whitespace-pre-line text-center">{raffleResult}</div>
                )}
          </tbody>
        </table>
      </div>
    </div>
  );
}