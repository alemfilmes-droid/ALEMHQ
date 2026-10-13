"use client";

import { ErrorScreen } from "@/components/errors/error-screen";

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Não foi possível carregar o projeto."
      description="Tivemos um problema ao abrir esta página. Tente novamente — se persistir, avise a equipe de tecnologia."
    />
  );
}
