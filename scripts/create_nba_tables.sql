-- Create nba_matches_pending table
CREATE TABLE nba_matches_pending (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    league TEXT NOT NULL DEFAULT 'NBA',
    event_date TIMESTAMPTZ NOT NULL,
    venue TEXT,
    status TEXT DEFAULT 'pending',
    selected_for_date DATE,
    selected_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    home_score INTEGER,
    away_score INTEGER,
    wib_time TEXT,
    selected_at_date DATE
);

-- Create nba_matches_history table
CREATE TABLE nba_matches_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    league TEXT NOT NULL DEFAULT 'NBA',
    event_date TIMESTAMPTZ NOT NULL,
    venue TEXT,
    home_score INTEGER,
    away_score INTEGER,
    status TEXT DEFAULT 'waiting for result',
    winner TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nba_predictions table
CREATE TABLE nba_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    prediction_winner TEXT NOT NULL,
    prediction_time TIMESTAMPTZ NOT NULL,
    prediction_text TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create nba_locked_selections table
CREATE TABLE nba_locked_selections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    locked_at TIMESTAMPTZ DEFAULT NOW(),
    match_ids TEXT[] NOT NULL,
    visibility_start_date DATE NOT NULL,
    window_start TIMESTAMPTZ,
    window_end TIMESTAMPTZ,
    UNIQUE(visibility_start_date)
);

-- Create nba_raffle table
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
CREATE INDEX idx_nba_matches_pending_event_id ON nba_matches_pending(event_id);
CREATE INDEX idx_nba_matches_pending_status ON nba_matches_pending(status);
CREATE INDEX idx_nba_matches_pending_event_date ON nba_matches_pending(event_date);

CREATE INDEX idx_nba_matches_history_event_id ON nba_matches_history(event_id);
CREATE INDEX idx_nba_matches_history_event_date ON nba_matches_history(event_date);

CREATE INDEX idx_nba_predictions_event_id ON nba_predictions(event_id);
CREATE INDEX idx_nba_predictions_created_at ON nba_predictions(created_at);

CREATE INDEX idx_nba_locked_selections_visibility_start_date ON nba_locked_selections(visibility_start_date);

CREATE INDEX idx_nba_raffle_event_id ON nba_raffle(event_id);
CREATE INDEX idx_nba_raffle_created_at ON nba_raffle(created_at);
CREATE INDEX idx_nba_raffle_winner ON nba_raffle(winner);

-- Unique constraints
ALTER TABLE nba_raffle ADD CONSTRAINT unique_nba_event_id UNIQUE (event_id);