# 🕒 Hybrid Cron Setup Guide

Since this project is deployed on the **Vercel Hobby Plan**, internal Cron Jobs are strictly limited to run **once per day**.

To compare:
- **Hobby Plan**: 1 Cron Job / Day (This project is configured to run at 6:00 AM UTC as a fallback).
- **Pro Plan**: Unlimited frequent jobs.

### 🚀 Solution: External Cron
To achieve **10-minute updates** for your news feeds, you must use a free external trigger service.

## Option 1: Cron-Job.org (Recommended)

### Main RSS Processor
1. Sign up at [https://cron-job.org/](https://cron-job.org/) (Free).
2. Create a new "Cron Job".
3. **URL**: `https://<YOUR-PROJECT-URL>.vercel.app/api/cron/rss`
4. **Execution Schedule**: Every 10 minutes.
5. **HTTP Method**: GET
6. **Save**.

### Optional: Webhook Notifications
1. Create a SECOND "Cron Job" for notifications.
2. **URL**: `https://<YOUR-PROJECT-URL>.vercel.app/api/webhooks/cron-job`
3. **HTTP Method**: POST
4. **Execution Schedule**: Same as main job (every 10 minutes)
5. **Webhook**: Enable "Send HTTP request after execution"
6. **Webhook URL**: Point to the same cron-job URL above
7. **Save**.

This service will "ping" your API route every 10 minutes, triggering the RSS processor just like a real server. The webhook endpoint logs execution status for monitoring.

## Option 2: GitHub Actions (Alternative)
If you prefer to keep everything in GitHub, you can enable a scheduled workflow.
Create a file `.github/workflows/cron.yml`:

```yaml
name: RSS Auto-Poster
on:
  schedule:
    - cron: '*/10 * * * *' # Every 10 minutes
    - cron: '0 0 * * *' # Daily cleanup at midnight
jobs:
  rss-cron:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger RSS Processor
        run: |
          curl -X GET "https://<YOUR-PROJECT-URL>.vercel.app/api/cron/rss?force=true"
      - name: Trigger Cleanup (Optional)
        run: |
          curl -X GET "https://<YOUR-PROJECT-URL>.vercel.app/api/cron/cleanup-news"
```

## Option 3: Vercel Cron (Limited to 1/day)
If you upgrade to Vercel Pro, you can use native cron jobs:

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/rss",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/cleanup-news",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## 🗑️ Auto-Cleanup Cron (Optional)

To automatically delete old published news articles after a retention period:

### Setup
1. Create a SECOND cron job at [https://cron-job.org/](https://cron-job.org/)
2. **URL**: `https://<YOUR-PROJECT-URL>.vercel.app/api/cron/cleanup-news`
3. **Execution Schedule**: Daily at 00:00 (midnight UTC)
4. Configure retention days in RSS Settings (default: 20 days, set to 0 to disable)

**Features:**
- Permanently deletes news older than the configured retention period
- Logs all deletions to `system_logs`
- Supports dry-run mode: `?dry=true`
- Configurable via `news_retention_days` in RSS Settings

## Security Note
The API routes `/api/cron/rss` and `/api/cron/cleanup-news` are designed to be **idempotent** and safe.
- They automatically handle **Concurrency Locking** (prevents overlapping runs).
- They respect **Cooldowns** (won't run multiple times if triggered twice).
- They log the source of the trigger (Vercel vs External).

✅ **Verified**: The system is fully ready for this hybrid approach.
