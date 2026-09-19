# Public website editorial redesign

## Audit
Next App Router homepage, public anchor navigation and /api/enquiry; /studio is the existing private staff app and must retain its route. /client is an invitation-only customer experience. Existing site has no confirmed public social profile URLs or published booking terms. Do not invent either.

The email enquiry handler validates requests and stores delivered enquiries in the existing Studio lead workflow. Preserve this integration and its failure handling. Existing page metadata, sitemap and robots remain the SEO foundation.

## Genuine image selection
Use the supplied ceremony, bridal-party, flower-girl, pedestal-detail, sunlit flowers and process photographs, plus existing wedding-02, studio-work-2, studio-work-4, studio-consultations and sympathy images. Keep all previously supplied wedding images accessible on the wedding portfolio, rather than putting the whole archive on Home. Do not use the generated reference or invent corporate portfolio photographs.

The ceremony asset is portrait; use a deliberate portrait editorial hero so the couple and both arrangements remain intact. Corporate uses a designed botanical-green text panel until genuine corporate work is supplied.

## Implementation
1. Public-only tokens, typography, image frames, header/footer. No private navigation.
2. Homepage: portrait hero, quiet floral introduction, four services, asymmetrical wedding story, studio process, Client Studio invitation, sympathy/corporate/delivery, enquiry.
3. Verify homepage desktop/tablet/mobile before extending the same system to service pages and public consultation entry.
4. Preserve /studio staff route; public story lives at /our-studio. Preserve old homepage anchors. Public consultation entry routes new visitors into an occasion-specific enquiry; existing invited clients continue at /client. Do not advertise a self-serve planning journey that is not yet available.
5. Verify image loading, keyboard menu, form occasion selection, route metadata, build and existing tests. No real test enquiries sent.

## Implemented

- Editorial homepage, authentic portfolio, shared public header/footer and restrained cream/green/wine design tokens.
- Dedicated weddings, funerals, corporate, everyday flowers, studio story, contact and Client Studio entry pages. The existing private `/studio` and `/client` remain separate.
- Service-specific enquiry selection flows through to the existing enquiry integration.
- Client reviews: private Studio invitation manager, 90-day single-use links, explicit publication consent, immediate public display, hide/republish and invitation withdrawal. Invitation hashes and private references are server-only. All ratings are accepted.
- Reviews have no fabricated seed content. Corporate presentation is typographic until verified corporate photography is supplied.
- Added page metadata, canonical routes, sitemap entries and accurate organisation metadata using genuine branding.

## Verification

- Production build and 70 tests pass.
- Desktop, tablet and mobile browser checks; mobile menu, occasion-specific enquiry, image loading and overflow checked.
- Review browser flow tested against an isolated local database fixture: create invitation, submit consented review, homepage publication and hiding. Duplicate submission returns 409; unauthenticated management returns 401.
- Real database RLS/grants verified: anonymous read and authenticated update denied; server update permitted. Transactional submission/duplicate/consent checks pass and roll back, leaving no sample reviews in production.
- No enquiry email or review invitation was sent to any client during testing.
