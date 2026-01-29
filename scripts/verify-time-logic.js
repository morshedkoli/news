// scripts/verify-time-logic.js
// This script verifies the logic used in rss-time-utils.ts
// It uses Intl.DateTimeFormat to ensure timezone correctness without external deps.

function isTimeWindowAllowed(now, startTimeStr = "06:00", timezone = "Asia/Dhaka") {
    // 1. Get current time in Target Timezone components
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: 'numeric',
        minute: 'numeric'
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type) => {
        const p = parts.find(p => p.type === type);
        return p ? parseInt(p.value, 10) : 0;
    };

    const currentHour = getPart('hour');
    // Handle 24h edge case (some environments might return 24 for midnight)
    const normalizedHour = (currentHour === 24) ? 0 : currentHour;
    const currentMinute = getPart('minute');

    // 2. Parse required start time
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    // 3. Simple Time Comparison (HH * 60 + MM)
    const currentTotalMinutes = normalizedHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;

    // Formatted strings for logging
    const localTimeStr = `${normalizedHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const startTimeMsg = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    if (currentTotalMinutes < startTotalMinutes) {
        return {
            allowed: false,
            reason: "before_start_time",
            localTime: localTimeStr,
            targetStartTime: startTimeMsg
        };
    }

    return {
        allowed: true,
        localTime: localTimeStr,
        targetStartTime: startTimeMsg
    };
}

console.log("🚀 Verifying Time Logic...");

let passes = 0;
let total = 0;

function runTest(name, nowUTC, startTime, expectedAllowed, description) {
    total++;
    console.log(`\n🧪 TEST: ${name}`);
    console.log(`   Description: ${description}`);
    console.log(`   Input (UTC): ${nowUTC.toISOString()}`);

    const result = isTimeWindowAllowed(nowUTC, startTime, "Asia/Dhaka");

    const passed = result.allowed === expectedAllowed;
    const icon = passed ? "✅" : "❌";

    console.log(`   ${icon} Result: Allowed=${result.allowed} (Expected=${expectedAllowed})`);
    if (!passed) {
        console.error(`      Details: ${JSON.stringify(result)}`);
        console.error(`      Expected: allowed=${expectedAllowed}`);
    } else {
        passes++;
    }
}

// Test 1: It is 8 AM BD Time (02:00 UTC). Start time is 06:00 BD. Should ALLOW.
runTest(
    "After Start Time",
    new Date("2024-01-01T02:00:00Z"),
    "06:00",
    true,
    "02:00 UTC is 08:00 BD"
);

// Test 2: It is 5 AM BD Time (23:00 UTC Previous Day). Start time is 06:00 BD. Should BLOCK.
runTest(
    "Before Start Time",
    new Date("2024-01-01T23:00:00Z"),
    "06:00",
    false,
    "23:00 UTC is 05:00 BD"
);

// Test 3: It is exactly 06:00 BD Time (00:00 UTC). Start time is 06:00 BD. Should ALLOW.
runTest(
    "Exact Start Time",
    new Date("2024-01-01T00:00:00Z"),
    "06:00",
    true,
    "00:00 UTC is 06:00 BD"
);

// Test 4: Check if timezone is actually working (e.g. not using UTC)
// If checking against UTC, 02:00 UTC < 06:00. But in BD it is 08:00 > 06:00.
// So if this allows, matched correctly against BD time, not UTC.
runTest(
    "Timezone Check",
    new Date("2024-01-01T02:00:00Z"),
    "06:00",
    true,
    "02:00 UTC should be allowed in BD (08:00)"
);

console.log(`\n\n📊 Summary: ${passes}/${total} Tests Passed`);

if (passes === total) {
    console.log("✅ All Time Logic Verified!");
    process.exit(0);
} else {
    console.error("❌ Tests Failed");
    process.exit(1);
}
