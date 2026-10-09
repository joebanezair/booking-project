# Pixel's BookFlow UI/UX, mobile and compliance backlog

**Project:** `joebanezair/booking-project`  
**Branch:** `shadcn-ui`  
**Created:** 2026-10-09  
**Review type:** Initial *static source review* of representative frontend components and current CI workflows. **No live browser, accessibility scanner, device, security, or legal conformance test has been completed.**

## Owner's current requirements (2026-10-09)

- **Color freeze:** Never change the project's existing colors, theme tokens, backgrounds, text colors, borders, hover/focus colors or dark-mode palette. New controls must reuse matching existing colors. Functional and mobile navigation fixes only until the owner explicitly changes this constraint.
- **No feature removal:** Keep every existing capability, route, navigation destination, role gate, interaction and API flow.
- **Priority:** Fully functional mobile navigation, discoverability of every role-permitted page, reliable overlays and responsive touch/keyboard functionality. Preserve desktop behavior.

## Product and design baseline
- **Keep every existing feature:** service, product and business discovery; grid/list toggle; ratings and reviews; public profiles; bookings; product ordering; messaging; admin/business dashboards; auth/roles; notifications; sales and content management.
- **Design direction:** lightweight, minimalist, balanced, mobile-first, recognizable BookFlow branding, clean typographic hierarchy, consistent icon/button sizes, subtle borders, sensible whitespace, and preserved dark-mode support.
- **Implementation reality:** React/Vite, React Icons, hand-written CSS, and local UI primitives. The branch name `shadcn-ui` does not imply the shadcn/ui package or Tailwind is installed.
- **Target:** design for WCAG 2.2 AA; practical comfortable mobile touch targets; clear privacy and data handling; validate real behavior before reporting compliance.

## Completed safe improvements

- **2026-10-09 — Auth layout refined after visual feedback.** Replaced the oversized half-width Sign in / Sign up buttons with compact, text-style mode navigation aligned beside the BookFlow brand in `client/src/pages/AuthPage.jsx`, retaining active-mode identification and keyboard controls. Reduced auth logo dimensions, card padding and responsive header spacing in `client/src/auth-enhancements.css` without editing existing theme variables or introducing new colors. Form submit, registration/login, error handling, password toggle and user redirects stay intact. Commits: `e192f95`, `3a7cf5b`. **Validation:** 9/9 static source assertions passed. **Not yet run:** Vite build, screenshot/browser and device testing. **Do not reintroduce oversized 2-column auth buttons without explicit owner request.**

- **2026-10-09 — Login and sign-up interaction and card polish (owner-requested).** `client/src/pages/AuthPage.jsx` now has clearer Sign in / Sign up mode buttons, full-width primary submit action, labeled/autocomplete-enabled fields, keyboard-operable Show/Hide password, `role="alert"` for server errors, and a submitting state that prevents duplicate login/registration calls and disables mode switches while requests are in progress. Both original API calls, auth token storage, redirect, and `/login` / `/register` routes are retained. `client/src/auth-enhancements.css` (loaded in `client/src/main.jsx` after existing styles) adjusts only card width, button sizing, spacing, typography and mobile layout; no hard-coded colors, palette declarations or existing theme values were changed. Relevant commits: `c3001c7`, `dde5547`, `5c118db`, `bd0d7c7`. **Validation:** 9/9 source-level assertions passed for existing APIs, routes, redirects, accessible toggles and no new color declarations. **Not yet verified:** Full Vite build and live browser, screen reader and mobile responsiveness, because the working runtime could not access GitHub to obtain a complete repository. Test the browser at 320/375/390/768px and both themes; confirm login and registration manually with test accounts.

