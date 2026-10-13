import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { errorDetails, requestErrorLog, userContextHeaders } from "@/lib/observability/request-error";

describe("Log de erro rastreável", () => {
  it("erro do banco (Supabase) com rota e papel de quem estava logado", () => {
    const headers = userContextHeaders({ id: "u1", role: "sdr", orgLevel: "executor", squads: ["comercial"] });
    const log = requestErrorLog(
      { code: "42501", message: "permission denied for table deals", details: null, hint: "Grant the required privileges" },
      { path: "/crm?aba=leads", method: "GET", headers },
      { routePath: "/crm", routeType: "render" },
    );
    assert.deepEqual(log, {
      event: "request_error",
      route: "/crm",
      path: "/crm?aba=leads",
      method: "GET",
      routeType: "render",
      user: { id: "u1", role: "sdr", orgLevel: "executor", squads: ["comercial"] },
      name: "object",
      message: "permission denied for table deals",
      code: "42501",
      details: null,
      hint: "Grant the required privileges",
      digest: null,
    });
  });

  it("sem pessoa logada e com Error comum (digest da tela de erro)", () => {
    const error = Object.assign(new Error("Falha ao carregar"), { digest: "123456" });
    const log = requestErrorLog(error, { path: "/login", method: "GET", headers: {} }, {});
    assert.deepEqual(log.user, { id: null, role: null, orgLevel: null, squads: [] });
    assert.equal(log.digest, "123456");
    assert.equal(log.name, "Error");
  });

  it("valor solto vira texto", () => {
    assert.equal(errorDetails("boom").message, "boom");
    assert.equal(errorDetails(null).message, "null");
  });
});
