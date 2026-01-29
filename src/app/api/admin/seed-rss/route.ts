import { NextResponse } from 'next/server';
import { dbAdmin } from '@/lib/firebase-admin';
import { RssFeed } from '@/types/rss';

const BANGLA_FEEDS: Omit<RssFeed, 'id' | 'last_fetched_at' | 'last_success_at' | 'consecutive_failures' | 'consecutive_empty_runs'>[] = [
    {
        source_name: "Prothom Alo",
        rss_url: "https://www.prothomalo.com/feed/",
        enabled: true,
        priority: 10,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 30,
        category: 'National'
    },
    {
        source_name: "Jugantor",
        rss_url: "https://www.jugantor.com/feed/rss.xml",
        enabled: true,
        priority: 9,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 30,
        category: 'National'
    },
    {
        source_name: "Kaler Kantho",
        rss_url: "https://www.kalerkantho.com/rss.xml",
        enabled: true,
        priority: 8,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 30,
        category: 'National'
    },
    {
        source_name: "Jagonews24",
        rss_url: "https://www.jagonews24.com/rss/rss.xml",
        enabled: true,
        priority: 8,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 30,
        category: 'National'
    },
    {
        source_name: "BD Pratidin",
        rss_url: "https://bdpratidin.net/rss/latest-posts",
        enabled: true,
        priority: 8,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 30,
        category: 'National'
    },
    {
        source_name: "Amar Bangla",
        rss_url: "https://www.amarbanglabd.com/rss",
        enabled: true,
        priority: 7,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 60, // Slower updates
        category: 'National'
    },
    {
        source_name: "Sun News 24x7",
        rss_url: "https://www.sunnews24x7.com/rss",
        enabled: true,
        priority: 7,
        language: 'bn',
        country: 'BD',
        source_type: 'direct',
        cooldown_minutes: 60,
        category: 'National'
    },
    // AGGREGATOR
    {
        source_name: "Google News (Bangladesh)",
        rss_url: "https://news.google.com/search?q=Bangladesh%20news&hl=bn&gl=BD&ceid=BD:bn&output=rss",
        enabled: true,
        priority: 5, // Fallback priority
        language: 'bn',
        country: 'BD',
        source_type: 'aggregator',
        cooldown_minutes: 120, // Less frequent for aggregator to avoid dupes
        category: 'Aggregator'
    }
];

export async function POST() {
    try {
        const batch = dbAdmin.batch();
        const colRef = dbAdmin.collection('rss_feeds');

        // Fetch existing to avoid nuking stats if we re-seed (upsert logic)
        // Actually, for this task, clean insertion is safer.
        // We will ID them by normalized URL hash or just use a readable ID.
        // Let's use clean slugs.

        let count = 0;

        for (const feed of BANGLA_FEEDS) {
            // Create readable ID
            const id = feed.source_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
            const docRef = colRef.doc(id);

            const exists = (await docRef.get()).exists;

            if (!exists) {
                batch.set(docRef, {
                    ...feed,
                    id: id,
                    name: feed.source_name, // legacy compat
                    url: feed.rss_url, // legacy compat
                    last_fetched_at: null,
                    last_success_at: null,
                    consecutive_failures: 0,
                    consecutive_empty_runs: 0
                });
                count++;
            } else {
                // Determine update strategy: Only update config, keep stats
                batch.update(docRef, {
                    source_name: feed.source_name,
                    rss_url: feed.rss_url,
                    language: feed.language,
                    country: feed.country,
                    source_type: feed.source_type,
                    cooldown_minutes: feed.cooldown_minutes,
                    priority: feed.priority,
                    // Ensure legacy fields sync
                    name: feed.source_name,
                    url: feed.rss_url
                });
            }
        }

        await batch.commit();

        return NextResponse.json({
            success: true,
            message: `Processed ${BANGLA_FEEDS.length} feeds. Seeded ${count} new.`,
            feeds: BANGLA_FEEDS.map(f => f.source_name)
        });

    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
