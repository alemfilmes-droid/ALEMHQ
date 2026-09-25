"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteEntryDialog } from "@/features/time-tracking/components/delete-entry-dialog";
import { EntryDialog } from "@/features/time-tracking/components/entry-dialog";
import type { TimeEntry } from "@/types";

export function EntryRowActions({ entry }: { entry: TimeEntry }) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <div className="ml-auto flex items-center gap-1">
      <EntryDialog
        mode="edit"
        entry={entry}
        trigger={
          <Button variant="ghost" size="icon" className="size-8" aria-label="Editar lançamento">
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        }
      />
      <Button variant="ghost" size="icon" className="size-8" aria-label="Remover lançamento" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="size-3.5" aria-hidden />
      </Button>
      <DeleteEntryDialog open={deleteOpen} onOpenChange={setDeleteOpen} entryId={entry.id} />
    </div>
  );
}
