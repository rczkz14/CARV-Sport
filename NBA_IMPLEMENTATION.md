# NBA Prediction Market Implementation

## Overview

The NBA prediction market system is designed to provide automated predictions for NBA matches within a specific trading window, with automatic generation and result tracking.

## Key Features

### 1. **D+1 Match Display**
- **Window**: 13:00 - 04:00 WIB (next day) = 06:00 - 21:00 UTC
- **Display**: Only shows matches for the next calendar day (D+1) in WIB timezone
- **Limit**: Maximum 3 NBA matches displayed per window
- **Location**: "Matches" tab during active window

**Implementation Files:**
- `lib/nbaWindowManager.ts` - Window calculation and filtering logic
- `app/api/matches/route.ts` - API endpoint that filters NBA matches to D+1

**How it works:**
```typescript
// Example: Nov 12, 2025 13:00 WIB (06:00 UTC)
// Shows matches for Nov 13 (next calendar day in WIB)

const { startUTC, endUTC } = getD1DateRangeWIB(nowUtc);
const d1Matches = filterNBAMatchesToD1(allMatches, nowUtc);
// Result: Max 3 matches for Nov 13
```

### 2. **Auto-Predict Generation**
- **Trigger Time**: 12:00 WIB (05:00 UTC) - 1 hour before window opens
- **Target**: All visible NBA matches (max 3 per window)
- **Prediction Type**: Winner-only (no draws for NBA)
- **Storage**: Saved to `data/raffle-{eventId}.json`

**Implementation Files:**
- `app/api/worker/auto-predict-nba/route.ts` - API endpoint for auto-predict
- `lib/predictionGenerator.ts` - Prediction generation logic
- `lib/nbaWindowManager.ts` - Time calculation (`isAutoPredictTime`, `getNextAutoPredictTime`)

**How to trigger:**
```bash
# Manual trigger (for testing)
curl -X GET "http://localhost:3000/api/worker/auto-predict-nba" \
  -H "Authorization: Bearer test-key"

# Or set WORKER_API_KEY environment variable
WORKER_API_KEY=your-secret-key
```

**Setting up cron (external scheduler):**
```
# Using node-cron or external service, call daily at 05:00 UTC:
GET /api/worker/auto-predict-nba?key=your-secret-key
```

### 3. **Match Status History**
- **When**: At 04:00 WIB (21:00 UTC) or when match reaches FT status
- **Storage**: Matches are saved to `data/nba_history.json`
- **Display**: Accumulates ALL matches from all closed windows

**Implementation Files:**
- `app/api/worker/finish-match/route.ts` - API endpoint to mark matches as finished
- `lib/predictionGenerator.ts` - History saving functions

**How to save a finished match:**
```bash
# Mark a match as finished
curl -X POST "http://localhost:3000/api/worker/finish-match" \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "12345",
    "home": "Lakers",
    "away": "Celtics",
    "league": "NBA",
    "datetime": "2025-11-13T20:00:00Z",
    "venue": "TD Garden",
    "homeScore": 110,
    "awayScore": 105,
    "status": "Final"
  }'

# Or trigger automatic check:
curl -X GET "http://localhost:3000/api/worker/finish-match" \
  -H "Authorization: Bearer test-key"
```

### 4. **Prediction Visibility**
- **Hidden Until**: Match reaches FT (Final) status
- **Viewable By**: All users (not just buyers after match finishes)
- **Storage**: Saved in history with match results

**Implementation:**
- `app/page.tsx` - Frontend checks `status` includes "FT" before showing predictions
- View button shows "View Prediction (Locked)" until match finishes

**User Flow:**
```
1. User buys prediction during window (13:00 - 04:00 WIB)
2. "View Prediction" button is LOCKED (disabled)
3. At auto-predict time (12:00 WIB), prediction is generated
4. Match plays...
5. When match reaches FT status:
   - "View Prediction" button UNLOCKS (enabled)
   - All users can view predictions
   - Match moves to "Status & History" tab
```

## Data Storage

### Files Created/Used

```
data/
├── nba_history.json           # All finished NBA matches (accumulating)
│   └── {
│       "matches": [
│         {
│           "id": "event123",
│           "home": "Lakers",
│           "away": "Celtics",
│           "homeScore": 110,
│           "awayScore": 105,
│           "status": "FT",
│           "actualWinner": "Lakers",
│           "isCorrect": true,
│           "prediction": { ... },
│           "savedAt": "2025-11-13T21:00:00Z"
│         }
│       ]
│     }
├── raffle-{eventId}.json       # Individual prediction files
│   └── {
│       "eventId": "event123",
│       "matchDetails": { ... },
│       "prediction": {
│         "predictedWinner": "Lakers",
│         "predictedScore": "110-105",
│         "confidence": 65,
│         ...
│       }
│     }
└── api_fetch.json             # Live match data cache
```

## Timeline Example

### Nov 12, 2025 (Today)

