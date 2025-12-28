import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
    return (
        <div className="space-y-8 pb-10">
            {/* Header Skeleton */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <Skeleton className="h-10 w-48 mb-2" />
                    <Skeleton className="h-5 w-64" />
                </div>
                <Skeleton className="h-12 w-full sm:w-[500px] rounded-xl" />
            </div>

            {/* Metrics & Charts Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 glass-card rounded-2xl p-6 min-h-[400px]">
                    <div className="flex justify-between mb-6">
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-8 w-32" />
                    </div>
                    <Skeleton className="w-full h-[300px] rounded-xl" />
                </div>

                {/* Alerts & Stats Skeleton */}
                <div className="space-y-6">
                    <Skeleton className="h-[200px] w-full rounded-2xl" />
                    <Skeleton className="h-[200px] w-full rounded-2xl" />
                </div>
            </div>

            {/* Recents Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-2xl h-[400px] p-6">
                    <Skeleton className="h-8 w-40 mb-6" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex justify-between items-center">
                                <div>
                                    <Skeleton className="h-5 w-32 mb-1" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-8 w-20 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glass-card rounded-2xl h-[400px] p-6">
                    <Skeleton className="h-8 w-40 mb-6" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => (
                            <div key={i} className="flex justify-between items-center">
                                <div>
                                    <Skeleton className="h-5 w-32 mb-1" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <Skeleton className="h-8 w-20 rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
