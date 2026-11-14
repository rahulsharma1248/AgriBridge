# AgriBridge — Database Design

**Document status:** Conceptual data model; no production schema approved.  
**Purpose:** Define data concepts and integrity requirements before selecting final tables and migrations.

## 1. Design principles

- Use stable primary identifiers.
- Define foreign-key relationships and deletion behaviour.
- Store timestamps consistently, preferably in UTC, and display them in the user's chosen/local context.
- Store quantities with explicit units.
- Store monetary values with explicit currency and precision.
- Validate data at both application and database boundaries where appropriate.
- Apply least-privilege access.
- Keep audit history for consequential changes.
- Avoid storing sensitive information without a defined purpose and retention policy.

## 2. Candidate entities

These are conceptual entities, not a finalized schema.

### 2.1 User and profile
Potential fields:
- User identifier.
- Authentication-provider identifier.
- Display name.
- Contact details, subject to verification and privacy rules.
- Account status.
- Created/updated timestamps.

### 2.2 Role membership
Potentially associates a user with one or more roles:
- Seller.
- Buyer.
- Logistics partner.
- Administrator.

**PENDING:** Single-role versus multi-role account model.

### 2.3 Seller/business profile
Potential fields:
- Owner/user reference.
- Display/business name.
- Location.
- Business type.
- Verification status and verification evidence reference.

Do not store identity-document contents in ordinary profile fields. Define protected storage and retention first.

### 2.4 Produce offer / lot
Potential fields:
- Seller reference.
- Produce/category reference.
- Description.
- Quantity and unit.
- Location.
- Availability/harvest information.
- Asking price and currency, if applicable.
- Quality attributes and their source.
- Image/file references.
- Status.
- Created, updated, and expiry timestamps.

**PENDING:** Lot/batch model, crop taxonomy, mandatory attributes, packaging, grade vocabulary, and listing lifecycle.

### 2.5 Buyer requirement
Potential fields:
- Buyer reference.
- Produce/category.
- Quantity and unit.
- Delivery location.
- Needed-by date.
- Required attributes.
- Budget/price terms, if supplied.
- Status and timestamps.

### 2.6 Enquiry and negotiation
Potential concepts:
- Enquiry identifier.
- Related offer and/or requirement.
- Initiating user.
- Participants.
- Message records.
- Proposal versions.
- Proposed quantity, price, currency, delivery terms, and expiry.
- Acceptance/rejection state, if the approved workflow supports it.

Do not assume that a message itself creates a binding contract.

### 2.7 Logistics request / job
Potential fields:
- Related transaction or coordination record.
- Pickup and delivery locations.
- Cargo/produce description.
- Quantity and unit.
- Required date/time.
- Requesting party.
- Accepted logistics partner.
- Quotation and currency.
- Job status.
- Evidence references.
- Status event history.

### 2.8 Price and cost observations
Potential fields:
- Produce/category.
- Market/location.
- Price value, currency, and unit.
- Source/provider.
- Observed/published time.
- Retrieved time.
- Validity/freshness metadata.
- Data quality or confidence notes.

Never mix source observations, user quotes, and calculated estimates without an explicit type/source field.

### 2.9 AI analysis record
If approved, potential fields:
- Upload reference.
- Provider/model identifier.
- Analysis type.
- Structured result.
- Confidence/limitations.
- Created time.
- User review/correction state.

Avoid storing unnecessary raw prompts or sensitive data.

### 2.10 Notifications and audit events
Potential fields:
- Recipient.
- Event type.
- Delivery channel/status.
- Created/sent/read timestamps.
- Actor.
- Action.
- Target resource.
- Timestamp.
- Safe metadata describing the event.

## 3. Relationships to evaluate

- A user may have one or more role memberships, depending on the approved account model.
- A seller profile may own multiple offers/lots.
- A buyer may create multiple requirements.
- An offer or requirement may receive multiple enquiries.
- An enquiry may contain multiple messages and proposals.
- A logistics job may relate to an agreed movement and have multiple status events.
- A price observation belongs to a defined source, location, produce, unit, and observation time.
- An uploaded file must have an owner and access policy.

Finalize cardinalities and lifecycle rules before migrations.

## 4. Data integrity

- Quantity must be positive and have a recognized unit.
- Monetary values must include currency.
- Foreign keys must prevent orphaned records.
- Status transitions must be validated.
- Accepted proposals should retain the exact accepted terms.
- Historical price observations should not be overwritten as if they were current.
- Important changes should preserve actor and timestamp.
- Unit conversions must use explicit conversion rules and compatible dimensions.

## 5. Access control

Define a permission matrix for every table/resource and operation:
- Read.
- Create.
- Update.
- Delete/archive.
- Administrative review.

Enforce authorization on the server and, if using a database with row-level security, enforce suitable database policies as an additional boundary. Test policies for cross-user and cross-role data leakage.

## 6. Privacy and retention

Before storing personal, identity, financial, location, or business-sensitive information, define:
- Purpose.
- Access roles.
- Retention period.
- Deletion/anonymization process.
- Export/correction process where applicable.
- Backup retention implications.

Do not store payment credentials or identity documents unless the approved architecture and compliance review explicitly require it.

## 7. Migrations and seed data

- Use version-controlled schema migrations.
- Do not make undocumented manual production schema changes.
- Keep development seed data fictional and clearly marked.
- Never copy production personal data into a local environment without authorization and safeguards.
- Test migrations and rollback/recovery procedures.

## 8. Decisions required before implementation

1. Database engine/provider.
2. Authentication identity model.
3. Single-role or multi-role users.
4. Produce taxonomy and units.
5. Offer/requirement status lifecycle.
6. Negotiation and agreement representation.
7. Logistics lifecycle and evidence.
8. Price-source schema and provenance.
9. File storage and access model.
10. Audit and retention policy.
11. Row-level security/authorization model.
