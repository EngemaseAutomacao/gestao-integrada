# E2E Tests (Playwright)

Testes end-to-end para fluxos críticos.

## Como rodar

```bash
# Servidor de dev precisa estar rodando em outro terminal
bun run dev

# Em outro terminal:
bunx playwright install chromium   # primeira vez
bunx playwright test                # roda toda a suite
bunx playwright test --ui           # modo interativo
bunx playwright test auth.spec.ts   # arquivo específico
```

## Variáveis de ambiente

| Var | Default | Uso |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:8080` | URL alvo |
| `E2E_USERNAME` | — | usuário para testes autenticados |
| `E2E_PASSWORD` | — | senha do usuário acima |

## Cobertura atual

- `auth.spec.ts` — renderização da tela de login + validação anti-enumeração (erro genérico).

## TODO (prioridade)

- P1 — Fluxo completo: login → saída de ferramenta → devolução.
- P1 — Ponto: clock-in com foto → clock-out.
- P2 — Veículo: checkout com 5 fotos → checkin.
- P2 — Transferência de ativo entre usuários.
