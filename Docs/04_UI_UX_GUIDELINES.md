# AgriBridge — UI/UX Guidelines

**Document status:** Initial experience principles; visual system and screen designs pending approval.

## 1. Experience objective

The interface should make agricultural coordination understandable and practical. Users should be able to complete important tasks without needing to understand the platform's internal technology.

Do not design AgriBridge as a generic admin dashboard or a visually decorative landing page with incomplete workflows.

## 2. Core UX principles

- Task-first navigation: prioritize the actions each user needs to perform.
- Role clarity: make the active role and available actions obvious.
- Plain language: avoid unexplained technical or financial terminology.
- Trust through clarity: distinguish verified, user-entered, estimated, and AI-generated information.
- Transparent comparisons: show units, location, date, included charges, and assumptions.
- Mobile-first practicality: primary flows must work on narrow screens.
- Low-friction forms: request only information needed at that step.
- Error recovery: preserve user input where safe and explain how to fix errors.
- Accessible interaction: readable contrast, labels, keyboard support, and clear focus states.

## 3. Information architecture

The exact navigation is pending product approval. Candidate areas include:
- Home / overview.
- Find produce or offers.
- Buyer requirements.
- My offers / my requirements.
- Enquiries and conversations.
- Price and transport comparisons.
- Logistics / shipments.
- Profile and account settings.
- Help and support.

Show only relevant navigation to each role. Do not expose admin functions to ordinary users.

## 4. Role-specific experience

### Seller
Prioritize:
- Create/manage an offer.
- View enquiries.
- Respond and negotiate.
- Review comparison information.
- Coordinate fulfilment.

### Buyer
Prioritize:
- Search/discover produce.
- Create a requirement.
- Compare offers.
- Contact and negotiate.
- Review total-cost and logistics information.

### Logistics partner
Prioritize:
- View relevant transport requests.
- Submit or manage quotations.
- Review accepted jobs.
- Update permitted shipment milestones.
- Provide delivery evidence where required.

These are proposed navigation priorities; exact dashboards and permissions must follow approved functional requirements.

## 5. Forms and data entry

- Group fields into understandable sections.
- Explain required fields and accepted formats.
- Use appropriate controls for dates, units, quantities, and locations.
- Do not silently change a user's entered quantity or unit.
- Show validation close to the relevant field.
- Avoid clearing valid input after an error.
- Provide draft/save behaviour for lengthy forms if required.
- Clearly explain why sensitive information is requested.

## 6. Listings and comparisons

A produce offer or buyer requirement should display enough context for a meaningful decision. Candidate information includes produce type, quantity/unit, location, availability, quality details, price/terms, and last-updated time.

Comparison views must:
- Compare like with like where possible.
- Make unit conversions visible.
- Separate product price from transport and other charges.
- Identify estimates and missing values.
- Avoid implying that the cheapest headline price is necessarily the best overall option.

## 7. AI-generated content and estimates

Clearly label AI-assisted output. Show uncertainty and limitations. Allow users to review or correct generated descriptions or assessments before publishing or relying on them. Do not use visual styling that makes an estimate look like a certification.

## 8. Status and feedback states

Every major workflow should define:
- Initial/empty state.
- Loading state.
- Success state.
- Validation error state.
- Permission-denied state.
- Not-found state.
- Network/service failure state.
- Pending, accepted, rejected, cancelled, and completed states where relevant.

Status labels must have consistent meanings throughout the application.

## 9. Visual system

The following remain to be approved:
- Brand mark and logo.
- Colour palette.
- Typography.
- Spacing scale.
- Component library.
- Icon style.
- Illustration/photography direction.
- Chart and data-visualization conventions.

Do not invent a final brand identity or apply arbitrary colours inconsistently. Create reusable design tokens once the direction is approved.

## 10. Responsive behaviour

Design and test at representative:
- Small mobile width.
- Large mobile width.
- Tablet width.
- Desktop width.

Tables and comparison data must remain usable on small screens; use responsive cards, controlled horizontal scrolling, or another deliberate pattern rather than allowing accidental overflow.

## 11. Accessibility and localization

- Use semantic headings and controls.
- Associate labels with form fields.
- Ensure keyboard operation and visible focus.
- Provide meaningful alternative text for informative images.
- Do not communicate status by colour alone.
- Plan for localization and longer translated strings.
- Use clear number, currency, date, and unit formatting.

**PENDING:** Initial languages, locale, currency, timezone, and accessibility conformance target.

## 12. UX acceptance checklist

Before a screen is considered complete:
- The intended user role is clear.
- The primary action is obvious.
- Required information is explained.
- Empty, loading, error, and success states exist.
- Mobile layout is usable.
- Keyboard and label basics work.
- Sensitive information is not unnecessarily exposed.
- Displayed estimates and verification claims are clearly qualified.
