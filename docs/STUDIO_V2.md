# Studio V2 — operating guide and implementation record

This upgrade extends the existing Studio and `studio_app_state` workspace. Public pages, the six selected wedding photographs, existing authentication and saved records are preserved.

## Jade’s main workflow

1. Add an enquiry in **More · Business Tools → Enquiries**. A successfully emailed website enquiry is also captured here. Open or create its event workspace.
2. Record the wedding, funeral or corporate brief. Add arrangement requirements and choose designs from **Inspiration**. Quantities produce a guide estimate; this is not a formal quote or a stock reservation.
3. Use **Create recipe** on a requirement or inspiration design. The client, event, date, image and quantity carry into **Recipe Builder**. Enter quantities and labour per arrangement. Delivery, setup, supplier and other expenses apply to the whole recipe.
4. **Save as Draft** while designing. **Save as Quote** when priced. Neither action deducts inventory. Templates are draft designs; save the template draft before leaving.
5. Combine the event’s quoted recipes in **Quotation**. Add event charges, internal costs, terms, deposit and payment stages. Present or print the quotation. A saved quotation’s prices remain distinct from the consultation guide estimate.
6. In **Client view**, create a private invitation and send the copied link yourself. The client can browse inspiration, add photographs and preferences, and approve or request changes to their quotation. Manage existing invitations here to revoke access.
7. **Mark as Purchased** after reviewing quantities and shortages. A combined event is purchased together. Available stock is committed exactly once. Shortages require explicit acceptance and appear in supplier requirements.
8. Use **Production** to assign work and advance its status. Completing production records consumption without deducting committed inventory again. Outstanding materials must be received before completing production.
9. Plan delivery, setup and collection; check off the delivery checklist. Reserve hire items for event dates and reconcile good returns, damage and loss.
10. Record payments actually received in **Payments**. This records transactions; it does not charge a card or transfer money. Use invoice status and the event’s printable document as appropriate. Record a refund before cancelling a paid standalone order.
11. Add client notes, documents, anniversaries and follow-ups from the client profile. Calendar and Action centre combine the next scheduled steps.

## Profitability and business intelligence

The shared panel appears in Recipe Builder, quotation, event and purchased-order views. Its default view shows only the customer price, estimated costs and estimated money kept, with a plain-language indicator. **View full breakdown** reveals tax, margins, money flow, pricing advice and the simulator. It covers flowers, packaging, sundries, labour, waste allowance, delivery, installation, collection, supplier charges and other costs; net selling price, output VAT, gross selling price, profit, margin, corporation-tax estimate and projected retained money.

Margin indicators: excellent at 40% or more; acceptable at 30–39.99%; low below 30%; loss making below zero profit. The scenario simulator changes its displayed forecast only, not saved prices, stock or payments. Recipe labour defaults to the actual total hours and rate.

Home shows today’s work, upcoming events, waiting quotes, stock attention and recent clients. Detailed financial reporting remains under **Business Tools → Profit, VAT & tax reports** and reports purchased work only. An accepted combined event replaces its component recipes in revenue, preventing double counting. Rankings cover designs, weddings, customers, categories, low-margin orders and estimated supplier contribution. Wastage and flower performance support date ranges, monthly trends, quantities and cost allocation.

These are management estimates, not statutory accounts. Costs and selling prices are ex VAT; output VAT is shown before recoverable input VAT and adjustments. Projected cash assumes the full sale is collected and listed costs paid; recorded payments are shown separately. Corporation tax uses an editable default of 25% on positive estimated profit; actual liability depends on total taxable profit and reliefs. Gross profit includes the recipe’s waste allowance; logged stock losses are shown separately and deducted in the business estimate. Flower/supplier contribution allocates mixed-design profit by cost, rather than implying individual flower selling prices are recorded.

UK references: https://www.gov.uk/corporation-tax-rates/rates and https://www.gov.uk/guidance/how-to-fill-in-and-submit-your-vat-return-vat-notice-70012

## AI assistance

Pricing insights are deterministic calculations. The Studio assistant uses the existing AI Gateway integration for drafts, explanations and suggestions grounded in the calculated business figures. Outputs, request identity, model and usage are stored for retrieval. It has no mutation or messaging tools. An hourly request allowance bounds normal use.

Photo assistance suggests the main visible flower/material, colour and approximate quantity. It returns uncertainty when items are obscured or mixed. Jade reviews the suggestion in an editable stock/waste draft and confirms separately. AI never sets a purchase cost or changes inventory automatically. Provider availability and account credits still govern whether generation succeeds; failure leaves manual workflows available.

## Data and safety

