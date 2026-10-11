# Button and interactive-control code audit — Betta V1

**Branch:** `betta-vone`  
**Date:** 2026-10-11  
**Scope:** The React JSX source of `client/src/App.jsx`, page components, shared UI components, and related button/link handlers. **48 JSX source files** were statically scanned, including files with no buttons. Approximately **191 authored `<button>` / `<Button>` occurrences** were inspected before fixes. Because many are within `.map()` loops and conditional rendering, this is **not** a count of buttons shown at runtime.

**Method:** Reviewed JSX button/link markup, submit-vs-click wiring, event handlers, navigation composition, accessible names, guards for unavailable controls, and state changes/error handling. This was a **source-code audit only**: no interactive browser session, backend database, real-user clicks, keyboard-device run, or production test was executed. Wired handlers **do not establish that corresponding API requests succeed**.

## Area-by-area controls checked

| Area | Buttons and actions reviewed | Code-level result / follow-up |
| --- | --- | --- |
| Authentication | Sign in, register, admin invitation registration, auth-mode switching | Submit handlers present; live authentication and error-state testing required |
| Navigation and dashboard | Mobile menu, close drawer, bottom shortcuts, dashboard action cards | Shared Button's `asChild` is now implemented; links are real links rather than nested link/button controls |
| Business profiles and settings | Cover/profile image menus, repositioning, profile save, business settings | Event handlers and form submissions identified; live permissions/upload tests required |
| Services | Post service, edit, publish/unpublish, delete, grid/list, filtering, image removal | Fixed invalid nested navigation in service cards and Post a service; improved image-remove labels |
| Bookings | Create, edit, reschedule, status transitions, export, history, delete, guest slot selection/request | Submit controls have form handlers; test live booking capacity conflicts and modal keyboard behavior |
| Products and POS | Add/edit/delete products, product actions menu, cart quantity, confirm checkout | Cart +/- now have accessible labels and increment limit; confirm checkout now locks during pending request and shows failure in modal |
| Public products and orders | Product galleries, next/previous, details, place order | Order submission has explicit submit type, in-flight guard, and visible errors without discarding profile |
| Messages | Friend requests, send, load older, share profile, delete/unsend, attachments, menu actions | Errors surfaced for more operations; failed file reads now handled; server/socket/attachment tests still needed |
| Forum | Publish and reply | Reply errors are handled and Reply disabled for empty input; backend moderation/network tests remain |
| Admin | Business pause/reactivate/disable, business directory links | Confirmation handlers identified; test permission enforcement and updates |
| Sales and orders | Export, range filters, chart grouping, order status, manual payment | Event handlers found; verify exports, server validation, modal controls and keyboard focus |
| Ratings and reviews | Star ratings, remove rating, submit verified review | Controls have handlers or submit forms; failed public profile actions now show an inline error |

## Defects fixed in the audit

1. **Nested interactive navigation / broken `asChild` contract.** `client/src/components/ui/button.jsx` previously ignored `asChild`, rendering an actual `<button>` around `<Link>`. Implemented single-child element composition. Corrected service edit/view links in `ContentCard.jsx` and the service creation link in `ContentManagementPage.jsx`.
2. **Unlabeled icon-only cart controls.** Added per-product accessible names to quantity decrease/increase buttons and disabled increment when at available stock.
3. **Service image removal icon without a meaningful label.** Added `aria-label` for each additional-image remove button.
4. **Forum Reply errors silently rejected.** Added error handling, cleared drafts only after successful sending, and disabled Reply for empty text.
5. **Public profile error wiped the page.** Only initial profile load failure now shows the full-page error; rating/friend/order failures show inline messages while retaining the profile and order modal.
6. **Message actions could fail without feedback.** Added error handling for deleting messages/conversations, unsending, accepting/adding friends, sharing profiles, and selecting attachments.
7. **Duplicate POS checkout request risk.** Added an in-flight guard, disabled confirmation button, progress copy, and in-modal error messages.
8. **Duplicate public order submission risk.** Added an in-flight guard, disabled order submission, progress copy, and explicitly declared its submit type.

No feature was intentionally removed and the `shadcn-ui` branch was not changed.

## Items requiring interactive testing / future work

- **Keyboard and focus:** Tab through all dialogs, menus, accessible dropdowns and mobile navigation. Verify Esc closes dialogs appropriately, focus moves into modals and is restored on close, and focus is not trapped behind overlays. Audit includes custom clickable product cards (`<article role="button">`) containing action buttons; consider restructuring to separate native controls to eliminate nested-interactive semantics while preserving layout.
- **Form validation:** Exercise required fields, invalid prices, empty replies, file size/type checks, partial saves, duplicate submissions, and failed networks in browser.
- **API wiring:** Run end-to-end flows with a real main MongoDB and optionally GridFS/RabbitMQ: create/list/edit/delete; credentials/roles; guest booking and slot race handling; messaging delivery and friend/block state; public orders and POS inventory updates.
- **Responsive accessibility:** Confirm icon-only buttons are discoverable by assistive technology at mobile widths and that controls remain targetable with touch/keyboard. Validate colors and focus indicators against WCAG 2.2 AA.
- **Automated E2E:** Add Playwright or equivalent page-object tests and role-based fixtures for public, business, admin and paused/disabled sessions. This static scan is not a substitute for a passing interaction test suite.

## Suggested manual button smoke test

Start the app using [README run instructions](../README.md#run-the-project--betta-v1), sign in with normal business and admin test accounts, and exercise:

1. **Navigation:** Dashboard quick access, Create service, Edit service, View public service, browser back, mobile More/drawer close.
2. **Services/profile:** Add/edit/delete service, publish toggle, upload/remove image, business settings and profile changes.
3. **Booking:** Request guest appointment, confirm/start/complete booking, reschedule, cancel, export booking history; retry invalid/conflicting slots.
4. **POS:** Add product, change cart quantity beyond stock, checkout once while loading, confirm sales record, test backend-error state.
5. **Public orders:** Open gallery, view details, place one order, test server validation failure and verify modal/profile remain usable.
6. **Chat:** Friend invite/accept, send text/file, unsend, delete, share profile, load older, test 4xx/5xx errors.
7. **Admin/sales/forum:** Pause/reactivate/disable, filter/export sales, update order, record payment, publish forum post/reply.
8. **Keyboard:** Repeat with Tab, Enter, Space, Escape and mobile viewport; check labels and focus.

**Status:** Static scan completed and targeted fixes committed. **Runtime pass/fail remains unverified**, and no blanket claim that *every button works* should be made before interactive test execution.
