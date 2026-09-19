# Bramble & Petal — approved editorial redesign

## Audit, 19 September 2026
- Existing Next App Router application; preserve all existing routes and operational logic.
- /studio uses a signed, server-checked owner session. /client uses a separate invitation grant, expiry and revocation checks. Public website remains independent.
- Supabase studio_app_state is the existing shared source of truth. Versioned commits and command receipts prevent stale writes and duplicate stock changes. Private access/audit/inventory transaction tables support this state. No schema migration is required for the first phases.
- Client selections already persist to plans and are visible in Business Studio. Client API explicitly projects allowed fields; business notes, wholesale costs, stock and profitability must remain private.
- Existing recipe Draft/Quote/Purchased transitions, invoice import, finance, calendar, production, deliveries, recurring flowers, events and customer records must be retained.
- UX gaps: horizontal operational navigation, text-heavy home, long consultation form, only Wedding/Funeral/Corporate in assisted client planning, no guided customer journey for recurring clients. Event workspace already has guided planning, recipe/quote links and private presentation.

## Progressive implementation
1. Shared editorial tokens/components, genuine bicycle logo and supplied photos; owner-only mode switch; grouped sidebar and mobile navigation. Keep all existing modules reachable.
2. Home: real scheduled work, actionable priorities, upcoming events, task completion, stock alerts and quick actions. No invented client records, totals or preparation percentages.
3. Event workspace by occasion, then visual recipe builder, inventory/waste and calendar.
4. Guided Client Studio consultation architecture using the SAME plan/customer records; dedicated wedding/funeral/corporate/recurring journeys. Extend existing validation additively only where needed.
5. Editorial moodboard/proposals, supplier/invoice/finance refinement, mobile completion.

## Verification gates
Build/typecheck; existing workflow tests; isolated fixture checks of Business and Client interfaces; desktop/tablet/mobile visual checks; authenticated client data projection; quote saves do not deduct stock. Publish only tested increments. Do not use production client records as test fixtures.

## Assets
Seven unique September photographs added to the public wedding gallery, preserving six earlier images. The clean ceremony photograph replaces its duplicate phone screenshot. Published commit 1ec00a1, Vercel production READY.

## First increment completed locally
- Editorial design-system components, signed-in Studio gateway, photograph-led login, grouped Business sidebar and shared owner-only mode switch.
- Mobile Home / Calendar / Create / Clients / More navigation and accessible quick-action dialog.
- Home uses live records for monthly events, seven-day deliveries, priorities, persisted task completion, diary, event hero and stock alerts.
- Invited Client Studio receives the same genuine branding and photographic welcome, without exposing Business navigation.
- Existing Client Studio save verified against isolated database fixture: client and event created once with palette and requirements; inventory unchanged. Task completion persisted. 65 existing tests pass; production build passes; desktop, 768px tablet and 390px phone checked; browser error log clean.
- Remaining phases: event workspace overhaul, recipe/inventory/calendar refinement, guided occasion-specific consultations (including recurring), editorial proposals and later module refinements. Existing functionality remains accessible meanwhile.
