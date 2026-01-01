import { fetchDashboardData, fetchDashboardMetrics } from "@/lib/actions/dashboard";
import { getCurrentUser } from "@/app/actions";
import { DashboardContent } from "@/components/features/DashboardContent";

export async function DashboardAsyncWrapper() {
    // 1. Get current user & context
    const userRes = await getCurrentUser();

    if (!userRes.success || !userRes.data || !userRes.data.currentSocieteId) {
        return <DashboardContent />;
    }

    const userId = userRes.data.id;
    const societeId = userRes.data.currentSocieteId;

    // 2. Parallel Fetch
    const [dashboardRes, metricsRes] = await Promise.all([
        fetchDashboardData(userId, societeId),
        fetchDashboardMetrics(societeId, {
            start: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
            end: new Date()
        })
    ]);

    // 3. Extract Data
    const dashboardData = dashboardRes.success ? dashboardRes.data : null;
    const metricsData = metricsRes.success ? metricsRes.data : null;

    if (!dashboardData) {
        return <DashboardContent />;
    }

    return (
        <DashboardContent
            initialMetrics={metricsData}
            initialRecentInvoices={dashboardData.invoices as any}
            initialRecentQuotes={dashboardData.quotes as any}
            user={dashboardData.user}
            societeId={societeId}
        />
    );
}