- **2026-10-09 — Mobile navigation functionality.** `client/src/components/AppLayout.jsx` now provides a role-aware five-slot mobile bottom navigation (Home, business Bookings/admin Businesses, Messages, Search, and More), retains **all** existing role-filtered sidebar destinations in a full-height mobile drawer, closes the drawer on Escape/backdrop/selection, traps focus while open, returns focus to the triggering control on explicit close, disables offscreen drawer keyboard interaction via `inert`, and closes on route/viewport changes. `client/src/mobile-navigation.css` restores the drawer layout previously overridden by a later sticky horizontal rail rule and keeps content above the bottom bar; `client/src/main.jsx` loads this CSS after existing styles. **Color policy:** No existing stylesheet color values or theme tokens changed. The only four explicit colors used for the newly added More button copy values already in the existing bottom-navigation rules, including dark mode. Commits: `4d8f802`, `a637684`, `f8f2b8a`. **Validation:** Static source comparison confirmed the 12 existing drawer routes are retained. GitHub clone/build and physical-browser tests were **not run** because the execution environment could not resolve github.com, and there is no available full local checkout. Verify mobile behavior on device, plus React build/CI, before treating the change as production-tested.


- **2026-10-09 — Search accessible names and selected category state.** Added programmatic names to the search input, category filter and rating select; added `aria-pressed` to Services, Businesses and Products category buttons in `client/src/pages/SearchPage.jsx` (commit `b6fbf5d`). Existing search logic, routing, categories, filters, pagination and card layouts were not intentionally changed. **Validation:** code edit checked for exact targets only; build, automated accessibility and browser testing have **not yet been run**. A later review should consider visible labels and fuller tab semantics.

## Prioritized initial findings and recommendations

| Priority | Area | Source observation / check required | Recommended action | Status |
| --- | --- | --- | --- | --- |
| P0 | Public search accessibility | `client/src/pages/SearchPage.jsx` has search/category inputs and a rating select without associated visible or programmatic labels. Placeholders alone are unreliable names. | Add `label` / `htmlFor` + stable IDs or equivalent accessible names; clarify category and rating filters without changing query behavior. | Source-inspected |
| P0 | Product order modal | `client/src/pages/PublicProfilePage.jsx` renders an order overlay without `role="dialog"` / accessible dialog naming or explicit focus management. | Use a reusable accessible dialog pattern: label, focus entry/trap/return, Escape close, scroll locking; retain order form and submit behavior. | Source-inspected; keyboard testing required |
| P1 | Product details / gallery | These overlays declare `role="dialog"`, but no explicit Escape handling, focus trap or focus restoration appears in this component. | Share the order dialog's accessible focus and dismissal behavior. | Source-inspected; browser confirmation required |
| P1 | Search UX and stale responses | Debounced async search calls in `SearchPage.jsx` have no cancellation or request-sequence check. | Prevent a slower earlier response from replacing newer results; preserve tabs, filters, grid/list, pagination. Add loading and error announcements. | Source-inspected |
| P1 | Mobile navigation | Drawer/bottom bar were implemented with a 2026-10-09 source-level fix; accessibility and layout behaviors still need live verification. | Run real-device / keyboard checks at 320, 375, 390, 768 and 800px, both roles and both themes; fix any remaining issues without color changes. | Implemented in source; browser/build verification pending |
| P1 | Tap targets / rating | `StarRating.jsx` has accessible star names and pressed state; `styles.css` includes very compact star-button padding in one rule and many later overrides. | Measure final computed hit targets and spacing at mobile widths; retain square stars and clear remove-rating action; don't shrink target hitboxes when shrinking icons. | Needs browser measurement |
| P1 | CSS consistency | `client/src/styles.css` is over 7,000 lines with multiple scattered responsive/theme/component rules. | Inventory cascades and progressively consolidate duplicate overrides into existing semantic tokens/components without wholesale rewrite. | Source-inspected |
| P1 | Responsive coverage | Responsive rules exist, but live behavior at 320–390px and 200–400% zoom is unverified. | Test public search, cards, profiles, order/booking forms, dashboard sidebar, charts and tables at 320/375/390/768/1024/1440px; eliminate overflow/clipping. | Needs browser testing |
| P1 | Test/CI coverage | `client/package.json` defines dev/build/preview but no test/lint/a11y scripts; CI workflows use different Node versions (20 and 22). | Add targeted accessibility/component/e2e smoke tests, then align Node/CI; keep current build passing. | Source-inspected |
| P1 | Form validation and status | Dynamic guest ordering, booking and search flows need accessible errors, confirmation states and keyboard submission review. | Associate inline errors with fields (`aria-describedby`, `aria-invalid`), announce status politely, prevent duplicate submissions. | Needs manual/flow review |
| P2 | Design language | Visual tweaks appear across many page-specific classes. | Define spacing, radii, typography, button heights and hover/focus states for cards, chips, filters and actions; avoid unnecessary boxes; preserve light/dark themes. | Proposed |
| P2 | Motion/performance | Images, typing headings, cards and animations need performance, CLS and reduced-motion checks. | Audit image intrinsic dimensions/loading, INP/LCP/CLS, transition timing and `prefers-reduced-motion`; use only purposeful motion. | Needs runtime measurement |

