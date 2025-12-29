import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="space-y-8 pb-10">
            {/* Header & Controls Skeleton */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <Skeleton className="h-9 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-10 w-full xl:w-[600px]" />
            </div>

            {/* Chart Section Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Chart */}
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 min-h-[400px]">
                    <Skeleton className="h-6 w-48 mb-6" />
                    <Skeleton className="h-[300px] w-full" />
                </div>

                {/* Alerts Column */}
                <div className="space-y-6">
                    <Skeleton className="h-[150px] w-full rounded-2xl" />
                    <div className="glass-card rounded-2xl p-6 space-y-4">
                        <Skeleton className="h-4 w-32 mb-4" />
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i}>
                                    <Skeleton className="h-3 w-24 mb-2" />
                                    <Skeleton className="h-6 w-16" />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Recent Activity Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map(i => (
                    <div key={i} className="glass-card rounded-2xl overflow-hidden min-h-[300px]">
                        <div className="p-4 px-6 border-b border-white/5">
                            <Skeleton className="h-5 w-40" />
                        </div>
                        <div className="divide-y divide-white/5">
                            {[1, 2, 3].map(j => (
                                <div key={j} className="p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <Skeleton className="h-4 w-32 mb-2" />
                                            <Skeleton className="h-3 w-48" />
                                        </div>
                                        <div className="text-right">
                                            <Skeleton className="h-4 w-20 mb-2" />
                                            <Skeleton className="h-5 w-16" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
