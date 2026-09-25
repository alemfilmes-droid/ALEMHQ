import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChartCard({ title, note, children, titleId }: { title: string; note?: string; children: ReactNode; titleId?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle id={titleId} className="scroll-mt-4">
          {title}
        </CardTitle>
        {note ? <p className="text-xs text-subtle">{note}</p> : null}
      </CardHeader>
      <CardContent className="h-80 pt-2">{children}</CardContent>
    </Card>
  );
}
