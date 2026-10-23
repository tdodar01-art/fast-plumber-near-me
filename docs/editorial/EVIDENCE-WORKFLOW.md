# Recommendation evidence workflow

Internal editorial workflow, October 23, 2026. Applies nationally. These documents are collection templates, not published business data or a live submission system.

## Start with a specific claim

Open one dossier per business, matched by existing place ID, official website, phone and service area. Resolve conflicting identities before reviewing claims. Record evidence about a specific job, policy or credential; never use a single “verified company” label to imply everything has been checked.

Use `templates/customer-job-account.md` for customer interviews and `templates/business-policy-check.md` for written policy research or a later authorized interview. Do not send either to anyone without authorization. Public business-site research can proceed without outreach.

## Evidence labels

- **Unknown:** no usable evidence. This does not count against the business.
- **Customer-reported:** an attributed person's account. Record relationship and supporting material; a document can corroborate a bill without proving workmanship.
- **Business-stated:** an official publication or written response. A stated policy does not prove how every job is handled.
- **Independently checked:** a reviewer matched a precise fact against an appropriate independent source. State the scope, date and source. A license check does not establish fair pricing, insurance or integrity.

Keep these labels separate from moderation status: draft, needs clarification, ready for editorial review, approved for publication, withheld, superseded. Publication approval is not independent verification.

## Review before publication

1. Confirm identity, job date, source and permission to publish. Record publication consent separately from permission to store private corroborating documents.
2. Preserve the customer's own account. Separate direct quotation, editor summary and inference. Give every material public claim a source and observation date.
3. Check quote versus final bill using the same scope. Record taxes, permits, extra work and customer-approved changes separately. Unknown figures remain unknown; do not infer a surprise charge from different totals alone.
4. Record limitations and conflicting evidence. Ask for clarification before drawing a conclusion; preserve corrections and review history.
5. Remove customer addresses, contact details, payment information, document identifiers and access instructions from public copy. Keep private materials in restricted storage, never Git or public JSON.
6. Attribute firsthand accounts and disclose employment, family, financial, ownership or other relevant relationships. Tim's account must disclose that he owns this site.
7. Publish only the supported scope: “Customer reports receiving a written estimate for this job,” for example. Avoid “always honest,” “no upselling,” guaranteed availability or blanket verified badges.
8. Record reviewer, approval date, next review date and a correction route before publishing. Recheck policy claims after 90 days as an internal editorial cadence; immediately review reported changes. Label customer accounts by job date rather than implying current conditions.

## Application and storage

Do not edit model scores to fit a favored business. One firsthand account alone does not override shortlist eligibility. Any future editorial recommendation path needs explicit published criteria and review before implementation.

The templates are staging documents. Future production evidence belongs in Firestore under the existing single-source contract, with private materials separated from public approved fields. Any website JSON artifact must have one export writer. No production evidence storage, intake endpoint or public evidence badge is implemented by this workflow.

## First case: MPT Plumbing Inc

Existing dossier: `../research/2026-10-23-mpt-plumbing.md`. Tim's positive firsthand statement is recorded; job details, corroboration and publication consent remain pending. Written fee, estimate, scope-change and warranty policies remain unknown. Do not treat the favorable account or missing policies as a completed endorsement.

Next action: collect the job account, then research available written policies. External contact requires authorization. Use the same standard for businesses in every state.