## Privacy, security and compliance review track

1. **Accessibility — WCAG 2.2 AA:** Check labels, keyboard access, headings/landmarks, focus visibility and obscuration, navigation order, overlays, error identification, alt text, color contrast (typically 4.5:1 for normal text and 3:1 for meaningful non-text UI), 24×24 CSS-px AA pointer targets where applicable, reflow, zoom and reduced motion. Prefer ~44px hit areas for important touch controls when feasible. Combine automated checks with manual keyboard and assistive-technology testing.
2. **Privacy transparency:** Verify whether search, customer orders, booking forms, accounts and messages collect personal data; check for conspicuous privacy notices and accurate explanations of purpose, consent or lawful basis, retention, sharing and data-subject rights. Do not imply that a consent checkbox alone creates legal compliance.
3. **Security UX and backend review:** Verify role-appropriate data exposure, authentication/session handling, secure handling of uploaded images, user-generated content, input validation, and least-privilege API access against an applicable OWASP ASVS/Top 10 checklist. Source inspection is not a penetration test.
4. **Philippine regulatory applicability:** If handling personal information of individuals in the Philippines, have the application's practices evaluated against RA 10173 and National Privacy Commission guidance by a qualified professional. Do not claim DPA compliance until verified.
5. **Transparent audit reporting:** Each item must be marked `Source-inspected`, `Reproduced`, `Automated check passed/failed`, `Needs manual test`, or `Needs legal review`. Keep evidence and reproduction steps.

## Test and feature-preservation checklist for every UI PR

- [ ] Routes and role gates preserved for visitor, authenticated user, business and admin.
- [ ] Search services/products/businesses, filtering, grid/list, pagination, and ratings still work.
- [ ] Booking creation/details, ordering, gallery, messages, dashboards and navigation still work in edited flows.
- [ ] Tested desktop + 320/375/390px mobile + tablet; no clipped controls or horizontal scroll.
- [ ] Mouse, touch, keyboard-only and Escape/focus-return flows checked.
- [ ] Light/dark themes, 200% zoom, error/loading/empty states and reduced-motion preferences checked.
- [ ] `cd client && npm ci && npm run build` passes; no test result claimed without execution.
- [ ] Document known blockers, screenshots if taken, accessibility evidence and remaining risk.

## Suggested sequence for Pixel

1. **Public search:** Accessible filters and responsiveness, preserve typing heading + all three tabs + grid/list.
2. **Public profile:** Accessible rating actions; robust details, gallery and order dialogs.
3. **Mobile navigation:** Drawer keyboard experience; ensure every dashboard action remains discoverable.
4. **Core journeys:** Booking and order forms, error/confirmation UX, then dashboards, sales and tables.
5. **Foundation:** Consolidate styles and add automated accessibility, responsiveness and performance checks.

## Reference standards
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/)
- [Philippine National Privacy Commission — RA 10173](https://privacy.gov.ph/data-privacy-act-/)

**Important:** This document is an engineering plan and initial source review, not a WCAG conformance statement, security audit, privacy assurance, or legal opinion.
