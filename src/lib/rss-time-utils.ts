/**
 * Checks if the current time is within the allowed start time window in a specific timezone.
 * Uses Intl.DateTimeFormat to avoid external dependencies.
 * 
 * @param now Global current Date object
 * @param startTimeStr Target start time string "HH:MM" (e.g. "06:00")
 * @param timezone Target timezone (default "Asia/Dhaka")
 */
export function isTimeWindowAllowed(
    now: Date,
    startTimeStr: string = "06:00",
    timezone: string = "Asia/Dhaka"
): { allowed: boolean; reason?: string; localTime?: string; targetStartTime?: string } {

    // 1. Get current time in Target Timezone components
    // We use "en-US" locale to ensure 0-23 hour cycle if hour12: false is respected, 
    // but just to be safe we parse numeric parts directly.
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        hour: 'numeric',
        minute: 'numeric'
    });

    // Format returns something like "08:30" or "24:00" (depends on browser/node version)
    // formatToParts is safer.
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => {
        const p = parts.find(p => p.type === type);
        return p ? parseInt(p.value, 10) : 0;
    };

    const currentHour = getPart('hour');
    const currentMinute = getPart('minute');

    // Handle 24h edge case if necessary (Intl sometimes returns 24 for midnight in some locales/versions, 
    // but usually 0-23 with hour12: false)
    const normalizedHour = (currentHour === 24) ? 0 : currentHour;

    // 2. Parse required start time
    const [startHour, startMinute] = startTimeStr.split(':').map(Number);

    // 3. Simple Time Comparison (HH * 60 + MM)
    const currentTotalMinutes = normalizedHour * 60 + currentMinute;
    const startTotalMinutes = startHour * 60 + startMinute;

    // Formatted strings for logging
    const localTimeStr = `${normalizedHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    const startTimeMsg = `${startHour.toString().padStart(2, '0')}:${startMinute.toString().padStart(2, '0')}`;

    // 4. Compare
    // If local current time < local start time, we are too early
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
