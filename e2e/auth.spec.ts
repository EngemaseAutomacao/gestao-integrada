import { test, expect } from "@playwright/test";

/**
 * Smoke test: tela de login renderiza e mostra erro genérico
 * para credenciais inválidas (validação anti-enumeração).
 */
test.describe("Login flow", () => {
  test("renders auth page", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel(/usu[áa]rio/i)).toBeVisible();
    await expect(page.getByLabel(/senha/i)).toBeVisible();
  });

  test("shows generic error for invalid credentials", async ({ page }) => {
    await page.goto("/auth");
    await page.getByLabel(/usu[áa]rio/i).fill("usuario.inexistente.xyz");
    await page.getByLabel(/senha/i).fill("senha-errada-123");
    await page.getByRole("button", { name: /acessar|entrar|login/i }).click();

    // Anti-enumeração: mesma mensagem para usuário inexistente vs senha errada.
    await expect(
      page.getByText(/usu[áa]rio ou senha inv[áa]lidos/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});
