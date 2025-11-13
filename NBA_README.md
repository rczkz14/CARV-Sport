# CARV Prediction Market - NBA Implementation

## 🎯 Project Overview

CARV Prediction Market is a **sports prediction platform** built on Solana blockchain. Users can purchase AI-generated sports predictions and participate in daily raffles. This document covers the **NBA prediction market implementation**.

---

## 🏀 NBA Prediction Market

A complete automated system for NBA predictions with:
- **D+1 Match Display**: Shows only next-day matches (max 3) during 13:00-04:00 WIB window
- **Auto-Predict**: Generates predictions daily at 12:00 WIB (1 hour before window opens)
- **Winner-Only Logic**: NBA predictions include only winning team (no draws)
- **Persistent History**: Accumulates all finished matches with results
- **Locked Until Finish**: Predictions hidden until match reaches FT (Final) status

### Key Dates & Times

| Event | WIB | UTC |
|-------|-----|-----|
| Auto-Predict Trigger | 12:00 | 05:00 |
| Window Opens | 13:00 | 06:00 |
| Window Closes | 04:00 (D+1) | 21:00 (D) |

---

## 📁 Project Structure

```
.
├── app/
│   ├── api/
│   │   ├── worker/
│   │   │   ├── auto-predict-nba/       ✨ Auto-prediction endpoint
│   │   │   ├── finish-match/           ✨ Result saving endpoint
│   │   │   └── ...
│   │   ├── matches/route.ts            🔄 D+1 match filtering
│   │   └── ...
│   ├── page.tsx                        🔄 UI with prediction locks
│   └── ...
├── lib/
│   ├── nbaWindowManager.ts             ✨ Window calculations
│   ├── predictionGenerator.ts          🔄 NBA prediction logic
│   ├── nbaScoresAPI.ts
│   └── ...
├── data/
│   ├── nba_history.json                📊 All finished matches
│   ├── raffle-{eventId}.json           🎲 Individual predictions
│   └── api_fetch.json
├── scripts/
│   ├── test-nba-system.js              ✨ Comprehensive tests
│   └── ...
├── NBA_IMPLEMENTATION.md                📖 Technical documentation
├── SETUP_GUIDE.md                       📖 Deployment guide
├── IMPLEMENTATION_SUMMARY.md            📖 Full feature summary
├── QUICK_REFERENCE.md                   📖 Quick commands
└── package.json
```

✨ = New File  |  🔄 = Modified File  |  📖 = Documentation

---

## 🚀 Quick Start

### 1. Environment Setup
```bash
# Create .env.local
echo "WORKER_API_KEY=your-secret-key" >> .env.local
```

### 2. Run Tests
```bash
npm run test:nba
# or with API key
npm run test:nba:with-key -- your-secret-key
```

### 3. Start Development
```bash
npm run dev
# Open http://localhost:3000
```

### 4. Trigger Auto-Predict (Manual)
```bash
curl -X GET "http://localhost:3000/api/worker/auto-predict-nba" \
  -H "Authorization: Bearer your-secret-key"
```

---

## 📊 System Architecture

### Data Flow

```
ESPN/Live Data
    ↓
Data Cache (api_fetch.json)
    ↓
    ├─→ Match Filtering → D+1 NBA Matches (max 3)
    │
    ├─→ Matches Tab (UI)
    │   ├─ During Window: Show buyable matches
    │   └─ After Finish: Move to History
    │
    └─→ Auto-Predict (12:00 WIB)
        ├─ Generate predictions (winner-only)
        └─ Save to raffle-{eventId}.json
            ↓
        Finish Match (when FT status)
            ├─ Compare prediction vs actual
            ├─ Calculate accuracy
            └─ Save to nba_history.json
                ↓
            Status & History Tab (UI)
                └─ All finished matches accumulate
```

### API Endpoints

#### 1. Auto-Predict NBA
```
GET /api/worker/auto-predict-nba
Authorization: Bearer {WORKER_API_KEY}

Triggers at: 12:00 WIB (05:00 UTC)
Generates: Predictions for all D+1 NBA matches (max 3)
Returns: { ok, generatedCount, matches }
```

#### 2. Finish Match
```
POST /api/worker/finish-match
Authorization: Bearer {WORKER_API_KEY}

Saves: Finished match to nba_history.json
Includes: Prediction + actual result + accuracy

Or GET version checks and auto-saves all finished matches
```

#### 3. Matches API (Updated)
```
GET /api/matches
Returns: D+1 NBA matches only (max 3) during window
Uses: filterNBAMatchesToD1() from nbaWindowManager
```

---

## 🔐 Security

- **API Key Protection**: All worker endpoints require `Authorization: Bearer {KEY}`
- **Immutable Predictions**: Once generated, predictions cannot be modified
- **Timestamped Records**: All changes recorded with UTC timestamps
- **No Client Access**: API key never exposed to frontend

**Environment Variable:**
```env
WORKER_API_KEY=your-very-secure-random-string-here
```

---

## 📝 Documentation Files

### Quick References
- **QUICK_REFERENCE.md** - Fast lookup commands and timings
- **IMPLEMENTATION_SUMMARY.md** - Feature-by-feature breakdown

### Detailed Guides
- **NBA_IMPLEMENTATION.md** - Complete technical documentation
- **SETUP_GUIDE.md** - Deployment and scheduler setup

### Code
- **lib/nbaWindowManager.ts** - Window and filtering functions
- **app/api/worker/auto-predict-nba/route.ts** - Auto-predict logic
- **app/api/worker/finish-match/route.ts** - Result saving logic
- **lib/predictionGenerator.ts** - Prediction generation

---

## 🧪 Testing

