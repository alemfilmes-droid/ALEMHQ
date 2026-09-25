import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div role="status" aria-label="Carregando equipe" className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-full max-w-lg" />
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-[72px]" />
        ))}
      </div>
    </div>
  );
}
