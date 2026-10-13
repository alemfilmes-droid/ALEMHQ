import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WalletAccessError, walletTarget, type WalletViewer } from "@/lib/wallet/access";

const person = (overrides: Partial<WalletViewer>): WalletViewer => ({
  id: "me",
  access_role: "member",
  org_level: "executor",
  squads: ["audiovisual"],
  ...overrides,
}) as WalletViewer;

describe("Carteira: quem lê a Carteira de quem", () => {
  it("colaborador lê a própria Carteira", () => {
    assert.deepEqual(walletTarget(person({}), undefined), { targetId: "me", readsAny: false });
    assert.deepEqual(walletTarget(person({}), "me"), { targetId: "me", readsAny: false });
  });

  it("colaborador não lê a Carteira de outra pessoa", () => {
    assert.throws(() => walletTarget(person({}), "other"), WalletAccessError);
    assert.throws(() => walletTarget(person({ squads: ["comercial"], access_role: "coordinator" }), "other"), WalletAccessError);
  });

  it("master, admin, diretoria e financeiro escolhem qualquer pessoa", () => {
    assert.equal(walletTarget(person({ org_level: "master" }), "other").targetId, "other");
    assert.equal(walletTarget(person({ access_role: "admin" }), "other").targetId, "other");
    assert.equal(walletTarget(person({ squads: ["diretoria"] }), "other").targetId, "other");
    assert.equal(walletTarget(person({ squads: ["financeiro"] }), "other").targetId, "other");
  });
});
