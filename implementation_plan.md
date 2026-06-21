# Veno: Complete App Implementation Plan (Phased)

This document details the complete, step-by-step implementation roadmap for building the Veno Blood Donation Platform, structured into 9 chronological phases.

---

## Phase 1: Infrastructure & Database Design (Milestone 1)

### Objectives
Initialize the development environment and construct the database schemas, triggers, and geospatial extensions.

### Proposed Changes
#### [NEW] [schema.sql](file:///e:/Veno/supabase/migrations/20260609000000_init_schema.sql)
*   **Extensions:** Enable `uuid-ossp`, `postgis`, and `pg_cron`.
*   **Tables:**
    *   `profiles`: `id` (references auth.users), `phone_number`, `full_name`, `date_of_birth`, `blood_group`, `gender`, `division`, `district`, `upazila`, `verification_badge` (boolean), `points` (int), `created_at`.
    *   `donor_statuses`: `id`, `user_id` (references profiles), `state` (Enum: `NOT_A_DONOR`, `ACTIVE`, `PAUSED`, `REQUEST_PENDING`, `IN_QUEUE`, `MATCHED`, `COOLDOWN`, `INELIGIBLE`, `SUSPENDED`), `donation_cooldown_until` (timestamp), `auto_reenable` (boolean), `pause_until` (timestamp), `updated_at`.
    *   `blood_requests`: `id`, `requester_id` (references profiles), `patient_name`, `patient_blood_group`, `location_coords` (geography POINT), `location_address` (text), `units_needed` (int), `urgency` (Enum: `LOW`, `MEDIUM`, `CRITICAL`), `notes` (text), `status` (Enum: `ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`), `created_at`.
    *   `request_queues`: `id`, `request_id` (references blood_requests), `donor_id` (references profiles), `status` (Enum: `PENDING`, `ACCEPTED`, `DECLINED`), `location_coords` (geography POINT), `joined_at`.
    *   `donations_history`: `id`, `donor_id`, `request_id`, `donation_date`, `location`, `points_earned`.
    *   `medication_profiles`: `id`, `user_id`, `hemoglobin`, `weight`, `last_cbc_date`, `flagged_conditions` (jsonb).
*   **RLS (Row Level Security):** Define policies restricting Class A/B personal data visibility, fuzzed geography queries, and role-based permissions (`USER`, `VERIFIED_USER`, `ADMIN`).
*   **Database Triggers:**
    *   Enforce *1 active request limit* at the schema constraint level.
    *   Update `profiles.points` upon row insertion into `donations_history` or badge unlocks.

---

## Phase 2: App Scaffolding & Design System Implementation (Milestone 2)

### Objectives
Initialize the React Native (Expo) app and integrate styling tokens matching the Chime/Truecaller/Fi aesthetic.

### Proposed Changes
#### [NEW] [/](file:///e:/Veno/) (Project Setup)
*   Initialize Expo application using `npx create-expo-app@latest ./ --template blank-typescript`.
*   Install core libraries: `@supabase/supabase-js`, `expo-router`, `tailwindcss`, `nativewind`, `lucide-react-native`, `react-native-maps`.

#### [NEW] [tailwind.config.js](file:///e:/Veno/tailwind.config.js)
*   Register design system colors: `--bg-primary`, `--bg-secondary`, `--pulse-crimson`, `--plasma-gold`.
*   Register standard font pairings: `Outfit` and `Plus Jakarta Sans`.

#### [NEW] [components/](file:///e:/Veno/components/) (Design Components)
*   `GradientHeaderBlock.tsx`: The primary overlapping gradient canvas for greetings and metrics.
*   `BentoCard.tsx`: Metric dashboards utilizing `24px` border-radius panels.
*   `HorizontalActionPill.tsx`: Circular layout buttons for quick interaction.
*   `FloatingBottomTabBar.tsx`: Pill-active tab navigation.
*   `FittedMapFrame.tsx`: Map framework holding customized overlay elements.

---

## Phase 3: Auth & Identity Verification Flow (Milestone 3)

### Objectives
Establish Supabase phone authentication (OTP verification) and integrate Gemini Vision API for document scanning and metadata parsing.

### Proposed Changes
#### [NEW] [app/auth/](file:///e:/Veno/app/auth/) (OTP & Registration)
*   `login.tsx` / `register.tsx`: Linear user registration interfaces checking DOB $\ge 18$.
*   `otp.tsx`: OTP input with a 60-second block timer and locked account states.

