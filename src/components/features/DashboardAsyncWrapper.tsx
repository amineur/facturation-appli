import { fetchDashboardData } from "@/app/actions";
import { DashboardContent } from "@/components/features/DashboardContent";

export async function DashboardAsyncWrapper() {
    const { success, data } = await fetchDashboardData();

    if (!success || !data) {
        return <DashboardContent />;
    }

    return (
        <DashboardContent
            initialMetrics={data.metrics}
            initialRecentInvoices={data.recentInvoices}
            initialRecentQuotes={data.recentQuotes}
            user={data.user}
            societeId={data.societeId}
        />
    );
}
