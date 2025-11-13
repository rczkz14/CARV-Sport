# 🏀 NBA Prediction Market - Quick Reference

## What Was Built

A complete automated NBA prediction market system with:
- ✅ D+1 match filtering (max 3 per window)
- ✅ Auto-predict generation at 12:00 WIB
- ✅ Winner-only predictions (no draws)
- ✅ Persistent history storage
- ✅ Locked predictions until FT status
- ✅ Full test suite and documentation

---

## 🔥 Quick Commands

### Test Everything
```bash
node scripts/test-nba-system.js --api-key test-key
```

### Manually Trigger Auto-Predict
```bash
curl -X GET "http://localhost:3000/api/worker/auto-predict-nba" \
  -H "Authorization: Bearer test-key"
```

### Finish a Match
```bash
curl -X POST "http://localhost:3000/api/worker/finish-match" \
  -H "Authorization: Bearer test-key" \
  -H "Content-Type: application/json" \
  -d '{
    "eventId": "match123",
    "home": "Lakers",
    "away": "Celtics",
    "homeScore": 110,
    "awayScore": 105,
    "status": "FT"
  }'
```

### Check History
```bash
cat data/nba_history.json | jq '.matches | length'
```

---

## 📋 File Location Quick Guide

| What | Where |
|------|-------|
| Window logic | `lib/nbaWindowManager.ts` |
| Auto-predict API | `app/api/worker/auto-predict-nba/route.ts` |
| Finish match API | `app/api/worker/finish-match/route.ts` |
| Predictions | `lib/predictionGenerator.ts` |
| Match filtering | `app/api/matches/route.ts` |
| UI prediction lock | `app/page.tsx` |
| Test suite | `scripts/test-nba-system.js` |
| Technical docs | `NBA_IMPLEMENTATION.md` |
| Setup guide | `SETUP_GUIDE.md` |
| Summary | `IMPLEMENTATION_SUMMARY.md` |

---

## 🎯 Timezone Reference

All times in both WIB (Jakarta, UTC+7) and UTC:

| Event | WIB | UTC |
|-------|-----|-----|
| **Auto-Predict** | 12:00 | 05:00 |
| **Window Opens** | 13:00 | 06:00 |
| **Window Closes** | 04:00 (next day) | 21:00 (prev day) |

---

## 🔐 Environment Setup

```env
WORKER_API_KEY=your-secure-key
NEXT_PUBLIC_CARV_RPC=https://rpc.testnet.carv.io/rpc
NEXT_PUBLIC_TREASURY_PUBKEY=5RjkrETpWDnn6bmAod9wRMMo2BKjaTGqZevYW5NM8MBA
```

---

## 🚀 Deployment Essentials

1. **Set API Key**: Add `WORKER_API_KEY` to your hosting provider
2. **Set up Cron**: Call `/api/worker/auto-predict-nba` daily at 05:00 UTC
3. **Set up Check**: Call `/api/worker/finish-match` every 15-30 minutes
4. **Backup**: Daily backup of `data/nba_history.json`
5. **Monitor**: Check logs for `[Auto-Predict]` and `[Finish Match]` messages

---

## 💾 Data Files

```
data/
├── nba_history.json         ← All finished matches (accumulates)
├── raffle-{eventId}.json    ← Individual predictions
└── api_fetch.json           ← Match cache
```

---

## 🧪 Testing Checklist

- [ ] Window Manager tests pass
- [ ] D+1 filtering works (max 3 NBA matches)
- [ ] Auto-predict generates predictions
- [ ] Finish-match saves to history
- [ ] Predictions locked until FT
- [ ] Historical data accumulates

Run: `node scripts/test-nba-system.js`

---

## 📞 Need Help?

- **Technical Details** → Read `NBA_IMPLEMENTATION.md`
- **Setup Questions** → Read `SETUP_GUIDE.md`
- **Implementation Review** → See `IMPLEMENTATION_SUMMARY.md`
- **Code Examples** → Inline comments in source files

---

## ✨ Key Features at a Glance

### For Users
- Buy NBA predictions during 13:00-04:00 WIB window
- Auto-predictions generated at 12:00 WIB
- View predictions only after match finishes (FT)
- See historical matches and results
- Participate in daily raffles

### For Admins
- Automated prediction generation (no manual work)
- Easy deployment (single API key required)
- Flexible scheduling (any cron service)
- Persistent data storage
- Full audit trail (timestamps on all changes)

---

## 🎉 You're All Set!

The NBA prediction market is now fully implemented and ready to:
1. Display D+1 NBA matches
2. Auto-generate predictions
3. Track results
4. Show predictions after matches finish
5. Accumulate history for raffle draws

**Start by running tests:**
```bash
node scripts/test-nba-system.js --api-key test-key
```

**Then deploy following SETUP_GUIDE.md**

Good luck! 🚀
