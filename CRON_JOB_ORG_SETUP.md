# 🕒 Cron-Job.org Quick Setup

This guide walks you through setting up automatic RSS processing and news cleanup with cron-job.org.

## 🚀 Setup in 5 Minutes

### Step 1: Create Account
1. Go to [https://cron-job.org](https://cron-job.org)
2. Sign up for a free account (no credit card required)

### Step 2: Main RSS Processor
1. Click **"Create Cron Job"**
2. **Title**: `RSS Auto-Poster`
3. **URL**: `https://YOUR-DOMAIN.vercel.app/api/cron/rss`
   - Replace `YOUR-DOMAIN` with your actual Vercel domain
4. **Execution Schedule**: Every 10 minutes
5. **HTTP Method**: GET
6. **Save**

### Step 3: Optional Cleanup Job (Recommended)
1. Click **"Create another Cron Job"**
2. **Title**: `News Cleanup`
3. **URL**: `https://YOUR-DOMAIN.vercel.app/api/cron/cleanup-news`
4. **Execution Schedule**: Daily at 00:00 (midnight UTC)
5. **HTTP Method**: GET
6. **Save**

### Step 4: Optional Webhook Monitoring
1. Click **"Create another Cron Job"**
2. **Title**: `RSS Webhook Monitor`
3. **URL**: `https://YOUR-DOMAIN.vercel.app/api/webhooks/cron-job`
4. **HTTP Method**: POST
5. **Webhook**: Enable "Send HTTP request after execution"
6. **Save**

## ⚙️ Configuration

### Your RSS Settings
- Go to your app → RSS Management → Settings
- Adjust **News Retention (Days)** for cleanup job
- Recommended: **20 days** (default, set to 0 to disable)
- Quality scores: 55/35 (already optimized for steady posting)

### What Each Job Does
- **Main Processor**: Fetches RSS, AI processes, publishes 1+ articles
- **Cleanup Job**: Deletes news older than retention period (permanent)
- **Webhook Monitor**: Logs execution status for debugging

## 🔧 Testing

### Test without waiting 10 minutes:
```bash
# Test RSS processor
curl "https://YOUR-DOMAIN.vercel.app/api/cron/rss?force=true"

# Test cleanup (dry run)
curl "https://YOUR-DOMAIN.vercel.app/api/cron/cleanup-news?dry=true"
```

## ⏱️ Timing Recommendations

| Job | Schedule | Purpose |
|-----|-----------|---------|
| Main Processor | Every 10 minutes | Posts new RSS articles |
| Cleanup Job | Daily at 00:00 | Deletes old news |
| Webhook Monitor | Every 10 minutes | Logs execution |

## 📊 Monitoring

1. **App Dashboard**: `/analytics` → View Quality Metrics
2. **RSS Management**: `/rss-management` → Feed health & logs
3. **Cron-Job.org**: View execution history and success rates

## ✅ Verification Checklist

- [ ] Replace `YOUR-DOMAIN` with actual Vercel URL
- [ ] Create Main RSS Processor job (10 min interval)
- [ ] Create Cleanup job (daily, optional)
- [ ] Create Webhook Monitor (optional)
- [ ] Test with manual curl commands
- [ ] Verify articles appear in your news feed
- [ ] Check Analytics Quality Metrics after 1 hour

## 🔒 Security

Your cron endpoints are protected:
- Optional `CRON_SECRET` via query parameter
- cron-job.org user-agent verification
- Concurrency locks prevent overlapping runs

## 🎯 Expected Results

After setup, you should see:
- 1+ new articles every 10 minutes during active hours (6AM-12AM)
- Automatic cleanup of articles older than 20 days
- Quality metrics in Analytics dashboard
- Consistent posting without manual intervention

---

**Need help?** Check your app logs or visit the Analytics dashboard for real-time status.