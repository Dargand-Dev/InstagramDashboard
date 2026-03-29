import { Skeleton } from '@/components/ui/skeleton'

export default function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Skeleton className="h-7 w-48 bg-[#111111]" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 bg-[#111111] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 bg-[#111111] rounded-xl" />
      <Skeleton className="h-48 bg-[#111111] rounded-xl" />
    </div>
  )
}
