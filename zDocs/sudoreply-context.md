# Sudo Reply — System Overview

<!-- zDocs/sudoreply-context.md (do not remove this comment) -->

## Sudo Reply — System Overview

Sudo Reply is a multi-tenant customer communication and support platform centered around WhatsApp business messaging. It is intended to help businesses manage customer conversations through a shared platform, with platform-level administration and developer/technical operations handled separately from each business tenant's day-to-day work.

This document captures the Sudo Reply context established in project discussions. It deliberately distinguishes known context from details that must be verified against the current repository, product decisions, or implementation. Do not treat proposed features as already implemented.

## 1. Product Purpose

Sudo Reply is being developed to help businesses handle customer conversations, particularly conversations arriving through WhatsApp. The platform is expected to provide a structured way for businesses to receive, manage, and respond to customer messages without each business needing to build its own WhatsApp integration from scratch.

The exact product scope, supported channels beyond WhatsApp, subscription model, and final feature set must be verified. Do not assume that every feature discussed during brainstorming has been approved or implemented.

## 2. Main Product Areas and Actors

Project discussions have identified several distinct perspectives that must be considered when designing features:

- **Business/Tenant side:** The business using Sudo Reply to manage its customer communication. This is the tenant-facing workspace.
- **Customer side:** The end customer who contacts a business, primarily through WhatsApp. Customers should not be assumed to use a separate Sudo Reply application or account unless a specific product requirement establishes one.
- **Sudo Reply Admin side:** The platform operator's interface for managing and overseeing the Sudo Reply service and its tenants.
- **Developer/Technical side:** The technical or integration-facing perspective used to configure, troubleshoot, monitor, or maintain integrations and platform behavior. Its exact interface and permissions are not yet established.

These are different roles and product surfaces, not interchangeable names for the same user. A feature may affect more than one surface, so its complete flow should be considered before implementation.

## 3. Business/Tenant Workspace

The tenant workspace is where a business should manage the customer communication handled through Sudo Reply.

The precise tenant feature set is not yet fully established in the available project context. Conversation management, message replies, WhatsApp connection/configuration, and AI-assisted responses have been discussed as product concerns, but the current implementation and approved scope must be checked before treating any of them as complete.

Do not assume:
- every tenant has the same WhatsApp setup or business workflow;
- every tenant has access to every platform feature;
- tenant users can view or manage another tenant's conversations or configuration;
- tenant onboarding, staff roles, assignment rules, or subscription entitlements work in a particular way without checking the implementation.

## 4. Customer Messaging and WhatsApp

WhatsApp is a central integration in Sudo Reply.

A previously discussed inbound-message flow is:

1. A customer sends a WhatsApp message to a business.
2. Meta/WhatsApp receives the message.
3. Meta sends an HTTP webhook request to a Sudo Reply webhook endpoint.
4. Sudo Reply processes the webhook and associates the message with the correct business/tenant and conversation.
5. The message becomes available to the relevant tenant-side workflow.
6. A business user or an enabled automated workflow can respond through the supported messaging integration.

The project discussion referenced webhook paths such as `/sradmin/webhook` and `/tenant/whatsapp/...`. These are context clues, not a guarantee that both routes are current, complete, or responsible for the same events. Verify the actual routes, webhook verification, event handling, tenant resolution, and message persistence in the repository.

Important integration concerns include:
- webhook verification and authenticity;
- duplicate webhook delivery and idempotent processing;
- mapping WhatsApp phone numbers/business accounts to the correct tenant;
- message and conversation identity;
- delivery, read, failure, and other message-status events, if supported;
- retries, timeouts, and error handling;
- media messages and the lifecycle of downloaded/stored media;
- WhatsApp platform limits, templates, permissions, and policy requirements.

Do not assume that receiving a webhook means a message has been successfully stored, displayed, or replied to.

## 5. Media and Attachments

WhatsApp conversations may contain more than plain text. Media handling has been discussed as a system concern.

The exact supported media types, storage provider, retention policy, file-size limits, download strategy, and database representation must be verified. Do not assume that Meta's media URL is a permanent asset URL or that a webhook payload itself contains the complete media file.

When changing media handling, trace the complete lifecycle:
1. webhook event received;
2. media metadata/identifier extracted;
3. media retrieved from the provider when required;
4. file validated and stored in the configured storage system;
5. stored reference associated with the correct message/conversation/tenant;
6. authorized retrieval and display in the tenant interface;
7. retention, deletion, and failure handling.

