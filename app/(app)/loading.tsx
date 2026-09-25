import { Skeleton } from "@/components/ui/skeleton";

export default function AppLoading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-8">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
