# Mirador E2E Tests

## Setup

1. Copy `.env.test.example` to `.env.test` and set `TEST_EMAIL` / `TEST_PASSWORD`.
2. Place the large Excel fixture at `tests/fixtures/cuadro-concurso-2024.xlsx`, or run:

   ```powershell
   .\scripts\setup-e2e.ps1
   ```

   This copies from OneDrive if available: `Cuadro Concurso 2024_CNSC 8-4-2024.xlsx`.

3. Optional: set `FIXTURE_XLSX` in `.env.test` to a custom path.

4. Install browsers: `npx playwright install chromium`

## Run

| Command | Scope |
|---------|--------|
| `npm test` | Full suite (setup + shared + desktop + mobile) |
| `npm run test:core` | Core user flows (desktop + mobile) |
| `npm run test:desktop` | Desktop project only |
| `npm run test:mobile` | Mobile project only |

Expected runtime with the large fixture: **10–20 minutes** for the full suite.

## Coverage map

| Requirement | Spec |
|-------------|------|
| Local / cloud documents | `core.spec.js` tests 1, 1b, 2 |
| Real-time search | `core.spec.js` tests 3, 3b |
| Filters apply/remove | `core.spec.js` test 4 |
| Tab switch table/pills | `core.spec.js` tests 5, 5b |
| F5 reload | `core.spec.js` tests 6, 6b, 6c |
| Sheets/headers from cache | `core.spec.js` tests 9, 9b |
| Mobile table layout | `table-layout.spec.js` |

Cloud tests use real Firebase; `e2e-test-*` uploads are deleted in `afterEach`.
