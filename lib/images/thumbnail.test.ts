import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isStorageImage, thumbnailSource } from "@/lib/images/thumbnail";

const SUPABASE = "https://abcd.supabase.co";
const AVATAR = `${SUPABASE}/storage/v1/object/public/avatars/u1/avatar.jpg?v=1700000000000`;

describe("thumbnailSource", () => {
  it("foto do Storage vai reduzida (96 px, 256 px em tela retina)", () => {
    const result = thumbnailSource(AVATAR, SUPABASE);
    assert.equal(result.src, `/_next/image?url=${encodeURIComponent(AVATAR)}&w=96&q=75`);
    assert.match(result.srcSet ?? "", /w=96&q=75 1x, .*w=256&q=75 2x$/);
  });

  it("imagem de fora do Storage não passa pelo otimizador", () => {
    assert.deepEqual(thumbnailSource("/brand/simbolo_vermelho.png", SUPABASE), { src: "/brand/simbolo_vermelho.png" });
    assert.equal(isStorageImage("https://outro.site/x.png", SUPABASE), false);
  });

  it("aceita a URL do Supabase com barra no fim", () => {
    assert.equal(isStorageImage(AVATAR, `${SUPABASE}/`), true);
  });
});
