# AgriBridge — Functional Requirements

**Document status:** Working requirements; several workflows require product approval.  
**Purpose:** Describe what the platform should do, without prematurely prescribing implementation details.

## 1. Requirement conventions

- **MUST:** Required for an approved release.
- **SHOULD:** Strongly preferred; deviations need justification.
- **MAY:** Optional or later capability.
- **PENDING:** A product decision is required before implementation.

Do not convert a PENDING item into a requirement without approval.

## 2. User roles and access

### 2.1 Account types
The product is expected to support:
- Seller
- Buyer
- Logistics partner
- Platform administrator/support operator

**PENDING:** Whether one account can hold multiple business roles, and whether a user can switch roles.

### 2.2 Account lifecycle
The system should support:
- Registration and sign-in.
- Sign-out.
- Account profile creation and editing.
- Password reset or equivalent account recovery.
- Role-specific onboarding.
- Account status and access restrictions.
- Consent and privacy notices where applicable.

**PENDING:** Phone OTP, email verification, identity/business verification, required documents, approval process, and supported authentication providers.

### 2.3 Permissions
Users must only access and modify resources they are authorized to use. Seller, buyer, logistics, and administrator capabilities must be separated. Exact permission matrices are to be specified before implementation.

## 3. Seller capabilities

A seller should be able to:
1. Create a produce offer.
2. Enter produce name/category, quantity, unit, location, availability, and asking terms.
3. Add relevant descriptions and photos.
4. Save a draft, publish, edit, pause, close, or delete an offer subject to business rules.
5. View enquiries and respond.
6. Communicate and negotiate with interested buyers.
7. Review relevant price and logistics-cost information when available.
8. Coordinate agreed fulfilment and view status updates.

**PENDING:** Mandatory fields by crop, lot/batch support, minimum quantity, harvest date, packaging, quality attributes, sample requests, and listing expiry.

## 4. Buyer capabilities

A buyer should be able to:
1. Create a produce requirement.
2. Specify produce/category, quantity, unit, delivery location, needed-by date, and relevant quality/specification details.
3. Discover available offers.
4. Filter and compare offers using meaningful, consistently labelled fields.
5. Contact sellers and negotiate.
6. Review transport quotations and estimated total cost where available.
7. Track coordination status for an agreed transaction.

**PENDING:** Whether buyers can make public requirements, private requests, bulk requests, recurring requirements, or anonymous enquiries.

## 5. Discovery and matching

The platform should support discovery between supply and demand.

Potential matching dimensions:
- Produce/category.
- Quantity and unit compatibility.
- Pickup and delivery locations.
- Availability and required date.
- User-specified quality/specification attributes.
- Commercial terms.

Requirements:
- Explain why a result is shown where matching is automated.
- Do not imply a match is a confirmed order.
- Distinguish exact matches from partial or approximate matches.
- Allow users to refine search/filter criteria.

**PENDING:** Ranking algorithm, geographic radius, partial quantity matching, notification behaviour, and whether AI matching is part of the MVP.

## 6. Enquiries, negotiation, and agreements

The platform is expected to support direct interaction between interested parties.

Potential capabilities:
- Start an enquiry against an offer or requirement.
- Send and receive messages.
- Exchange or revise proposed quantity, price, delivery terms, and dates.
- Retain a timestamped history of proposals and responses.
- Clearly identify when terms are merely proposed versus accepted.

**PENDING:** In-app chat versus contact reveal, attachments, voice notes, read receipts, offer expiry, binding acceptance, cancellation, and what constitutes a platform-recognized agreement.

Do not represent a chat message as a legally binding contract unless the product/legal requirements explicitly define that behaviour.

## 7. AI-assisted capabilities

AI is an exploratory differentiator and must be bounded by evidence and clear user communication.

### 7.1 Image-assisted quality information
Potential workflow:
1. User uploads produce images.
2. System checks whether the image is usable.
3. AI may identify visible characteristics or possible defects.
4. The result is presented as an estimate with limitations.
5. User can review, correct, or disregard the result.

Rules:
- Do not call an AI estimate certified grading.
- Do not claim to detect properties that cannot reliably be inferred from an image.
- Show uncertainty and limitations.
- Do not use the result as the sole basis for rejecting a user or settling a dispute.

**PENDING:** Supported crops, attributes, model/provider, validation dataset, human review, and whether this belongs in MVP.

