# NBA Prediction Market - Quick Setup & Deployment Guide

## Quick Start

### 1. Environment Setup

Add to `.env.local` (or your deployment environment):

```env
# Required: API key for worker endpoints
WORKER_API_KEY=your-secure-api-key-here

# Optional: Customize if not using defaults
NEXT_PUBLIC_CARV_RPC=https://rpc.testnet.carv.io/rpc
NEXT_PUBLIC_TREASURY_PUBKEY=5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA
```

### 2. Run Tests

```bash
# Make test script executable
chmod +x scripts/test-nba-system.js

# Run tests
npm run test:nba
# or
node scripts/test-nba-system.js --api-key your-secure-api-key
```

### 3. Set Up Auto-Predict Scheduler

You have several options:

#### Option A: Using External Cron Service (Recommended)

Use services like:
- **GitHub Actions** (free for public repos)
- **AWS EventBridge** (Cloudwatch Events)
- **Google Cloud Scheduler** (free tier available)
- **Azure Logic Apps**
- **External cron service** (EasyCron, etc.)

**Setup (GitHub Actions example):**

Create `.github/workflows/nba-auto-predict.yml`:

```yaml
name: NBA Auto-Predict

on:
  schedule:
    - cron: '0 5 * * *'  # 05:00 UTC daily

jobs:
  auto-predict:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger auto-predict
        run: |
          curl -X GET "${{ secrets.API_URL }}/api/worker/auto-predict-nba" \
            -H "Authorization: Bearer ${{ secrets.WORKER_API_KEY }}"
```

**Setup (AWS EventBridge example):**

```json
{
  "Name": "NBA-Auto-Predict",
  "ScheduleExpression": "cron(0 5 * * ? *)",
  "State": "ENABLED",
  "Targets": [
    {
      "HttpParameters": {
        "HeaderParameters": {
          "Authorization": "Bearer YOUR_API_KEY"
        }
      },
      "RoleArn": "arn:aws:iam::ACCOUNT:role/EventBridgeRole",
      "Arn": "arn:aws:events:region:ACCOUNT:connection/YOUR_CONNECTION",
      "HttpMethod": "GET",
      "PathParameterValues": [],
      "QueryStringParameters": {}
    }
  ]
}
```

#### Option B: Node.js Background Worker (Development Only)

Not recommended for production. Use in development:

```javascript
// lib/scheduler.ts
import { getNextAutoPredictTime } from '@/lib/nbaWindowManager';
import { generatePredictionsForMatches } from '@/lib/predictionGenerator';

let scheduledJob: NodeJS.Timeout | null = null;

export function startNBAScheduler() {
  if (scheduledJob) return; // Already running
  
  const checkAndRun = async () => {
    try {
      console.log('[Scheduler] Checking for auto-predict trigger...');
      const response = await fetch('/api/worker/auto-predict-nba', {
        headers: { 'Authorization': `Bearer ${process.env.WORKER_API_KEY}` },
      });
      const data = await response.json();
      console.log('[Scheduler] Result:', data);
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
    
    // Schedule next check in 1 minute
    scheduledJob = setTimeout(checkAndRun, 60000);
  };
  
  checkAndRun();
}
```

### 4. Finishing Matches

You need to periodically check for finished matches and save them to history.

**Option A: External Scheduler (Recommended)**

Schedule to run every 15-30 minutes:

```bash
curl -X GET "https://your-domain.com/api/worker/finish-match" \
  -H "Authorization: Bearer $WORKER_API_KEY"
```

**Option B: Manual Trigger**

After a match finishes:

```bash
curl -X POST "https://your-domain.com/api/worker/finish-match" \
  -H "Authorization: Bearer $WORKER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "match-id",
    "home": "Lakers",
    "away": "Celtics",
    "homeScore": 110,
    "awayScore": 105,
    "status": "FT"
  }'
```

## Deployment Steps

