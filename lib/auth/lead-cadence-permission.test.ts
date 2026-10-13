import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canManageLeadCadence } from "@/lib/auth/permissions";
import type { AccessRole, OrgLevel, Squad } from "@/types";

const person = (access_role: AccessRole, org_level: OrgLevel, squads: Squad[], leadSquads: Squad[] = []) => ({ access_role, org_level, squads, leadSquads });

/** Espelha can_manage_lead_cadence() no banco (que confere de novo em cada ação). */
describe("Gerenciar prospecção: quem pode", () => {
  it("CEO (master), admin e Head comercial podem", () => {
    assert.ok(canManageLeadCadence(person("admin", "master", ["diretoria"])));
    assert.ok(canManageLeadCadence(person("admin", "executor", [])));
    assert.ok(canManageLeadCadence(person("member", "head", ["comercial"])));
    assert.ok(canManageLeadCadence(person("sdr", "executor", ["comercial"], ["comercial"])));
  });
  it("SDR, head de outro squad e diretoria sem admin não podem", () => {
    assert.ok(!canManageLeadCadence(person("sdr", "executor", ["comercial"])));
    assert.ok(!canManageLeadCadence(person("bdr", "executor", ["comercial"])));
    assert.ok(!canManageLeadCadence(person("member", "head", ["audiovisual"])));
    assert.ok(!canManageLeadCadence(person("coordinator", "diretoria", ["diretoria"])));
  });
});