### 7.2 Other AI assistance
Translation, listing-description assistance, requirement matching, or a conversational assistant may be considered only after a defined use case, evaluation method, cost model, and privacy review are approved.

## 8. Price and charge comparison

The product direction includes helping users compare price and relevant charges.

A comparison may need to distinguish:
- Produce price and unit.
- Quantity.
- Pickup location.
- Transport charge.
- Loading/unloading or handling charges, if applicable.
- Other explicitly disclosed fees.
- Estimated total buyer cost.
- Estimated seller net realization, where sufficient data exists.

Rules:
- Never compare different units without a transparent conversion.
- Show which charges are included and excluded.
- Label user-provided, externally sourced, calculated, and estimated values.
- Show source and last-updated time for external data.
- Do not present stale or unavailable information as live.
- Explain assumptions behind estimated totals.

**PENDING:** Price data providers, mandi/market data coverage, update frequency, calculation formulas, taxes/fees treatment, and whether comparisons are available in the first release.

## 9. Logistics coordination

The platform is expected to help parties coordinate transport.

Potential capabilities:
- A party requests transport for a proposed/agreed movement.
- Logistics partners can provide relevant availability and quotations.
- Parties can compare quotations.
- An authorized party accepts a quote.
- The job records pickup, destination, cargo details, expected timing, and agreed charges.
- Status updates communicate progress.
- Delivery completion can be recorded with supporting evidence.

**PENDING:** Who can create a request, who pays the transporter, vehicle/capacity fields, driver details, GPS tracking, proof-of-pickup, proof-of-delivery, cancellation, damage/loss claims, insurance, and liability.

Never claim real-time GPS tracking unless an actual tracking integration is implemented and functioning.

## 10. Trust, safety, and disputes

The product must be designed to reduce uncertainty and provide accountability.

Potential controls to evaluate:
- Contact and identity verification.
- Business or transporter verification.
- Clear verification badges and their meaning.
- Report/block mechanisms.
- Suspicious activity handling.
- Audit history for important actions.
- Evidence attachment for delivery or complaints.
- Support and dispute intake.

A badge must identify exactly what was checked, by whom, and when. Do not label an account “verified” based on an unverified phone number if users could interpret that as full identity or business verification.

**PENDING:** Verification standards, moderation process, dispute workflow, service-level expectations, and responsibility for resolving disputes.

## 11. Payments and financial flows

Payment handling is a high-impact unresolved product decision.

Do not implement:
- Wallets.
- Escrow or fund holding.
- Payment collection or payout.
- Refund processing.
- Advance-payment protection.
- Platform commissions.

until the payment model, provider, legal/compliance requirements, refund/cancellation rules, and operational responsibilities are approved.

The requirements must explicitly address fraud risks, payment evidence, payment status, and whether the platform ever handles funds.

## 12. Notifications

Potential notification events:
- New relevant enquiry.
- New message or negotiation proposal.
- Offer/requirement status change.
- Transport quote received or accepted.
- Logistics status update.
- Account/security event.

**PENDING:** In-app, email, SMS, WhatsApp, push channels; user preferences; frequency limits; and notification templates.

## 13. Administration

An administrative interface may be required to:
- Review reported content/accounts.
- Manage user access and account status.
- Investigate support requests.
- Review audit events.
- Manage platform configuration and reference data.

**PENDING:** Admin roles, approval powers, data access boundaries, moderation policy, and audit requirements.

## 14. Cross-cutting requirements

- Responsive experience for mobile, tablet, and desktop.
- Clear loading, empty, success, and error states.
- Form validation with actionable messages.
- Accessible labels and keyboard navigation.
- Consistent currency, quantity, and unit formatting.
- Date/time display with an unambiguous timezone policy.
- Safe file upload restrictions.
- Privacy-aware data sharing.
- Graceful handling of slow or interrupted networks.

## 15. Acceptance criteria

A feature is not complete merely because its screen exists. Each approved feature must have:
- Defined user role and permissions.
- Defined input, output, and state transitions.
- Validation and error cases.
- Loading, empty, and success states.
- Security checks.
- Relevant automated or documented manual tests.
- Updated documentation where behaviour changes.

## 16. Out of scope until approved

Do not independently add social feeds, public comments, auctions, bidding engines, loans/credit, insurance products, crop disease diagnosis, input/fertilizer sales, government scheme applications, or a native mobile app. These may be evaluated later but are not approved by this document.
