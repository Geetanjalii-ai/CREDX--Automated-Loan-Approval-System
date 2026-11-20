# CredX — Automated Underwriting & Retail Banking Platform

[![Node.js](https://img.shields.io/badge/Node.js-v18+-green.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Cloud-blue.svg)](https://neon.tech/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-red.svg)](https://upstash.com/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-AMQP_0--9--1-orange.svg)](https://www.rabbitmq.com/)
[![React](https://img.shields.io/badge/React-19_Vite-cyan.svg)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v3.x-38B2AC.svg)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> A modern, decoupled microservices-based automated loan underwriting platform designed to eliminate manual, paper-intensive credit risk evaluation using dynamic rule evaluation, forensic document balance scanning, distributed caching, and real-time push notifications.

---

## 📌 Table of Contents

- [Overview](#-overview)
- [Key Architectural Highlights](#-key-architectural-highlights)
- [Tech Stack](#-tech-stack)
- [Microservices Breakdown](#-microservices-breakdown)
- [Database Schema & Data Modeling](#-database-schema--data-modeling)
- [API Reference](#-api-reference)
- [End-to-End Execution Flow](#-end-to-end-execution-flow)
- [Resilience & Engineering Highlights](#-resilience--engineering-highlights)
- [Future Roadmap](#-future-roadmap)

---

## 🌟 Overview

Traditional retail banking loan origination processes take days or weeks due to manual KYC verification, spreadsheet-driven risk calculations, and rigid hardcoded underwriting policies.

**CredX** reimagines retail credit underwriting as an automated, event-driven distributed system:
* **Instant Risk Evaluation**: Evaluates credit scores, Debt-to-Income (DTI) ratios, and loan-to-value metrics in sub-second intervals.
* **Forensic Document Scanner**: Protects lenders against altered bank statements by validating internal ledger debit/credit consistency.
* **Zero-Downtime Underwriting Updates**: Enables risk managers to dynamically tune credit score thresholds or DTI limits without code redeployments or server restarts.
* **Deterministic Audit Trail**: Permanently logs immutable JSON snapshots of evaluated rules for regulatory compliance and audit defense.

---

## 🚀 Key Architectural Highlights

1. **Decoupled 3-Tier Microservices Architecture**: Isolated domain boundaries across **User & KYC (`:5001`)**, **Loan Application (`:5002`)**, and **Decision & Compliance (`:5003`)**, connected via asynchronous AMQP message streams and real-time WebSockets.
2. **Dynamic Business Rules Engine (BRE) with Zero-Downtime Cache Eviction**: Underwriting rules are declaratively stored in PostgreSQL and cached in Redis (`TTL 1800s`). Updating a policy invalidates the Redis cache (`cache.del`), ensuring immediate propagation across all evaluation nodes with zero downtime.
3. **Anti-Tampering Financial Statement Scanner**: Performs forensic reconciliation across transaction histories by computing running balances ($Opening + \sum Credits - \sum Debits == Closing$) to detect document tampering and forgery.
4. **Polymorphic PostgreSQL Validation Block**: Employs PostgreSQL `JSONB` schemas with category-specific validation pipelines to dynamically evaluate unique risk criteria across **Personal**, **Auto**, and **Home** loan verticals within a unified schema.
5. **Automated KYC Pipeline**: Integrated Tesseract.js OCR engine, liveness confidence scoring, simulated Aadhaar/PAN OTP verification, and Backblaze B2 private document storage accessed via time-limited presigned URLs (`TTL 600s`).
6. **Distributed Idempotency & Concurrency Protection**: Client-generated `UUIDv4` tokens hashed via SHA-256 and locked via atomic Redis `SETNX` operations (`TTL 300s`) with an automatic PostgreSQL fail-open fallback to prevent duplicate loan origination.
7. **Real-Time Push Notifications**: Integrated Socket.io push engine fanning out events across connected customer browser tabs to display live application status updates without polling.
8. **Immutable Compliance Audit Ledger**: Write-Once Read-Many (WORM) audit architecture recording frozen JSON snapshots of rules, input applicant data, and individual criteria pass/fail traces.

---

## 🛠 Tech Stack

| Domain | Technology | Justification |
|---|---|---|
| **Frontend** | React 19, Vite, TailwindCSS, Lucide Icons, Socket.io-client | High-performance reactive UI with instant WebSocket notification integration. |
| **Backend Runtime** | Node.js (v18+), Express.js | Non-blocking, asynchronous I/O ideal for network-bound microservices and streaming APIs. |
| **Database** | PostgreSQL (Neon Cloud Serverless) | Relational integrity, strict ENUM constraints, and `JSONB` for polymorphic vertical attributes. |
| **In-Memory Cache** | Redis (Upstash) | Sub-millisecond lookup ($O(1)$) for dynamic rules, rate-limiting counters, and atomic locks. |
| **Message Broker** | RabbitMQ (AMQP 0-9-1) | Decoupled asynchronous task queueing and event fanout across microservice instances. |
| **Object Storage** | Backblaze B2 (AWS S3-compatible API) | Cost-effective, secure, private blob storage with time-delimited presigned access URLs. |
| **Document OCR** | Tesseract.js | Client/Server computer-vision OCR for automated Aadhaar and PAN extraction. |
| **Authentication** | JWT (JSON Web Tokens), bcryptjs (12 rounds) | Stateless, cryptographically signed RBAC authentication without database roundtrips. |

---

## 📦 Microservices Breakdown

### 1. User & KYC Microservice (`PORT: 5001`)
* **Role**: Handles customer lifecycle, identity onboarding, and real-time push dispatch.
* **Core Capabilities**:
  * User registration and bcrypt-hashed password authentication.
  * Multi-step demographic profile enrichment (age, address, gender).
  * Two-factor Aadhaar/PAN OTP challenge simulator.
  * Multi-part image ingestion (`multer` memory buffer) for Selfie, PAN, and Aadhaar cards.
  * Tesseract.js OCR extraction comparing card text with user inputs.
  * Bank Manager KYC resolution dashboard with presigned image preview URLs.
  * Socket.io WebSocket server mapping connected user tabs.

### 2. Loan Application Microservice (`PORT: 5002`)
* **Role**: Manages loan application intake, validation, and submission state machines.
* **Core Capabilities**:
  * Enforces prerequisite check: applicant's `kyc_status` must be `'VERIFIED'`.
  * **Polymorphic Metadata Validation**:
    * *Personal Loan*: Requires `employer_name`, `employment_type`, `monthly_take_home`.
    * *Auto Loan*: Requires `vehicle_make_model`, `on_road_price`, `down_payment_amount`.
    * *Home Loan*: Requires `property_address`, `property_value`, `builder_reputation_grade`.
  * Distributed `X-Idempotency-Key` verification via Redis `SETNX` to prevent double submissions.
  * Publishes verified loan application payloads to RabbitMQ `loan_applications_queue`.

### 3. Decision & Compliance Microservice (`PORT: 5003`)
* **Role**: Executes the automated underwriting engine, forensic audit checks, and rule governance.
* **Core Capabilities**:
  * **Anti-Tampering Forensic Scanner**: Computes cumulative credit/debit balances across transaction histories to detect fraudulent statement tampering.
  * **Weighted Risk Scoring Algorithm**:
    $$\text{Composite Score} = (0.40 \times \text{Credit Score}) + (0.40 \times \text{DTI Ratio}) + (0.20 \times \text{Collateral}) - \text{OCR Penalties}$$
  * **Dynamic Business Rules Engine (BRE)**: Evaluates active rules against applicant metrics using strict boolean evaluation (zero `eval()` usage).
  * **Zero-Downtime Policy Updates**: Admin rule updates in PostgreSQL immediately purge Redis cache keys (`rules:<loanType>`).
  * **Immutable Audit Trail**: Inserts complete execution records into `compliance_audit_logs`.

---

## 🗄 Database Schema & Data Modeling

CredX runs on **PostgreSQL** with 7 primary relational tables and custom ENUM types:

```
┌──────────────────┐       1:1       ┌───────────────────┐
│      users       ├─────────────────┤    kyc_records    │
└────────┬─────────┘                 └───────────────────┘
         │ 1:N
         ├───────────────────────────┐
         │ 1:N                       │ 1:N
┌────────▼─────────┐        ┌────────▼──────────┐
│loan_applications │        │ system_audit_logs │
└────────┬─────────┘        └───────────────────┘
         │ 1:1
┌────────▼───────────────┐
│ compliance_audit_logs  │
└────────────────────────┘
```

### Table Definitions

| Table | Primary Responsibility | Key Fields |
|---|---|---|
| **`users`** | Customer identities & auth credentials | `id`, `email`, `password_hash`, `kyc_status`, `role` |
| **`kyc_records`** | OCR scores, snapshots & review states | `user_id`, `text_similarity_score`, `liveness_score`, `status` |
| **`loan_applications`** | Loan requests & category data | `user_id`, `loan_type`, `requested_amount`, `application_metadata` (JSONB) |
| **`loan_rules`** | Dynamic BRE underwriting criteria | `loan_type`, `parameter_key`, `operator`, `comparison_value`, `is_active` |
| **`compliance_audit_logs`** | Frozen snapshots of underwriting decisions | `application_id`, `rules_snapshot` (JSONB), `evaluation_ledger` (JSONB) |
| **`system_audit_logs`** | Administrative changes & rule updates | `actor_id`, `action_type`, `old_payload` (JSONB), `new_payload` (JSONB) |
| **`idempotency_logs`** | Fallback deduplication cache | `idempotency_key`, `response_payload` (JSONB), `expires_at` |

---

## 🔌 API Reference

### User & KYC Service (`http://localhost:5001`)

```http
POST   /api/v1/users/register             # Register customer account
POST   /api/v1/users/login                # Authenticate and receive JWT (24h)
GET    /api/v1/users/me                   # Retrieve authenticated user context
PUT    /api/v1/users/profile/enrich       # Update demographics (age, address, gender)
POST   /api/v1/kyc/otp/trigger            # Trigger simulated Aadhaar/PAN OTP
POST   /api/v1/kyc/otp/verify             # Verify OTP challenge
POST   /api/v1/kyc/submit-verification    # Upload 3 images (Selfie, PAN, Aadhaar) + OCR
GET    /api/v1/kyc/admin/kyc-queue        # [Manager] Fetch pending KYC queue + presigned URLs
POST   /api/v1/kyc/admin/kyc/resolve      # [Manager] Approve (VERIFIED) or Reject (FAILED)
```

### Loan Application Service (`http://localhost:5002`)

```http
POST   /api/v1/loans/apply                # Submit loan application (Requires X-Idempotency-Key)
GET    /api/v1/loans/my-applications      # Fetch logged-in user's loan applications & status
```

### Decision & Compliance Service (`http://localhost:5003`)

```http
POST   /api/v1/admin/evaluate-risk        # [Manager] Run forensic balance check & dynamic BRE
GET    /api/v1/admin/rules                # [Manager] Retrieve active underwriting rules
PUT    /api/v1/admin/rules/update         # [Manager] Update rule threshold & invalidate Redis cache
GET    /api/v1/admin/loan-queue           # [Manager] List submitted applications for review
GET    /api/v1/admin/audit-logs           # [Manager] View immutable system audit trail
```

## 🔄 End-to-End Execution Flow

```
[1. User Registration] ─────► [2. Demographics Enrichment] ─────► [3. OTP Challenge]
                                                                          │
[6. Real-time Status Push] ◄─── [5. Bank Manager Resolution] ◄─── [4. Tesseract OCR & B2]
         │
         ▼
[7. Loan Application Submit] ─► [8. Polymorphic Validation] ───► [9. Idempotency Lock]
                                                                          │
[12. Final Approval / Reject] ◄─ [11. Dynamic BRE Evaluation] ◄─── [10. Forensic Ledger Scan]
```

1. **User Sign Up & Profile Enrichment**: Customer registers and enters identity details.
2. **Document Ingestion & OCR**: Customer uploads identity documents; Tesseract.js extracts PAN/Aadhaar data and computes a text similarity match score.
3. **Manager KYC Approval**: Bank manager reviews extracted data and presigned image links; approvals execute atomically across tables via PostgreSQL transactions.
4. **Loan Application Submission**: Applicant submits category-specific metadata with an `X-Idempotency-Key` header.
5. **Anti-Tampering Forensic Scan**: Statement transaction entries are verified for mathematical continuity.
6. **Underwriting Decision**: Dynamic rules are evaluated via Redis cache. Resulting decisions are logged to `compliance_audit_logs` and pushed to the client via WebSockets.

---

## 🛡 Resilience & Engineering Highlights

- **Fail-Open Idempotency**: If Redis experiences an unexpected outage, the loan service automatically degrades gracefully by falling back to the PostgreSQL `idempotency_logs` table, keeping the submission pipeline 100% operational.
- **Fixed-Point Financial Math**: All monetary amounts are defined as `NUMERIC(12,2)` / `NUMERIC(15,2)` in PostgreSQL to prevent IEEE 754 binary floating-point rounding errors.
- **Atomic State Transitions**: Multi-table operations (such as KYC resolution updating both `users` and `kyc_records`) are wrapped in PostgreSQL `BEGIN ... COMMIT` blocks to eliminate orphaned records.
- **Strict BOLA/IDOR Defense**: All resource access queries enforce ownership via verified JWT tokens (`WHERE user_id = req.user.id`) rather than untrusted client route parameters.

---

## 🗺 Future Roadmap

- [ ] **AI/ML Biometric Facial Matching**: Replace client-side image checks with deep learning facial similarity verification between selfies and government ID cards.
- [ ] **Account Aggregator (AA) Integration**: Connect with RBI-regulated Account Aggregator APIs to fetch digitally signed bank statements directly from source institutions.
- [ ] **Dedicated Python Worker Pool**: Offload Tesseract OCR computation from Node.js to a dedicated asynchronous Python/Celery worker pool.
- [ ] **Distributed Circuit Breaker**: Implement [Opossum](https://github.com/nodeshift/opossum) circuit breakers on inter-service REST calls to isolate downstream latency spikes.