Security and tenant isolation apply to media just as they do to message text.

## 6. Multi-Tenant Structure and Access Control

Sudo Reply is discussed as a platform serving multiple businesses. Tenant isolation is therefore a fundamental architectural requirement.

At minimum, distinguish:
- the Sudo Reply platform;
- an individual business/tenant;
- tenant users and their permissions;
- the tenant's WhatsApp/business integration details;
- customer identities and conversations associated with that tenant.

The exact database entities, tenant identifiers, relationships, and role model must be confirmed from the Prisma schema and application code.

Strict rules:
- Every tenant-owned record must be scoped and authorized appropriately.
- A tenant user must not be able to access another tenant's conversations, contacts, messages, media, settings, or integration credentials.
- Platform administrators may have broader access, but that access must be explicit and controlled.
- Never trust a tenant identifier supplied by the client without server-side authorization.
- Background jobs, webhook handlers, AI workflows, and media endpoints must enforce the same tenant boundaries as ordinary API routes.

Do not invent tenant roles, permissions, or hierarchy. Inspect the current authorization model before proposing changes.

## 7. AI Assistant and Automation

An AI chatbot/assistant capability has been discussed as a potential Sudo Reply feature. The intended behavior, configuration model, onboarding experience, and production readiness have not been conclusively established in the available context.

A major product question raised during discussion is how different businesses teach or configure the AI when each business has different products, services, policies, and ways of handling customer requests. This is a core product-design problem, not merely a prompt-writing task.

Before proposing or implementing an AI workflow, establish:
- what information a tenant provides to configure its assistant;
- whether knowledge comes from manually entered instructions, FAQs, uploaded documents, website content, integrations, or a combination;
- how information is reviewed, tested, updated, and versioned;
- how the system prevents one tenant's knowledge from being used for another tenant;
- what the AI is allowed to answer or do;
- when it must ask for clarification or hand the conversation to a human;
- how tenant users can inspect, correct, and improve AI behavior;
- how failures, uncertain answers, and escalations are presented;
- how usage, cost, privacy, and auditability are managed.

Do not assume the AI should autonomously answer every message. Do not promise that an assistant will work correctly merely because a tenant has uploaded information. The product needs a clear setup, testing, monitoring, and human-override workflow.

When designing an AI feature, map the end-to-end experience across the customer, tenant, Sudo Reply admin, and developer/technical perspectives. Explain what each actor sees and what happens behind the scenes.

## 8. Platform Administration

A Sudo Reply admin surface has been identified in project discussions. It is distinct from the tenant workspace.

Its exact responsibilities, screens, and permissions are not fully established in the available context. Potential concerns such as tenant administration, integration oversight, operational monitoring, support, and platform configuration must be treated as requirements to confirm—not assumed existing features.

Platform-level access must be separated from tenant-level access. Administrative actions that affect tenant data, messaging integrations, AI configuration, or service availability should be permission-controlled and auditable.

## 9. Developer and Integration Operations

A developer/technical perspective has also been identified in product brainstorming. Its exact audience and scope remain to be defined.

Clarify whether this means internal Sudo Reply engineering tools, tenant-facing developer settings, API/webhook configuration, or some combination. Do not merge these audiences without an explicit product decision.

If developer-facing integration tools are planned, define:
- which APIs and webhook events are exposed;
- authentication and credential management;
- webhook endpoint setup and verification;
- event delivery, retries, and logs;
- test/sandbox behavior;
- rate limits and error responses;
- permissions and audit trails.

Never expose secrets, access tokens, or sensitive tenant data in logs or UI.

## 10. Backend, Database, and Repository

A Prisma `P2025` error has appeared in prior Sudo Reply development discussion, indicating that Prisma is part of at least one investigated code path. This alone does not establish the complete backend stack, database provider, repository structure, or production architecture.

Verify the current repository before making claims about:
- programming languages and frameworks;
- package names and versions;
- API route structure;
- database provider and Prisma models;
- authentication and authorization;
- background jobs and queues;
- cache and storage providers;
- deployment and hosting;
- logging, monitoring, and testing.

Treat the current codebase and its migrations as the source of truth for implementation details. Do not design around guessed model names, route names, or service boundaries.

## 11. Core Flows to Trace Before Changing the System

For any feature involving messaging, trace the full lifecycle rather than changing only the visible UI or one API handler.

