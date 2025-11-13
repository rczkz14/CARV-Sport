"use client";

import React, { useEffect, useState } from "react";

interface RaffleResult {
  id: string;
  eventId: string;
  date: string;
  winners: string[];
  buyerCount: number;
  entries: Array<{
    id: string;
    buyer: string;
    txid: string;
    timestamp: string;
  }>;
  token: string;
  createdAt: string;
  prizePool: number;
  winnerPayout: number;
  txHash: string;
  matchDetails?: {
    home: string;
    away: string;
    league: string;
  };
}

export default function RafflePage() {
  const [darkMode, setDarkMode] = useState(false);
  const [loadingRaffle, setLoadingRaffle] = useState(false);
  const [raffleResults, setRaffleResults] = useState<RaffleResult[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDarkMode(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      fetchRaffleResults();
    }
  }, [mounted]);

  const fetchRaffleResults = async () => {
    try {
      setLoadingRaffle(true);
      const res = await fetch('/api/raffle');
      const data = await res.json();
      if (data.ok && Array.isArray(data.raffles)) {
        setRaffleResults(data.raffles);
      }
    } catch (error) {
      console.error('Error fetching raffle results:', error);
    } finally {
      setLoadingRaffle(false);
    }
  };

  return (
    <div className={`${darkMode ? "bg-gray-900 text-white" : "bg-white text-gray-900"} min-h-screen transition-colors`}>
      {!mounted ? null : (
        <>
          <div className="fixed top-4 left-4 z-50">
            <a href="/">
              <img src="/images/CARV-Logo.png" alt="CARV Logo" className="w-26 h-12 rounded" />
            </a>
          </div>

          <div className="max-w-5xl mx-auto p-6">
        <header className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Raffle Results</h1>
            <p className="text-sm opacity-80 mt-2">View all completed raffle drawings and winners</p>
          </div>
          <a 
            href="/" 
            className="px-3 py-1 rounded border text-sm hover:bg-gray-800 transition-colors"
          >
            ← Back to Predictions
          </a>
        </header>

        <main>
          {loadingRaffle ? (
            <div className="text-center py-8">
              <div className="text-sm opacity-70">Loading raffle results...</div>
            </div>
          ) : (
            <div className="space-y-4">
              {raffleResults.map((raffle) => {
                const winners = Array.isArray(raffle.winners) ? raffle.winners : [];
                const winner = winners.length > 0 ? winners[0] : null;
                const walletDisplay = winner ? winner.slice(0, 6) + '...' + winner.slice(-4) : 'No winner yet';
                
                return (
                  <div key={raffle.eventId} className={`p-6 rounded-xl ${darkMode ? "bg-gray-800/80 border border-gray-700" : "bg-gray-100 border border-gray-300"}`}>
                    <div className="flex gap-6">
                      {/* Left side: Match info */}
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="text-sm text-indigo-400 font-medium">{raffle.matchDetails?.league || 'NBA'}</div>
                            <div className="text-lg font-semibold flex items-center gap-3 mt-1">
                              <span>{raffle.matchDetails?.home || 'Home Team'}</span>
                              <span className="opacity-50">vs</span>
                              <span>{raffle.matchDetails?.away || 'Away Team'}</span>
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            Event #{raffle.eventId}
                          </div>
                        </div>

                        <div className="mt-6 grid grid-cols-3 gap-4">
                          {/* Winner Card */}
                          <div className="bg-green-500/10 rounded-lg p-3">
                            <div className="text-sm text-gray-400 mb-2">Winner</div>
                            <div className="font-mono text-green-400 text-sm">
                              {walletDisplay}
                            </div>
                          </div>

                          {/* Prize Pool Card */}
                          <div className="bg-blue-500/10 rounded-lg p-3">
                            <div className="text-sm text-gray-400 mb-2">Prize Pool</div>
                            <div className="font-mono text-blue-400 text-sm">
                              {raffle.prizePool ? raffle.prizePool.toFixed(1) : '0.0'} $CARV
                            </div>
                          </div>

                          {/* Winner Payout Card */}
                          <div className="bg-yellow-400/10 rounded-lg p-3">
                            <div className="text-sm text-gray-400 mb-2">Payout</div>
                            <div className="font-mono text-yellow-400 text-sm">
                              {raffle.winnerPayout ? raffle.winnerPayout.toFixed(1) : '0.0'} $CARV
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 text-xs text-gray-500">
                          Draw completed: {new Date(raffle.createdAt).toLocaleString()}
                        </div>
                      </div>

                      {/* Right side: Winner Image */}
                      <div className="hidden md:block">
                        <img 
                          src="/images/nba-raffle-winner.png" 
                          alt="Raffle Winner" 
                          className="w-32 h-32 object-cover rounded-lg border-2 border-yellow-400/30"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {raffleResults.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-sm opacity-70 p-6 rounded-lg border border-gray-700 inline-block">
                    <div className="font-medium mb-1">No raffle results found</div>
                    <div className="text-gray-400">Check back after matches are completed</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="mt-12 border-t border-gray-800 pt-6 text-sm opacity-50 flex justify-between items-center">
          <div>CARV Sports Predictions — Powered by CARV SVM Testnet ⚡️</div>
          <div className="flex items-center gap-2 bg-white rounded-lg p-3 shadow-lg">
            <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X">
              <img src="/images/twitter-logo.png" alt="Twitter" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
            </a>
            <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile">
              <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
            </a>
          </div>
        </footer>
      </div>
        </>
      )}
    </div>
  );
}