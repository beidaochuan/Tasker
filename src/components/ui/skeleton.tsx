import { cn } from '@/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function ListViewSkeleton() {
  return (
    <div className="flex h-full flex-col p-4 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-8 w-1/3" />
          {[1, 2].map((j) => (
            <Skeleton key={j} className="h-10 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function KanbanSkeleton() {
  return (
    <div className="flex h-full gap-3 overflow-x-auto p-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex w-64 shrink-0 flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-20 w-full" />
          ))}
        </div>
      ))}
    </div>
  )
}
