import { SquadCard } from "@/components/team/squad-card";
import { SQUADS } from "@/lib/auth/squads";
import type { ProfileWithSquads } from "@/types";

export function SquadBoard({ members }: { members: ProfileWithSquads[] }) {
  return (
    <div className="card-grid">
      {SQUADS.map((squad) => (
        <SquadCard key={squad} squad={squad} members={members.filter((member) => member.squads.includes(squad))} />
      ))}
    </div>
  );
}
