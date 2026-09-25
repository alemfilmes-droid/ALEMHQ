import { Skeleton } from "@/components/ui/skeleton";

export default function BancoDeHorasLoading() {
  return (
    <div role="status" aria-label="Carregando banco de horas" className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-9 w-full max-w-xs" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72 w-full" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
