"use client";

import { ErrorScreen } from "@/components/errors/error-screen";

export default function PautasError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      title="Não foi possível carregar o quadro."
      description="Tivemos um problema ao buscar as pautas. Tente novamente — se persistir, avise a equipe de tecnologia."
    />
  );
}