```
12:00 WIB (05:00 UTC) - AUTO-PREDICT TRIGGERS
  ├─ Fetch D+1 matches (Nov 13)
  ├─ Find max 3 NBA matches
  └─ Generate predictions for each

13:00 WIB (06:00 UTC) - WINDOW OPENS
  ├─ "Matches" tab shows 3 NBA matches
  ├─ Users can buy predictions
  └─ Auto-generated predictions ready

16:00 WIB (09:00 UTC) - MATCHES PLAYING
  └─ Match scores update in real-time

04:00 WIB (Nov 13, 21:00 UTC prev day) - WINDOW CLOSES
  ├─ "Matches" tab clears
  ├─ Matches move to "Status & History" tab
  └─ New D+1 window opens for Nov 14

When matches finish (FT status):
  ├─ Predictions become visible
  ├─ Results saved to nba_history.json
  └─ Raffle winners determined
```

## Environment Variables

```env
# Required for worker authentication
WORKER_API_KEY=your-secret-key

# Optional: Set custom RPC and treasury
NEXT_PUBLIC_CARV_RPC=https://rpc.testnet.carv.io/rpc
NEXT_PUBLIC_TREASURY_PUBKEY=5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA
```

## Testing

### 1. Test D+1 Filtering

```bash
# Test fetch NBA matches for D+1
curl "http://localhost:3000/api/matches" \
  -H "Accept: application/json"

# Should show only NBA matches for tomorrow's calendar day
```

### 2. Test Auto-Predict Manually

```bash
# Trigger auto-predict generation
curl -X GET "http://localhost:3000/api/worker/auto-predict-nba" \
  -H "Authorization: Bearer test-key"

# Check predictions were created in data/raffle-*.json
ls -la data/raffle-*.json
```

### 3. Test Finish Match

```bash
# Mark match as finished
curl -X POST "http://localhost:3000/api/worker/finish-match" \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test123",
    "home": "Lakers",
    "away": "Celtics",
    "league": "NBA",
    "homeScore": 110,
    "awayScore": 105,
    "status": "FT"
  }'

# Check history was saved
cat data/nba_history.json
```

### 4. Test Frontend

1. Navigate to http://localhost:3000
2. Select "NBA" league
3. See "Matches" tab with max 3 NBA matches (D+1 only)
4. Buy a prediction
5. "View Prediction" button shows as "Locked" until match finishes
6. (After match finishes) Button unlocks and shows prediction

## Key Functions

### Window Manager (`lib/nbaWindowManager.ts`)

```typescript
// Get current window status
getNBAWindowStatus(nowUtc?: Date)
// Returns: { isOpen, wibHour, utcHour, hoursUntilNextChange }

// Get D+1 date range for filtering
getD1DateRangeWIB(nowUtc?: Date)
// Returns: { startUTC, endUTC, dateStringWIB }

// Filter matches to D+1
filterNBAMatchesToD1(matches, nowUtc?: Date)
// Returns: Array (max 3 matches for next calendar day)

// Check if auto-predict should run
isAutoPredictTime(nowUtc?: Date)
// Returns: boolean (true if 05:00-05:05 UTC)

// Get next auto-predict trigger time
getNextAutoPredictTime(nowUtc?: Date)
// Returns: Date of next 05:00 UTC
```

### Prediction Generator (`lib/predictionGenerator.ts`)

```typescript
// Generate predictions for matches
generatePredictionsForMatches(matches)
// Automatically detects NBA and uses winner-only logic

// Save finished match to history
saveToNBAHistory(matchData)
// Creates entry with prediction + result

// Get all history
getNBAHistory()
// Returns: Array of all finished NBA matches

// Get recent history
getRecentNBAHistory(limit)
// Returns: Array (newest first)
```

## Troubleshooting

### Predictions not generating at auto-predict time

1. Check `WORKER_API_KEY` environment variable is set
2. Verify current UTC time is 05:00-05:05
3. Check logs for errors in `/api/worker/auto-predict-nba`
4. Manually trigger: `curl -X GET http://localhost:3000/api/worker/auto-predict-nba -H "Authorization: Bearer test-key"`

### D+1 matches not showing

1. Verify ESPN API is responding with NBA data
2. Check that match datetime falls within D+1 range in WIB timezone
3. Ensure no more than 3 NBA matches in D+1 range
4. Check cache file: `data/api_fetch.json`

### Predictions not visible after match finishes

1. Verify match status is "FT" or "Final" in live data
2. Call finish-match endpoint to save to history
3. Check `data/nba_history.json` for the match entry
4. Reload page - frontend caches status

## Integration with Existing System

- **Raffle**: Auto-predictions count as purchases for raffle entry (1 per prediction)
- **Treasury**: 20% of prediction cost goes to treasury (existing logic)
- **User Profiles**: Purchase history includes auto-predictions
- **Analytics**: Auto-predictions tracked in analytics dashboard

## Future Enhancements

1. Add multiple auto-predict models (ensemble predictions)
2. Track prediction accuracy statistics
3. Dynamic confidence scoring based on recent accuracy
4. Leaderboard for prediction models
5. Custom prediction window per sport/league
6. Machine learning model integration for better predictions
