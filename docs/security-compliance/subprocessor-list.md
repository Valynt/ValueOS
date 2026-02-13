# Subprocessor List

This list identifies third-party subprocessors that may process customer data to deliver ValueOS services.

## Current Subprocessors

| Subprocessor | Service Purpose | Data Categories | Processing Region | Safeguards |
| --- | --- | --- | --- | --- |
| Supabase | Managed PostgreSQL and storage infrastructure | Tenant application data, metadata | Region configured per environment | Encryption at rest/in transit, access controls |
| OpenAI | AI model inference for customer-requested features | Prompt content and generated outputs as configured by product workflows | Provider-supported regions | Contractual controls, transport encryption |
| Stripe | Billing and payment processing | Billing contact and transaction metadata | Global / region by Stripe configuration | PCI-aligned controls, encrypted transport |
| Resend | Transactional email delivery | Recipient email and message metadata | Provider-supported regions | Transport security, restricted API access |

## Change Management and Notification

- ValueOS reviews subprocessors prior to onboarding for security and compliance fit.
- Material subprocessor changes are documented in this file and communicated through customer channels.
- Customers may raise objections through their account representative where contractually supported.

## Contact

For subprocessor diligence requests, contact security@valueos.com.
