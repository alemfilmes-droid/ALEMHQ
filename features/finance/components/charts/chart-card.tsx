import type { ReactNode } from "react";
import { PrivacyCardToggle } from "@/components/privacy/privacy-mode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ChartCard({ title, note, children, titleId }: { title: string; note?: string; children: ReactNode; titleId?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle id={titleId} className="scroll-mt-4">
            {title}
          </CardTitle>
          <PrivacyCardToggle className="-mr-1 -mt-0.5" />
        </div>
        {note ? <p className="text-xs text-subtle">{note}</p> : null}
      </CardHeader>
      <CardContent className="h-80 pt-2">{children}</CardContent>
    </Card>
  );
}
