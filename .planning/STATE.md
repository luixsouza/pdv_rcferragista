# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-20)

**Core value:** O lojista gere vendas, crediário e devoluções com valores financeiros corretos (sem haver indevido nem parcelas fantasmas) e imprime documentos completos e legíveis.
**Current focus:** Phase 1 — Fundação e PDF

## Current Position

Phase: 1 of 6 (Fundação e PDF)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-06-20 — Roadmap criado; 26 requisitos v1 mapeados em 6 fases

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| — | — | — | — |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap init: Estorno de crediário com valor pago → diálogo operador (haver ou dinheiro)
- Roadmap init: Devolução para abatimento → operador escolhe a parcela
- Roadmap init: Quantidade fracionada por unidade do produto (mt/kg/lt/m²)
- Roadmap init: NFe/NFCe apenas layout visual; campos fiscais com placeholder seguros
- Roadmap init: Extrair lógica de devolução para `src/lib/processReturn.ts` (FND-02)

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 6 (Layout Fiscal) requer instalação de `bwip-js` (barcode CODE-128) e `qrcode`; verificar compatibilidade com Electron offline antes de iniciar a fase
- Escritas não-transacionais no electron-store: ao mexer em estorno/devolução, manter ordem das mutações e não introduzir estados parciais novos

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Fiscal | Transmissão SEFAZ, cálculo tributário real | v2 | Roadmap init |
| Infra | Escritas transacionais/atômicas no electron-store | v2 | Roadmap init |
| Infra | Testes automatizados para lógica financeira crítica | v2 | Roadmap init |
| POS | Integração com leitor de código de barras | v2 | Roadmap init |

## Session Continuity

Last session: 2026-06-20
Stopped at: Roadmap criado e aprovado; pronto para iniciar planejamento da Fase 1
Resume file: None