#### [NEW] [app/verify/](file:///e:/Veno/app/verify/) (Gemini Document Parsing)
*   `nid-upload.tsx`: Capture NID/Passport images, encrypt files, and upload to protected Supabase storage buckets.
*   `process-nid.ts` (Edge Function): Run Gemini Vision API to parse name and birthdate, confirming accuracy with user profile fields to trigger a `VERIFIED_USER` status badge.

---

## Phase 4: Donor Lifecycle & Health Rules Engine (Milestone 4)

### Objectives
Implement the complete donor lifecycle state machine, eligibility validation schedules, and health questionnaire scanning.

### Proposed Changes
#### [NEW] [services/lifecycle.ts](file:///e:/Veno/services/lifecycle.ts)
*   State machine helper handling status transitions (`ACTIVE` $\rightarrow$ `PAUSED` $\rightarrow$ `COOLDOWN` $\rightarrow$ `INELIGIBLE`).
*   Verify logic for manual pause triggers and scheduler hooks using `pg_cron` to auto-re-enable donors.

#### [NEW] [app/profile/medical.tsx](file:///e:/Veno/app/profile/medical.tsx)
*   Medical document scanner using Gemini API to read hemoglobin (Males $\ge 13$, Females $\ge 12$) and flags. Allow user to adjust parsed parameters before database storage.

---

## Phase 5: Geofenced Matching Engine & Broadcasts (Milestone 5)

### Objectives
Create PostGIS spatial geofence queries and integrate the Gemini scoring algorithm to rank donors.

### Proposed Changes
#### [NEW] [supabase/functions/match-donors/index.ts](file:///e:/Veno/supabase/functions/match-donors/index.ts)
*   **Geofence Query:** Query coordinates within 5 km (or 10 km for `CRITICAL` urgency) matching blood types.
*   **AI Ranking (Gemini):** Pass candidates to Gemini API to yield a ranked JSON layout applying weight vectors: **Distance (40%) + History (30%) + Health Profile (20%) + Response Rate (10%)**.
*   **Broadcast Engine:** Dispatch Expo Push notifications to the top 20 matched donors.

---

## Phase 6: Queue & Live Tracking Systems (Milestone 6)

### Objectives
Develop real-time request lists, queue controls, anonymized map views, and live en-route map routing.

### Proposed Changes
#### [NEW] [app/dashboard/request/[id].tsx](file:///e:/Veno/app/dashboard/request/%5Bid%5D.tsx)
*   Requester's queue view displaying incoming donor details fuzzed to 500m grid snaps for privacy.
*   Handle user selection and contact deep-linking (WhatsApp, Phone dialer).

#### [NEW] [app/dashboard/map.tsx](file:///e:/Veno/app/dashboard/map.tsx)
*   Real-time maps showing GPS tracking every 30 seconds for accepted donors.
*   Foreground service hooks displaying persistent notifications during transit.

---

## Phase 7: Post-Donation Confirmation & Cooldowns (Milestone 7)

### Objectives
Define confirmation timelines, outcomes, and automated recovery cooldown allocations.

### Proposed Changes
#### [NEW] [app/confirm/index.tsx](file:///e:/Veno/app/confirm/index.tsx)
*   Completion wizard for donors and requesters to confirm successful blood transfers.
*   Automated cooldown triggers setting status to `COOLDOWN` for 120 days.
*   Auto-close request queue fallback jobs setting statuses to `UNCONFIRMED` after 48 hours.

---

## Phase 8: Gamification, Leaderboards & Offline Cards (Milestone 8)

### Objectives
Provide point rewards, milestone badges, district leaderboards, and offline-cached digital donor cards.

### Proposed Changes
#### [NEW] [app/profile/card.tsx](file:///e:/Veno/app/profile/card.tsx)
*   Render QR code containing the anonymized data payload.
*   Store card image cache locally using SQLite or filesystem storage.

#### [NEW] [app/leaderboard/index.tsx](file:///e:/Veno/app/leaderboard/index.tsx)
*   Regional (District/National) leaderboard views matching point totals.

---

## Phase 9: Security Audits, QA & Publishing (Milestone 9)

### Objectives
Verify security integrity, run performance validation, simulate load, and build binary releases.

### Proposed Changes
*   **Security Validation:** Implement API rate limits on auth routes. Write Jest scripts to confirm RLS policies.
*   **Beta Tests:** Distribute test builds to 20+ Android and iOS users via TestFlight and Google Play Console.
*   **App Build:** Build production binaries using `eas build --platform all`.

---

## Verification Plan

### Database & Backend
*   Launch Postgres migration scripts and test RLS rule boundaries.
*   Confirm PostGIS query speeds.

### Frontend Interface
*   Verify layout margins on tablet and mobile configurations.
*   Ensure smooth 60fps transitions and animations.
