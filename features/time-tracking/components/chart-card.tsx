import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>{title}</CardTitle>
        {note ? <p className="text-xs text-subtle">{note}</p> : null}
      </CardHeader>
      <CardContent className="h-72 pt-2">{children}</CardContent>
    </Card>
  );
}
