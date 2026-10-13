"use client";

import { ErrorScreen } from "@/components/errors/error-screen";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen error={error} reset={reset} title="Algo deu errado." description="Não foi possível carregar esta página. Tente novamente." />;
}