**Inbound message**
1. Customer sends a message through WhatsApp.
2. Meta sends a webhook event.
3. Sudo Reply verifies and parses the event.
4. The correct tenant/integration is resolved.
5. The message and related metadata are persisted safely.
6. The relevant conversation is updated.
7. The tenant interface is notified or refreshed through the existing mechanism.
8. Any enabled automation or AI workflow runs under the tenant's configuration and permissions.

**Outbound reply**
1. A tenant user or approved automation initiates a reply.
2. The backend verifies tenant access and conversation ownership.
3. The message is validated against channel requirements.
4. The WhatsApp integration sends the message.
5. The result and provider identifiers are persisted.
6. Status updates and failures are handled.
7. The tenant interface reflects the correct state.

These are conceptual flows. Confirm the actual implementation, status model, real-time mechanism, and ordering guarantees before changing code.

## 12. Security, Privacy, and Reliability

Messaging systems handle personal conversations and potentially sensitive customer information. Treat privacy and security as foundational requirements.

Consider:
- tenant isolation at every data-access boundary;
- authentication, authorization, and session security;
- encryption and secure handling of integration credentials;
- webhook signature/token verification;
- validation and sanitization of inbound content;
- safe media downloads and file validation;
- access-controlled media delivery;
- protection against duplicate events and race conditions;
- rate limiting and abuse prevention;
- audit logs for privileged actions;
- data retention and deletion requirements;
- careful handling of personal data in AI prompts, logs, analytics, and third-party services.

Do not log secrets or unnecessarily copy customer message content into diagnostics.

## 13. Strict Operating Rules for AI Assistants

1. **Do NOT assume anything about my system.** Base conclusions on verified project context and the actual implementation.
2. **Separate confirmed facts from proposals and assumptions.** Clearly label anything that has not been verified.
3. **If important context is missing, ask for the relevant context file or code.** Do not fill architectural gaps with guesses.
4. **Challenge vague requirements.** Identify ambiguity, hidden assumptions, conflicting requirements, and undefined business rules before proposing a solution.
5. **Surface edge cases and risks early.** Explain failure scenarios, operational implications, security risks, and trade-offs.
6. **Think across the complete system.** Consider customer, tenant, Sudo Reply admin, developer/technical, backend, database, webhook, and external-provider effects.
7. **Do not generate implementation code unless I explicitly say: "Proceed with implementation."** Discussion, analysis, research, and architecture planning are not permission to write code.
8. **Do not start implementation until the architecture/approach is clearly explained and approved.** Explicit implementation permission and architecture approval are both required.
9. **For large changes, propose structured implementation phases before coding.** Explain scope, dependencies, migration impact, and testing for each phase.
10. **Follow existing project conventions once provided.** Do not invent new patterns, abstractions, dependencies, or architecture without justification.
11. **When proposing a feature, explain the UI and user journey visually and concretely.** I understand systems better when I can see what each actor sees and how the flow moves. Avoid relying only on abstract descriptions. Show the customer, tenant, Sudo Reply admin, and developer/technical perspectives where relevant.
12. **When providing code changes, prefer precise find-and-replace instructions.** Identify the exact existing block and provide the complete replacement block. Do not provide full-file replacements by default. Only provide a complete replacement file when the change affects more than 60% of that file or when a full file is explicitly requested.
13. **Explain technical concepts clearly and step by step.** Do not skip the underlying flow or assume I already understand a concept. Be direct and point out when an idea is technically or operationally unsound.
14. **Verify current behavior before changing it.** Inspect relevant routes, schemas, services, middleware, UI components, and tests rather than relying on filenames or prior assumptions.

These rules apply throughout Sudo Reply planning, architecture, research, debugging, and development discussions.

## 14. Unknowns That Must Be Verified

The following details are not established by the available context and must not be invented:

- complete technology stack and monorepo/repository structure;
- exact tenant, user, contact, conversation, message, and integration data models;
- supported WhatsApp API/product configuration and account onboarding flow;
- exact webhook routes, event types, verification method, and processing architecture;
- media storage provider and retention policy;
- real-time updates mechanism;
- tenant roles, platform-admin permissions, and developer access model;
- billing, subscription tiers, usage limits, and pricing;
- AI provider/model, knowledge ingestion, retrieval architecture, prompt/configuration model, and handoff rules;
- supported channels beyond WhatsApp;
- deployment, hosting, monitoring, and background processing infrastructure.

When one of these details matters to a task, inspect the relevant source or ask for the relevant project context before making a recommendation.
