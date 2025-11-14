-- Create nba_raffle table for NBA auto-raffle system
CREATE TABLE nba_raffle (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    winner TEXT NOT NULL,
    buyer_count INTEGER NOT NULL,
    prize_pool NUMERIC(10,2) NOT NULL,
    winner_payout NUMERIC(10,2) NOT NULL,
    tx_hash TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    token TEXT DEFAULT 'CARV',
    league TEXT DEFAULT 'NBA',
    home_team TEXT,
    away_team TEXT,
    match_date DATE
);

-- Indexes for performance
CREATE INDEX idx_nba_raffle_event_id ON nba_raffle(event_id);
CREATE INDEX idx_nba_raffle_created_at ON nba_raffle(created_at);
CREATE INDEX idx_nba_raffle_winner ON nba_raffle(winner);

-- Unique constraint on event_id to prevent duplicate raffles per match
ALTER TABLE nba_raffle ADD CONSTRAINT unique_event_id UNIQUE (event_id);