### Run All Tests
```bash
npm run test:nba
```

### What Gets Tested
✅ Window Manager calculations (WIB/UTC conversion)  
✅ D+1 match filtering (date range, max 3)  
✅ Auto-predict API endpoint  
✅ Finish-match API endpoint  
✅ Data file integrity  
✅ Time calculations for schedulers  

### Manual Testing

```bash
# Test auto-predict
curl -X GET http://localhost:3000/api/worker/auto-predict-nba \
  -H "Authorization: Bearer test-key"

# Test finish match
curl -X POST http://localhost:3000/api/worker/finish-match \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "test123",
    "home": "Lakers",
    "away": "Celtics",
    "homeScore": 110,
    "awayScore": 105,
    "status": "FT"
  }'

# Check predictions created
ls data/raffle-*.json

# Check history
cat data/nba_history.json | jq '.matches | length'
```

---

## 🔧 Configuration

### Package.json Scripts
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "...",
    "test:nba": "node scripts/test-nba-system.js",
    "test:nba:with-key": "node scripts/test-nba-system.js --api-key {key}"
  }
}
```

### Environment Variables
```env
# Required
WORKER_API_KEY=your-secure-key

# Optional (defaults provided)
NEXT_PUBLIC_CARV_RPC=https://rpc.testnet.carv.io/rpc
NEXT_PUBLIC_TREASURY_PUBKEY=5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA
```

---

## 🚢 Deployment

### For Vercel
1. Push code to GitHub
2. Add environment variables in Vercel dashboard
3. Deploy with `vercel deploy --prod`
4. Set up GitHub Actions for auto-predict scheduler

### For Self-Hosted
1. Build: `npm run build`
2. Start: `WORKER_API_KEY=key npm start`
3. Set up external cron scheduler

**See SETUP_GUIDE.md for detailed deployment instructions**

---

## 📊 Monitoring

### Check Auto-Predict Status
```bash
# Recently created predictions
ls -ltr data/raffle-*.json | tail -5

# View latest prediction
cat data/raffle-latest.json | jq '.prediction'

# Predictions this week
find data -name 'raffle-*.json' -mtime -7
```

### Check History
```bash
# Total matches in history
cat data/nba_history.json | jq '.matches | length'

# Prediction accuracy
cat data/nba_history.json | jq '[.matches[] | select(.isCorrect==true)] | length' # correct
cat data/nba_history.json | jq '[.matches[] | select(.isCorrect==false)] | length' # incorrect
```

### Check Logs
```bash
# During development
npm run dev 2>&1 | grep -E "\[Auto-Predict\]|\[NBA\]"

# In production, check application logs for:
# [Auto-Predict] - auto-predict logs
# [Finish Match] - finish-match logs
# [Matches API] - D+1 filtering logs
```

---

## 🎯 Key Features Implemented

✅ **D+1 Match Filtering**
- Only shows next calendar day matches in WIB timezone
- Maximum 3 NBA matches per window
- Automatic filtering in `/api/matches`

✅ **Auto-Predict Generation**
- Triggers at 12:00 WIB (05:00 UTC) daily
- Generates for all visible D+1 NBA matches
- Winner-only predictions (no draws)

✅ **Persistent History**
- All finished matches saved to `data/nba_history.json`
- Accumulates from all closed windows
- Includes prediction accuracy tracking

✅ **Prediction Visibility Control**
- Locked until match reaches FT (Final) status
- Visible to all users after match finishes
- UI shows "View Prediction (Locked)" until FT

✅ **Worker APIs**
- Auto-predict endpoint: Generate predictions on demand
- Finish-match endpoint: Save finished match results
- Full authentication with API key

✅ **Comprehensive Testing**
- Test suite with 5+ test categories
- Manual test commands provided
- Data file validation

---

## 📚 Additional Resources

### Internal Documentation
- **NBA_IMPLEMENTATION.md** - Detailed technical specs
- **SETUP_GUIDE.md** - Deployment walkthrough
- **QUICK_REFERENCE.md** - Commands and timings

### External Resources
- Next.js: https://nextjs.org/docs
- Solana: https://docs.solana.com
- CARV: https://carv.io

---

## 🤝 Contributing

When making changes to NBA implementation:

1. Update relevant docs (NBA_IMPLEMENTATION.md)
2. Run test suite: `npm run test:nba`
3. Test manually with curl commands
4. Update IMPLEMENTATION_SUMMARY.md if major changes

---

## 📞 Support

### Troubleshooting

**Q: Auto-predict not running?**
A: Check `WORKER_API_KEY` in environment, verify cron scheduler is active

**Q: Predictions not visible?**
A: Predictions locked until match status = FT, check match status in live data

**Q: D+1 filtering not working?**
A: Verify match datetime is within D+1 range in WIB, ensure not >3 NBA matches

**Q: History not accumulating?**
A: Call finish-match endpoint when matches reach FT status

### Getting Help
- See QUICK_REFERENCE.md for commands
- See SETUP_GUIDE.md for setup issues
- Check NBA_IMPLEMENTATION.md for technical details
- Search for `[Auto-Predict]` or `[Finish Match]` in logs

---

## 📄 License

This project is part of CARV Prediction Market.

---

## 🎉 Summary

The NBA Prediction Market is fully implemented with:
- ✅ Automated daily predictions
- ✅ Smart filtering for D+1 matches
- ✅ Persistent result tracking
- ✅ Complete documentation
- ✅ Full test coverage

**Next Steps:**
1. Review documentation
2. Run tests: `npm run test:nba`
3. Deploy following SETUP_GUIDE.md
4. Set up external scheduler for auto-predict
5. Monitor first few prediction cycles

Good luck! 🚀