### For Vercel (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Add NBA prediction market"
   git push
   ```

2. **Add Environment Variables in Vercel Dashboard**
   - Project Settings → Environment Variables
   - Add `WORKER_API_KEY` with secure value
   - Add `NEXT_PUBLIC_CARV_RPC` and `NEXT_PUBLIC_TREASURY_PUBKEY`

3. **Deploy**
   ```bash
   vercel deploy --prod
   ```

4. **Set Up Cron (GitHub Actions)**
   - Create `.github/workflows/nba-auto-predict.yml` (see template above)
   - Add `API_URL` secret pointing to your Vercel deployment
   - Add `WORKER_API_KEY` secret

### For Self-Hosted (Node/Docker)

1. **Build**
   ```bash
   npm run build
   ```

2. **Start**
   ```bash
   WORKER_API_KEY=your-key npm start
   ```

3. **Set Up External Cron**
   - Use any external cron service to call your endpoints daily
   - Ensure endpoints are protected with API key

## Data Directory Structure

After running, you'll have:

```
data/
├── nba_history.json
│   └── Accumulates all finished NBA matches
├── raffle-{eventId}.json
│   └── Individual predictions (auto-generated)
├── api_fetch.json
│   └── Live match cache from ESPN/TheSportsDB
└── ... (other league data)
```

**Backup Strategy:**

```bash
# Backup important files daily
tar -czf backups/nba_$(date +%Y%m%d).tar.gz data/nba_history.json data/raffle-*.json

# Restore from backup
tar -xzf backups/nba_YYYYMMDD.tar.gz
```

## Monitoring & Logging

### Check Auto-Predict Status

```bash
# Check recent predictions
ls -ltr data/raffle-*.json | tail -5

# View latest prediction
cat data/raffle-$(ls -t data/raffle-*.json | head -1 | grep -o '[^/]*$' | cut -d'-' -f2 | cut -d'.' -f1).json
```

### Check History

```bash
# View history file
cat data/nba_history.json | jq '.matches | length'

# See latest match results
cat data/nba_history.json | jq '.matches | sort_by(.savedAt) | reverse | .[0:5]'
```

### Check Logs

```bash
# Tail application logs
npm run dev 2>&1 | grep -E "\[Auto-Predict\]|\[NBA\]|\[Finish Match\]"
```

## Troubleshooting

### Problem: Auto-predict not running at scheduled time

**Solution:**
1. Verify external scheduler is active and calling the endpoint
2. Check `WORKER_API_KEY` environment variable is set correctly
3. Manually test: `curl -X GET http://localhost:3000/api/worker/auto-predict-nba -H "Authorization: Bearer test-key"`
4. Check application logs for errors

### Problem: Predictions not visible after match finishes

**Solution:**
1. Verify match status is "FT" or "Final" in live data
2. Manually call finish-match endpoint
3. Reload browser (clear cache if needed)
4. Check `data/nba_history.json` for the match

### Problem: More than 3 NBA matches showing

**Solution:**
1. Verify D+1 filtering is working: check logs in `/api/matches`
2. Ensure matches are all from same calendar day in WIB timezone
3. Check cache file for old matches: `cat data/api_fetch.json | jq '.nba.daily | length'`
4. Manually filter cache if needed

### Problem: 401 Unauthorized errors on worker endpoints

**Solution:**
1. Verify `WORKER_API_KEY` matches in both `.env` and external scheduler
2. Ensure API key is passed in `Authorization: Bearer YOUR_KEY` header
3. Check for typos or spaces in the key

## Performance Tips

### Optimize Data Files

```bash
# Compress old history entries (keep last 100)
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('data/nba_history.json'));
data.matches = data.matches.slice(-100);
fs.writeFileSync('data/nba_history.json', JSON.stringify(data, null, 2));
"

# Clean old raffle files (older than 30 days)
find data -name 'raffle-*.json' -mtime +30 -delete
```

### Archive Old Data

```bash
# Monthly archive
tar -czf archives/nba_history_$(date +%Y%m).tar.gz data/nba_history.json
cp data/nba_history.json data/nba_history.json.backup
echo '{"matches":[]}' > data/nba_history.json  # Reset for new month
```

## Next Steps

1. ✅ Environment configured
2. ✅ Tests passing
3. ✅ Auto-predict scheduler set up
4. ✅ Finish-match checker running
5. 📊 Monitor predictions accuracy
6. 🔄 Iterate on prediction algorithm
7. 🚀 Add more sports/leagues

See `NBA_IMPLEMENTATION.md` for detailed documentation.