- Existing recipes remain `quotes` (Draft/Quote) and `jobs` (Purchased); events remain `plans`. Optional `operations` collections hold the connected operational records.
- Available stock is `stemsRemaining`. On hand equals available plus unconsumed commitments. Historical purchases without commitment records are treated as already deducted.
- Server commands validate prices, quantities and state transitions. The database RPC locks the workspace row, checks the exact revision and commits records, stock ledger, audit and idempotency receipt in one transaction.
- Repeated operation IDs cannot apply stock twice. A different payload cannot reuse an operation ID. Conflicts require a refresh instead of overwriting another edit.
- Full-state legacy saves cannot modify purchased jobs, financial collections, reservations or received purchase orders through an alternate path.
- Post-purchase amendments require a reason. Consumed stock cannot simply be returned wholesale. Combined event prices remain on record while recipe cost amendments are audited.
- Private client sessions are separate from owner sessions, bound to a revocable event grant and checked on each request. Server allowlists omit internal costs, consultation notes, documents and other clients. A client session cannot be substituted for an owner session.
- Assets use a private storage bucket; client reads are restricted to their plan’s references and active catalogue images. Owner APIs and audit/AI history require owner authentication.
- The additive migration is `supabase/migrations/20260908093814_studio_v2_transaction_audit_and_client_access.sql`. No business data was rewritten by it.
- RLS without browser policies on the service-only tables is intentional. Browser database roles have no access; authenticated server routes use the existing service credential.

## Verification

Automated tests cover pricing, legacy invoice handling, drafts vs purchases, repeated commands, aggregate stock demand, explicit shortages, production consumption, historical purchases, amendments, combined quotation atomicity, VAT discounts, payment/refund bounds, hire overlap, invoice status and client projection/session separation.

Real Postgres rollback tests verified transaction idempotency, stale-write rejection, negative-stock rollback, audit/ledger uniqueness and role restrictions. The production workspace checksum remained unchanged throughout local testing.

Local HTTP tests against an isolated synthetic database verified: save → purchase → retry → production; invitation → scoped client update → owner isolation → revocation; approved event purchase → payment → invoice; purchase-order receipt → waste; hire reservation → returned/damaged reconciliation. No test clients, invoices, stock or payments were inserted into the live workspace.

Browser tests exercised recipe saving and purchase confirmation, portal invitation, client inspiration quantity estimates, inspiration-to-recipe context, formal quotation and client approval. Phone (390 px) and tablet (768 px) checks confirmed the dashboard, Recipe Builder and client portal fit their viewport. AI provider execution and private-storage uploads require the configured live services and are separate from the isolated fixture tests.

## Future expansion kept explicit

Multiple internal staff identities and detailed staff permissions, automatic recurring fulfilment, direct payment processing, bank reconciliation and statutory tax returns are not presented as active integrations. Recurring schedules currently prepare reviewed recipes manually. Existing original wedding costing plans remain accessible for historical continuity; new work should use linked recipes and formal event quotations. The current single-workspace JSON document is retained deliberately; larger multi-business datasets would need a staged move to per-record queries and pagination.


## Calm Studio UX — September 2026 amendment

Primary navigation is Home, Clients, Weddings & Events, Funerals, Recipe Builder and Inventory. All existing operational modules remain in Business Tools, including the recipe library/templates, diary, production, suppliers, payments, reports, VAT/tax estimates, AI, audit and settings.

Home has five quick actions and focuses on the day's work. Client creation uses the existing customer collection; new wedding/funeral/event actions open the existing event record workflow. No database structures or calculations were changed for this simplification.

Events use eight visible steps: Client → Event Details → Inspiration → Estimate → Recipe → Final Quote → Purchased / Confirmed → Production. Early steps save progress before continuing. Advanced event fields, documents and invitations remain in expandable sections. Recipe Builder keeps the design, image, components, quantities and price in view, with detailed pricing settings collapsed. Saving as Quote still leaves stock untouched; the explicit Purchased confirmation commits it once.

Client View / Presentation Mode opens a full-screen, opaque presentation built from allowlisted client fields. It shows imagery, arrangements, estimates, setup options and saved quote responses. It has no internal price inputs, margins, tax calculations, internal notes or inventory. Escape does not expose the private screen; the explicit Return to private Studio button ends presentation. Client approvals still use the existing private portal.

65 automated tests and production build passed, including client presentation privacy and payment protections. Tablet browser checks verified guided event creation, safe presentation and quote-to-purchase stock behaviour using isolated sample data (13 stems remained after Quote, then 10 after confirming 3). No synthetic business records were inserted in production.

Live AI verification identified an external setup requirement: Vercel AI Gateway currently requires a valid payment card on the team account. The assistant and photo analysis now explain that requirement; deterministic profitability and manual workflows continue to work. The agent did not add a payment card or change billing.
