import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function MediaListItemSkeleton() {
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10">
      <CardContent className="p-3 sm:p-4 flex gap-4 items-start [&:last-child]:pb-3 [&:last-child]:sm:pb-4">
        <div className="w-16 sm:w-20 md:w-24 aspect-[2/3] overflow-hidden rounded-lg bg-white/5 shrink-0">
          <Skeleton className="w-full h-full bg-white/10" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-5 w-1/2 bg-white/10" />
            <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-3.5 w-12 bg-white/10" />
            <Skeleton className="h-3.5 w-10 bg-white/10" />
          </div>
          <div className="space-y-1.5 pt-1">
            <Skeleton className="h-3 w-full bg-white/10" />
            <Skeleton className="h-3 w-4/5 bg-white/10" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

