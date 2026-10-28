import { describe, expect, it } from "vitest";
import { dateRange } from "../routes/shared.js";
import { splitTags } from "../services/toolCheckouts.js";
import { isAllowedPushEndpoint } from "./push.js";
import { isSafeStoragePath } from "./storage.js";

describe("isSafeStoragePath", () => {
  it("aceita paths gerados pelo app", () => {
    expect(isSafeStoragePath("veiculos/saidas/2026-05-01/strada_20260501_front_out_ab12cd34.jpg")).toBe(true);
  });
  it("rejeita travessia de diretório e caminhos absolutos", () => {
    expect(isSafeStoragePath("../etc/passwd")).toBe(false);
    expect(isSafeStoragePath("/etc/passwd")).toBe(false);
    expect(isSafeStoragePath("veiculos\\x.jpg")).toBe(false);
    expect(isSafeStoragePath("")).toBe(false);
  });
});

describe("dateRange", () => {
  it("data final sem hora inclui o dia inteiro (horário de Brasília)", () => {
    const r = dateRange("2026-05-01", "2026-05-08");
    expect(r?.gte?.toISOString()).toBe("2026-05-01T03:00:00.000Z");
    expect(r?.lte?.toISOString()).toBe("2026-05-09T02:59:59.999Z");
  });
  it("sem filtros retorna undefined", () => {
    expect(dateRange()).toBeUndefined();
  });
});

describe("splitTags", () => {
  it("separa e limpa as TAGs", () => {
    expect(splitTags(" F1, F2 ,,F3")).toEqual(["F1", "F2", "F3"]);
    expect(splitTags(null)).toEqual([]);
  });
});

describe("isAllowedPushEndpoint", () => {
  it("aceita serviços de push conhecidos e recusa o resto", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/xyz")).toBe(true);
    expect(isAllowedPushEndpoint("https://evil.example.com/push")).toBe(false);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
  });
});
