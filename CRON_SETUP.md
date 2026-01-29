# 🕒 Hybrid Cron Setup Guide

Since this project is deployed on the **Vercel Hobby Plan**, internal Cron Jobs are strictly limited to run **once per day**.

To compare:
- **Hobby Plan**: 1 Cron Job / Day (This project is configured to run at 6:00 AM UTC as a fallback).
- **Pro Plan**: Unlimited frequent jobs.

### 🚀 Solution: External Cron
To achieve **10-minute updates** for your news feeds, you must use a free external trigger service.

## Option 1: Cron-Job.org (Recommended)
1. Sign up at [https://cron-job.org/](https://cron-job.org/) (Free).
2. Create a new "Cron Job".
3. **URL**: `https://<YOUR-PROJECT-URL>.vercel.app/api/cron/rss`
4. **Execution Schedule**: Every 10 minutes.
5. **Save**.
   
This service will "ping" your API route every 10 minutes, triggering the RSS processor just like a real server.

## Option 2: GitHub Actions
If you prefer to keep everything in GitHub, you can enable a scheduled workflow.
Create a file `.github/workflows/cron.yml`:

```yaml
name: Trigger RSS Cron
on:
  schedule:
    - cron: '*/10 * * * *' # Every 10 minutes
jobs:
  cron:
    runs-on: ubuntu-latest
    steps:
      - name: Call API
        run: curl -X GET https://<YOUR-PROJECT-URL>.vercel.app/api/cron/rss
```

## Security Note
The API route `/api/cron/rss` is designed to be **idempotent** and safe.
- It automatically handles **Concurrency Locking** (prevents overlapping runs).
- It respects **Cooldowns** (won't run multiple times if triggered twice).
- It logs the source of the trigger (Vercel vs External).

✅ **Verified**: The system is fully ready for this hybrid approach.
