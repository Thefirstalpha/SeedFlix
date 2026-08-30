import { Card, CardContent } from './ui/card';
import { Skeleton } from './ui/skeleton';

export function MediaCardSkeleton() {
  return (
    <Card className="overflow-hidden bg-white/5 border-white/10 gap-0">
      <div className="aspect-[2/3] w-full relative overflow-hidden bg-white/5">
        <Skeleton className="w-full h-full bg-white/10" />
      </div>
      <CardContent className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4 bg-white/10" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-3.5 w-12 bg-white/10" />
        </div>
        <div className="flex items-center justify-between pt-1">
          <Skeleton className="h-3.5 w-8 bg-white/10" />
          <Skeleton className="h-5 w-16 rounded-full bg-white/10" />
        </div>
      </CardContent>
    </Card>
  );
}

