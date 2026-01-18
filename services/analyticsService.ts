import { supabase } from '../supabase';

export interface TableMetric {
    table_id: string;
    table_number: string;
    zone: string;
    total_sessions: number;
    total_revenue: number;
    total_duration_minutes: number;
    avg_duration_minutes: number;
    median_duration_minutes: number;
    revenue_per_minute: number; // RPM
    revenue_per_hour: number; // RPH
    utilization_rate: number; // % of time occupied
    dead_hours: number; // Count of hours with 0 activity
    score: number; // 0-100 Performance Score
    is_camper: boolean; // Flag for potential camper
    reopen_abuse: boolean; // Flag for suspicious quick reopens
    void_count: number; // Count of cancelled/voided orders
}

export const analyticsService = {

    /**
     * Compute full floor analytics for a given time range.
     * Uses Server-Side Aggregation Query pattern (fetching raw data and computing).
     */
    async getFloorMetrics(range: 'today' | 'week' | 'month' = 'today'): Promise<TableMetric[]> {
        const now = new Date();
        const startDate = new Date();

        if (range === 'today') {
            // "Today" now starts 12 hours ago or at 6 AM today to capture the full shift
            const sixAM = new Date();
            sixAM.setHours(6, 0, 0, 0);
            if (now < sixAM) {
                // If it's before 6 AM, show data starting from 6 AM yesterday
                startDate.setDate(now.getDate() - 1);
                startDate.setHours(6, 0, 0, 0);
            } else {
                startDate.setHours(6, 0, 0, 0);
            }
        }
        else if (range === 'week') startDate.setDate(now.getDate() - 7);
        else if (range === 'month') startDate.setDate(now.getDate() - 30);

        const startIso = startDate.toISOString();

        // 1. Fetch Raw Data in Parallel
        const [tablesRes, sessionsRes, ordersRes] = await Promise.all([
            supabase.from('tables').select('id, table_number, zone'),
            supabase.from('table_sessions')
                .select('id, table_id, seated_at, closed_at, is_active')
                .gte('seated_at', startIso),
            supabase.from('orders')
                .select('id, table_id, total_amount, created_at, status, waiter_id')
                .gte('created_at', startIso)
        ]);

        if (tablesRes.error) throw tablesRes.error;
        if (sessionsRes.error) throw sessionsRes.error;
        if (ordersRes.error) throw ordersRes.error;

        const tables = tablesRes.data || [];
        const sessions = sessionsRes.data || [];
        const orders = ordersRes.data || [];

        // 2. Aggregate Data per Table
        const metrics: TableMetric[] = tables.map(table => {
            const tableSessions = sessions.filter(s => s.table_id === table.id);
            const tableOrders = orders.filter(o => o.table_id === table.id);

            // A. Duration & Utilization
            let totalDurationMins = 0;
            tableSessions.forEach(s => {
                const start = new Date(s.seated_at).getTime();
                const end = s.closed_at ? new Date(s.closed_at).getTime() : now.getTime();
                totalDurationMins += (end - start) / 60000;
            });

            // Operating window in minutes (for utilization calc)
            const windowMins = (now.getTime() - startDate.getTime()) / 60000;
            const utilization = windowMins > 0 ? (totalDurationMins / windowMins) * 100 : 0;

            // B. Revenue
            const totalRevenue = tableOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);

            // C. RPM (Revenue Per Minute)
            const safeDuration = totalDurationMins < 5 ? 5 : totalDurationMins; // Avoid div by zero
            const rpm = totalRevenue / safeDuration;

            // D. Scoring (Simple Weighted algo)
            // Revenue (50%), Utilization (30%), Turnover (20%)
            const revScore = Math.min(100, (totalRevenue / (range === 'today' ? 5000 : 35000)) * 100);
            const utilScore = Math.min(100, utilization * 1.5);
            const score = Math.round((revScore * 0.6) + (utilScore * 0.4));

            // E. Detection Flags
            // Camper: High duration (> 90m), Low RPM (< 10 ETB/min)
            const avgDuration = tableSessions.length > 0 ? totalDurationMins / tableSessions.length : 0;
            const isCamper = avgDuration > 90 && rpm < 10;

            // Median Calculation
            const durations = tableSessions.map(s => {
                const start = new Date(s.seated_at).getTime();
                const end = s.closed_at ? new Date(s.closed_at).getTime() : now.getTime();
                return (end - start) / 60000;
            }).sort((a, b) => a - b);
            const medianDuration = durations.length > 0
                ? durations[Math.floor(durations.length / 2)]
                : 0;

            // F. Void Activity
            const voidOrders = tableOrders.filter(o => o.status === 'cancelled' || o.status === 'voided');
            const voidCount = voidOrders.length;

            // G. Reopen Abuse Detection
            // Pattern: Table paid/closed, then new session started < 10 mins later for small amount or by same waiter
            let reopenAbuseDetected = false;
            if (tableSessions.length > 1) {
                const sortedSessions = [...tableSessions].sort((a, b) => new Date(a.seated_at).getTime() - new Date(b.seated_at).getTime());
                for (let i = 1; i < sortedSessions.length; i++) {
                    const prevSession = sortedSessions[i - 1];
                    const currSession = sortedSessions[i];
                    if (prevSession.closed_at) {
                        const gapMs = new Date(currSession.seated_at).getTime() - new Date(prevSession.closed_at).getTime();
                        const gapMins = gapMs / 60000;
                        if (gapMins > 0 && gapMins < 10) {
                            reopenAbuseDetected = true;
                            break;
                        }
                    }
                }
            }

            // F. Dead Hours Calculation (Hours with no activity)
            // We check each hour of the operating window
            let deadHoursCount = 0;
            const currentHour = new Date(startDate);
            while (currentHour < now) {
                const hourStart = currentHour.getTime();
                const hourEnd = hourStart + 3600000; // +1 hour

                // Check if any session overlaps this hour
                const hasActivity = tableSessions.some(s => {
                    const sStart = new Date(s.seated_at).getTime();
                    const sEnd = s.closed_at ? new Date(s.closed_at).getTime() : now.getTime();
                    return sStart < hourEnd && sEnd > hourStart;
                });

                if (!hasActivity) deadHoursCount++;
                currentHour.setHours(currentHour.getHours() + 1);
            }

            return {
                table_id: table.id,
                table_number: table.table_number,
                zone: table.zone || 'Indoor',
                total_sessions: tableSessions.length,
                total_revenue: totalRevenue,
                total_duration_minutes: Math.round(totalDurationMins),
                avg_duration_minutes: Math.round(avgDuration),
                median_duration_minutes: Math.round(medianDuration),
                revenue_per_minute: parseFloat(rpm.toFixed(2)),
                revenue_per_hour: parseFloat((rpm * 60).toFixed(2)),
                utilization_rate: Math.round(utilization),
                dead_hours: deadHoursCount,
                score,
                is_camper: isCamper,
                reopen_abuse: reopenAbuseDetected,
                void_count: voidCount
            };
        });

        return metrics.sort((a, b) => b.score - a.score);
    },

    /**
     * Get aggregated Dead Hours (hours where no table was active)
     */
    getHeatmapData: async () => {
        // Placeholder for heatmap logic
        return [];
    }
};
