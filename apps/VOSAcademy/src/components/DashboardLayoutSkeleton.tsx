import { Shimmer } from "./ui/Shimmer";
import { Skeleton } from "./ui/skeleton";

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex h-screen">
      <div className="w-64 border-r bg-sidebar relative">
        <Skeleton className="h-16 m-4" />
        <Shimmer className="h-16 m-4 absolute top-0 left-0 right-0" />
        <div className="space-y-2 p-4 relative">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="relative">
              <Skeleton className="h-10 w-full" />
              <Shimmer className="h-10 w-full absolute top-0 left-0" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto relative">
        <Skeleton className="h-16 m-4" />
        <Shimmer className="h-16 m-4 absolute top-0 left-0 right-0" />
        <div className="p-8 space-y-4 relative">
          <div className="relative">
            <Skeleton className="h-32 w-full" />
            <Shimmer className="h-32 w-full absolute top-0 left-0" />
          </div>
          {[...Array(2)].map((_, i) => (
            <div key={i} className="relative">
              <Skeleton className="h-48 w-full" />
              <Shimmer className="h-48 w-full absolute top-0 left-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
