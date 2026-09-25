import { Skeleton } from "@/components/ui/skeleton";

export default function FinanceLoading() {
  return (
    <div role="status" aria-label="Carregando financeiro" className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-16 w-full max-w-md" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-80" />
        ))}
      </div>
      <Skeleton className="h-80 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
