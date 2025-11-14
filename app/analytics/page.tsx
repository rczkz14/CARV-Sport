"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PredictionStats {
  league: string;
  totalPredictions: number;
  correctPredictions: number;
  winRate: number;
  totalSpent: number;
  potentialWinnings: number;
  averageOdds: number;
}

interface OverallStats {
  totalPredictions: number;
  correctPredictions: number;
  winRate: number;
  totalSpent: number;
  roi: number;
  bestLeague: string;
  worstLeague: string;
  bestStreak: number;
  currentStreak: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [overallStats, setOverallStats] = useState<OverallStats | null>(null);
  const [leagueStats, setLeagueStats] = useState<PredictionStats[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAnalytics = async () => {
      try {
        let wallet = null;
        
        // Check for wallet connection
        if ((window as any).backpack?.publicKey) {
          wallet = (window as any).backpack.publicKey.toString();
        } else if ((window as any).solana?.publicKey) {
          wallet = (window as any).solana.publicKey.toString();
        } else if ((window as any).phantom?.solana?.publicKey) {
          wallet = (window as any).phantom.solana.publicKey.toString();
        }
        
        setPublicKey(wallet);
        // Fetch data regardless of wallet connection
        await fetchAnalyticsData(wallet);
      } catch (e) {
        console.error('Error initializing:', e);
        setError("Failed to load analytics");
        setLoading(false);
      }
    };
    
    initializeAnalytics();
  }, []);

  const fetchAnalyticsData = async (wallet: string | null) => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching analytics data...');

      // Fetch predictions from database tables
      const nbaPredictionsRes = await fetch('/api/analytics/predictions?nba=true');
      const nbaPredictions = await nbaPredictionsRes.json();

      const soccerPredictionsRes = await fetch('/api/analytics/predictions?soccer=true');
      const soccerPredictions = await soccerPredictionsRes.json();

      console.log('NBA predictions:', nbaPredictions.length);
      console.log('Soccer predictions:', soccerPredictions.length);

      // Combine all predictions
      const allPredictions = [...nbaPredictions, ...soccerPredictions];
      console.log('Total predictions:', allPredictions.length);

      // Process predictions and calculate accuracy
      let totalCorrect = 0;
      let totalPredictions = 0;
      const leagueMap = new Map<string, { correct: number; total: number }>();

      for (const prediction of allPredictions) {
        try {
          const league = prediction.league || 'NBA';
          const isCorrect = prediction.is_correct === true;

          if (!leagueMap.has(league)) {
            leagueMap.set(league, { correct: 0, total: 0 });
          }

          const stats = leagueMap.get(league)!;
          stats.total += 1;
          if (isCorrect) {
            stats.correct += 1;
            totalCorrect += 1;
          }
          totalPredictions += 1;
        } catch (e) {
          console.warn(`Error processing prediction ${prediction.event_id}:`, e);
        }
      }

      console.log('Total predictions:', totalPredictions, 'Correct:', totalCorrect);
      
      // Build league stats
      const leagueStatsList: PredictionStats[] = [];
      leagueMap.forEach((data, league) => {
        const stats: PredictionStats = {
          league,
          totalPredictions: data.total,
          correctPredictions: data.correct,
          winRate: data.total > 0 ? (data.correct / data.total) * 100 : 0,
          totalSpent: 0,
          potentialWinnings: 0,
          averageOdds: 0,
        };
        leagueStatsList.push(stats);
      });
      
      // Sort leagues by prediction count
      leagueStatsList.sort((a, b) => b.totalPredictions - a.totalPredictions);
      
      // Calculate overall stats
      const overall: OverallStats = {
        totalPredictions,
        correctPredictions: totalCorrect,
        winRate: totalPredictions > 0 ? (totalCorrect / totalPredictions) * 100 : 0,
        totalSpent: 0,
        roi: 0,
        bestLeague: leagueStatsList.length > 0 ? leagueStatsList[0].league : 'N/A',
        worstLeague: leagueStatsList.length > 0 ? leagueStatsList[leagueStatsList.length - 1].league : 'N/A',
        bestStreak: 0,
        currentStreak: 0,
      };
      
      console.log('Overall:', overall);
      console.log('Leagues:', leagueStatsList);
      
      setOverallStats(overall);
      setLeagueStats(leagueStatsList);
      setLoading(false);
    } catch (e) {
      console.error('Error fetching analytics:', e);
      setError("Failed to load analytics data");
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col items-center justify-center">
        <div className="mb-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-500"></div>
        </div>
        <p className="text-gray-400">Loading your analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white flex flex-col items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-5xl mb-4">ℹ️</div>
          <h1 className="text-2xl font-bold mb-2">No Data Available</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Fixed Logo */}
      <div className="fixed top-4 left-4 z-50">
        <img src="/images/CARV-Logo.png" alt="CARV" className="w-24 h-10 rounded hover:shadow-lg transition-shadow cursor-pointer" 
          onClick={() => router.push('/')} />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              Prediction Analytics
            </h1>
            <p className="text-gray-400 mt-2">Track your prediction performance across all leagues</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-medium transition-all hover:shadow-lg active:scale-95"
          >
            ← Back
          </button>
        </div>

        {/* Overall Stats - Premium Cards */}
        {overallStats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {/* Card 1: Total Predictions */}
            <div className="group relative bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-indigo-500 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-indigo-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 to-purple-500/0 group-hover:from-indigo-500/5 group-hover:to-purple-500/5 rounded-xl transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Predictions</span>
                  <span className="text-2xl">🎯</span>
                </div>
                <div className="text-4xl font-bold text-indigo-400">{overallStats.totalPredictions}</div>
              </div>
            </div>

            {/* Card 2: Win Rate */}
            <div className="group relative bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-green-500 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-green-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 to-emerald-500/0 group-hover:from-green-500/5 group-hover:to-emerald-500/5 rounded-xl transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Win Rate</span>
                  <span className="text-2xl">📈</span>
                </div>
                <div className="text-4xl font-bold text-green-400">{overallStats.winRate.toFixed(2)}%</div>
                <div className="text-xs text-gray-500 mt-3">{overallStats.correctPredictions} wins / {overallStats.totalPredictions} total</div>
              </div>
            </div>

            {/* Card 3: Best League */}
            <div className="group relative bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 hover:border-yellow-500 rounded-xl p-6 transition-all hover:shadow-xl hover:shadow-yellow-500/10">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/0 to-orange-500/0 group-hover:from-yellow-500/5 group-hover:to-orange-500/5 rounded-xl transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Best League</span>
                  <span className="text-2xl">🏆</span>
                </div>
                <div className="text-3xl font-bold text-yellow-400">{overallStats.bestLeague}</div>
              </div>
            </div>
          </div>
        )}

        {/* League Breakdown - Clean Table */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-xl p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span>📊</span> Performance by League
          </h2>
          
          {leagueStats.length === 0 ? (
            <div className="text-center py-12 flex flex-col items-center justify-center">
              <img src="/images/analystic.gif" alt="Analytics" style={{ width: '75%', maxWidth: 400, height: 'auto' }} className="mb-4 object-contain" />
              <div className="text-gray-400 text-lg">No predictions yet</div>
              <p className="text-gray-500 text-sm mt-2">Make your first prediction to see analytics</p>
            </div>
          ) : (
            <div className="space-y-3">
              {leagueStats.map((stat) => {
                const isGood = stat.winRate >= 50;
                const isMedium = stat.winRate >= 25;
                
                return (
                  <div
                    key={stat.league}
                    className="bg-gray-700/20 border border-gray-600 rounded-lg p-4 hover:bg-gray-600/30 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="text-lg font-semibold text-white">{stat.league}</div>
                        <div className="text-sm text-gray-400">{stat.totalPredictions} predictions</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${
                          isGood ? 'text-green-400' : isMedium ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {stat.winRate.toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-500">{stat.correctPredictions} / {stat.totalPredictions}</div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3">
                      <div className="w-full bg-gray-600/30 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            isGood ? 'bg-green-500' :
                            isMedium ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${Math.min(stat.winRate, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="text-center text-gray-500 text-xs py-8 border-t border-gray-700/50">
          <p>Analytics based on AI prediction accuracy vs actual match results</p>
          <p className="mt-2">Last updated: {new Date().toLocaleString()}</p>
        </div>
        
        {/* Social links footer */}
        <div className="flex justify-center items-center gap-2 py-4 bg-white rounded-lg p-3 mx-auto w-fit shadow-lg">
          <a href="https://x.com/erxie0x" target="_blank" rel="noopener noreferrer" title="Follow on X">
            <img src="/images/twitter-logo.png" alt="Twitter" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
          </a>
          <a href="https://play.carv.io/profile/erxie" target="_blank" rel="noopener noreferrer" title="View CARV Profile">
            <img src="/images/carv-profile-logo.png" alt="CARV Profile" className="w-8 h-8 object-contain hover:scale-110 transition-transform cursor-pointer" />
          </a>
        </div>
      </div>
    </div>
  );
}
