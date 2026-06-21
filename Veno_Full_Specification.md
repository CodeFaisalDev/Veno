# VENO
## Blood Donation Platform — Complete Product Specification

---

| Field | Detail |
|---|---|
| Project | Veno — AI-Driven Blood Donor Matching |
| Team | Md. Bayazid Hossain · S M Golam Morshed Ehsan · Md. Faisal Sorkar |
| Supervisor | Md. Moshiur Rahman, Lecturer, Dept. of CSE |
| Session | 2020–2021 |
| Version | 1.0 — Full Specification |
| Date | June 2026 |

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Account & Onboarding](#2-user-account--onboarding)
3. [Donor Lifecycle — Complete State Machine](#3-donor-lifecycle--complete-state-machine)
4. [Blood Request Flow — Full Detail](#4-blood-request-flow--full-detail)
5. [Donor Response & Queue System](#5-donor-response--queue-system)
6. [Post-Donation Confirmation System](#6-post-donation-confirmation-system)
7. [Live Map & Location System](#7-live-map--location-system)
8. [Gamification System](#8-gamification-system)
9. [Digital Donor Card](#9-digital-donor-card)
10. [Notification Architecture](#10-notification-architecture--full-specification)
11. [Security & Data Privacy](#11-security--data-privacy)
12. [Eligibility Engine — Health Rules](#12-eligibility-engine--health-rules)
13. [Admin Panel](#13-admin-panel-web-based)
14. [Implementation Phases](#14-implementation-phases)
15. [Key User-Facing Settings Reference](#15-key-user-facing-settings-reference)

---

## 1. Product Overview

Veno is a cross-platform mobile application (Android & iOS) that connects people who need blood with eligible donors nearby in real time. It uses AI-powered matching, live geolocation, push notifications, and a gamification layer to make the process fast, trustworthy, and engaging — designed to operate at a governmental / institutional standard of reliability and data protection.

### 1.1 Core Design Philosophy

- Every state the app can be in — for every user, request, and notification — must be explicitly defined and handled.
- No user should ever be left confused: every screen has a clear status, every action has feedback, every background automation is communicated transparently.
- Sensitive data (NID, passport, medical reports) is treated with the same rigour as a banking application.
- The app must feel like an industry-grade governmental health platform — not a student project.

### 1.2 Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) — iOS & Android from single codebase |
| Backend | Supabase (PostgreSQL + PostGIS) — auth, database, real-time subscriptions, storage |
| AI Engine | Google Gemini API — medical OCR parsing, donor scoring, health chatbot |
| Maps | Google Maps SDK — live location, geofencing, Uber-style donor tracking |
| Notifications | Expo Push Notifications + FCM / APNs |
| Contact | Deep links — WhatsApp, Messenger, native phone dialer |
| QR Codes | expo-barcode-scanner + qrcode library for donor card generation/scanning |
| Security | AES-256 encrypted document vault, JWT auth, RBAC, HTTPS only, rate limiting |

---

## 2. User Account & Onboarding

### 2.1 Registration Flow

The registration is a single linear flow with progressive disclosure — no optional steps are skipped silently. Users must complete the mandatory steps before reaching the dashboard.

#### 2.1.1 Mandatory Registration Fields

| Field | Rule |
|---|---|
| Full name | As per NID — validated for minimum 3 characters, no special symbols |
| Phone number | BD format (+880…) — used as primary identifier and OTP target |
| Date of birth | Date picker — must be ≥ 18 years old to register as donor, enforced server-side |
| Blood group | Selector: A+, A−, B+, B−, AB+, AB−, O+, O− — cannot be changed after 7 days without admin review |
| Gender | Required — affects donation eligibility rules displayed to user |
| Division / district / upazila | Three-tier location selector — used as default request area |
| Password | Min 8 chars, 1 uppercase, 1 number, 1 symbol — bcrypt hashed, never stored in plain text |

#### 2.1.2 OTP Verification

| Item | Rule |
|---|---|
| OTP delivery | SMS to registered number — 6-digit code, valid for 10 minutes |
| Retry limit | Max 3 OTP requests per hour per phone number — beyond that, account locked for 1 hour with clear message |
| Resend timer | 60-second countdown before "Resend" button activates — prevents spam |
| Failure handling | After 5 wrong OTP entries: number temporarily blocked for 30 minutes — user notified |
| Change number | Not allowed mid-OTP flow — user must restart registration to avoid abuse |

#### 2.1.3 Identity Document Upload (Optional but Incentivised)

| Item | Behaviour / Rule |
|---|---|
| Accepted types | Bangladesh NID (front + back), Passport (photo page only), Birth Certificate (with guardian NID if under 18) |
| Storage | AES-256 encrypted, stored in a separate Supabase Storage bucket with strict access policy — never exposed to other users or AI training |
| Processing | Document image sent to Gemini Vision API for OCR name/DOB extraction only — result compared against registration fields, not stored as raw text |
| Verification badge | Green "Verified Identity" badge shown on donor card and profile if document matches registration data within acceptable tolerance |
| Failed match | User notified with specific mismatch field (e.g. "Name does not match") — they can re-upload or contact support. App still usable without verification. |
| Review period | Automated check takes ≤ 30 seconds — user sees a spinner with "Verifying your identity…" message |
| Re-upload | Allowed up to 3 times — after 3 failures, a "Contact Support" path is shown |
| Data deletion | Document files permanently deleted within 30 days of account deletion request — confirmed by email/SMS |

#### 2.1.4 Medical Report Upload (Optional)

| Item | Behaviour / Rule |
|---|---|
| Purpose | Allows AI to pre-fill health profile fields — hemoglobin, weight, last CBC date, known conditions |
| Accepted formats | JPG, PNG, PDF — max 10 MB per file, max 3 files per upload session |
| AI processing | Gemini Vision API extracts structured JSON: `{ hemoglobin, bloodPressure, weight, lastTestDate, flaggedConditions[] }` |
| User review | Extracted data is shown to user in an editable form **before** being saved — user must confirm or correct each field |
| Storage | Raw report files are **not** stored — only the confirmed JSON profile is persisted. Raw file deleted from server within 60 seconds of extraction. |
| Eligibility impact | Flagged conditions (e.g. active hepatitis, HIV, TB) automatically set `donorEligible` flag to false with note "See a medical professional before donating" |
| Re-upload | User can upload a new report at any time from profile settings — new AI extraction runs, user reviews and confirms before overwriting |
| No report | User can manually enter health fields or skip entirely — skipped fields shown as "Not provided" not "Unknown" |

---

## 3. Donor Lifecycle — Complete State Machine

This is one of the most critical systems in Veno. Every state transition must be logged, communicated to the user, and reversible (where appropriate).

> **KEY DESIGN RULE:** The app never silently changes a donor's opt-in status. Every automated state change triggers an in-app notification and a push notification explaining what changed and why. Users are always in control.

### 3.1 Donor States

| State | Description |
|---|---|
| `NOT_A_DONOR` | Default state for all new accounts. User has not opted in. Invisible to all blood requests. |
| `ACTIVE` | User opted in. Visible to nearby blood requests matching their blood group. Receives notifications. |
| `PAUSED` | User manually toggled "Pause donations" — e.g. travelling, busy. Invisible to requests but opt-in preference preserved. Different from opting out entirely. |
| `REQUEST_PENDING` | A blood request notification has been sent to this donor. They have not yet responded. |
| `IN_QUEUE` | Donor tapped "Accept" on a request. Their live location is now shared with the requester. They are in the acceptance queue. |
| `MATCHED` | Requester selected this donor from the queue. Donor receives confirmation. They are now expected to travel to donation site. |
| `COOLDOWN` | Donor completed a donation. Automatically opted out for 120 days. Invisible to all requests. Countdown displayed in profile. |
| `INELIGIBLE` | System or AI has flagged this donor as temporarily ineligible (e.g. medical report flag, failed health check). Requires manual review or re-upload to restore. |
| `SUSPENDED` | Admin-level suspension — e.g. repeated no-show after accepting, abuse reports. User notified with reason and appeal path. |

### 3.2 Opt-In / Opt-Out Automation Rules

#### 3.2.1 After a Successful Donation

- System state changes to `COOLDOWN` immediately when donor taps "Done" on the post-donation confirmation.
- `donorOptedIn` flag set to `false` in database — donor becomes invisible to all requests instantly.
- `donationCooldownUntil` timestamp set to: `NOW + 120 days` (exactly, using UTC server time, not device time).
- Push notification sent: *"Thank you for donating! You have been automatically paused from donation requests for 120 days to protect your health. You can re-enable on [date]."*
- In-app profile shows a countdown: *"You can donate again in X days (on [date])"*. Progress bar displayed.

#### 3.2.2 Auto Re-Enable Preference (User-Controlled)

| Item | Behaviour / Rule |
|---|---|
| Setting name | "Automatically re-enable me as a donor after my recovery period" |
| Default | **ON** — because most committed donors want this convenience |
| Location | Profile → Donation Settings → After Donation Behaviour |
| Behaviour when ON | On day 120 at 00:00 server time: `donorOptedIn` set back to `true`, state → `ACTIVE`, push notification: *"Your 120-day recovery period is complete! You are now active as a donor again."* |
| Behaviour when OFF | On day 120: `donorOptedIn` remains `false`. State → `NOT_A_DONOR`. Push notification: *"Your recovery period is complete. Tap here to re-enable yourself as a donor when you are ready."* |
| Changing the setting | User can change this setting at any point during the cooldown — the behaviour on day 120 follows whatever the setting is **at that moment**, not when it was originally set. |
| Edge case: setting changed to OFF on day 119 | System reads the setting on day 120 — user stays opted out. No retroactive opt-in. |

#### 3.2.3 Manual Opt-Out During Cooldown

- Already in `COOLDOWN`, so opt-in status is already false — no visible change to donor visibility.
- However, user **can** manually reset their auto-re-enable preference to OFF during this period.

#### 3.2.4 Manual Opt-Out at Any Other Time

| From State | Behaviour |
|---|---|
| From `ACTIVE` | State → `NOT_A_DONOR`. `donorOptedIn = false`. Invisible to requests immediately. Confirmation shown in app. |
| From `PAUSED` | State → `NOT_A_DONOR`. Pause preference cleared. |
| From `REQUEST_PENDING` | State → `NOT_A_DONOR`. The pending request notification is retracted from this donor's queue. Requester's donor list refreshes — this donor disappears. |
| From `IN_QUEUE` | Donor **cannot** opt out while in an active queue unless they first explicitly decline the request. This prevents ghost-accepts. App shows: *"You have accepted a request. Please respond to it first."* |
| From `MATCHED` | Donor can withdraw by tapping "I can no longer donate" — requester is immediately notified: *"Donor [first name] is no longer available. Please select another donor."* Queue reshuffles. |

#### 3.2.5 Pause Mode (Soft Unavailability)

| Item | Behaviour / Rule |
|---|---|
| Purpose | Different from full opt-out — user wants to stay a donor but is temporarily unavailable (e.g. travel, illness) |
| How to activate | Profile → "Pause donations" toggle — user sets optional return date |
| Scheduled resume | If user sets a return date, system auto-resumes on that date at 00:00 — push notification sent. If no date set, pause is indefinite until manually resumed. |
| Behaviour | State → `PAUSED`. User invisible to requests. `donorOptedIn` remains `true` internally (so auto-resume logic works). Request notifications suppressed. |
| Visibility | Profile shows "Paused until [date]" or "Paused indefinitely" with one-tap resume button. |
| Cooldown vs Pause | These are separate concepts. Cooldown **overrides** Pause — cooldown takes priority at all times. |

### 3.3 120-Day Cooldown — Edge Cases

| Case | Behaviour |
|---|---|
| What triggers the cooldown? | Only when donor taps "Done" on the post-donation follow-up notification. Not when matched. Not when they travel to the site. |
| What if donor never taps "Done"? | After 48h from match confirmation: system sends a reminder. After 72h with no response: request auto-closes, no cooldown applied. Requester sees *"Donor did not confirm completion."* |
| What if the donation didn't happen? | Requester can tap "Donation did not take place" from their request screen — this cancels the cooldown trigger. Donor returns to `ACTIVE` state. |
| Dispute | If donor tapped "Done" but requester says it didn't happen: both are flagged for admin review. Cooldown remains until review resolves. |
| Manual cooldown override | Only admins can manually shorten or waive a cooldown (e.g. data error). Audit log entry created. |
| Second donation attempt during cooldown | Impossible via normal flow — donor is invisible to requests. If somehow detected, admin flags account. |
| Overlapping cooldowns | Cannot happen — next cooldown can only start after previous ends, since donor cannot receive requests during cooldown. |

---

## 4. Blood Request Flow — Full Detail

### 4.1 Creating a Request

#### 4.1.1 Request Type Selection

| Type | Behaviour |
|---|---|
| For myself | Location auto-detected. Requester's own blood group pre-filled. Contact info pre-filled. |
| For someone else | Patient name required. Patient location required (manual pin or address). Patient blood group required. Relation to patient optional. |
| Anonymous request | **Not supported** — all requests require a verified phone number. Prevents abuse. |

#### 4.1.2 Request Form Fields

| Field | Rule |
|---|---|
| Blood group needed | Pre-filled if "for myself". Required. Cannot be blank. |
| Units needed | Number selector: 1–6 bags. System checks if enough donors are available for requested units. |
| Hospital / location | Searchable Google Maps field. Pin can be dragged for precision. Address stored as both text and lat/lng. |
| Live location | "Use my current location" toggle — if on, requester's pin updates every 30 seconds on the donor map view. |
| Urgency level | Low / Medium / **Critical** — Critical unlocks "Panic Broadcast" mode with wider radius (10 km vs 5 km) and higher notification priority. |
| Additional notes | Optional. 200-character limit. Shown on donor request detail screen. Filtered for sensitive content. |
| Contact visibility | Toggle: "Show my phone number to accepted donors only" (default) vs "Show to all nearby donors". Default is privacy-first. |

#### 4.1.3 Request Submission Rules

| Rule | Behaviour |
|---|---|
| 1 active request limit | A user can only have 1 active request at a time. If they try to create another: *"You have an active request. Please close it before creating a new one."* |
| Cooldown between requests | 2-hour cooldown after a request is closed (completed or cancelled) before a new one can be submitted — prevents abuse. |
| Blood group flexibility | If requested blood group has 0 donors in radius, system checks compatible groups and asks: *"No B+ donors nearby. Would you like to also notify compatible donors (O+, O−)?"* |
| Minimum donors available | If 0 donors exist in any radius: request is accepted but user sees *"No donors currently available nearby. Your request is saved and donors will be notified as they become active in your area."* |

### 4.2 AI Matching Engine

Once a request is submitted, the backend runs the following steps in sequence:

1. **Geofence filter** — PostGIS query finds all donors within 5 km (10 km for Critical urgency) of request location with matching blood group and `state = ACTIVE`.
2. **Eligibility filter** — Remove any donors whose `donationCooldownUntil > NOW` or who are `PAUSED`, `INELIGIBLE`, or `SUSPENDED`.
3. **AI scoring** — The filtered donor list (IDs, donation history, response rate, distance, health profile summary) is sent to Gemini API. Gemini returns a ranked list with scores.
4. **Score breakdown** — Distance (40%) + Donation history/reliability (30%) + Health profile suitability (20%) + Response rate on past requests (10%).
5. **Result** — Ranked donor list returned. Top 20 donors receive push notifications (or all if fewer than 20 available).

#### 4.2.1 AI Scoring Edge Cases

| Case | Behaviour |
|---|---|
| New donor (no history) | Donation history score defaults to neutral (50th percentile) — not penalised for being new. |
| Donor with no health profile | Health profile score defaults to neutral. App never penalises users for not uploading medical data. |
| Donor who frequently accepts but is never selected | Response rate score still counts positively — willingness to accept is valued. |
| Donor who ignores requests repeatedly | Response rate score decreases — they may drop in ranking but are never automatically removed from the donor pool. |
| Tie-breaking | Equal scores broken by proximity (shorter distance wins). |

### 4.3 Notification Delivery

| Item | Behaviour / Rule |
|---|---|
| Notification content | *"🩸 Blood needed nearby — [Blood Group] required at [Hospital/Area]. Tap to respond."* |
| Urgency: Critical | Notification uses a distinct urgent tone (not default). Marked as high-priority in FCM/APNs. |
| Notification deep link | Tapping notification opens the specific request detail screen directly — not the app home screen. |
| No-app fallback | If push notification fails (device offline): notification queued for up to 2 hours. After 2 hours it is discarded and donor is no longer shown for this request. |
| Duplicate guard | A donor cannot receive more than 1 notification per request — deduplicated by `requestId + userId`. |
| Notification grouping | If multiple requests arrive while phone is locked, grouped as *"3 blood requests nearby"* in notification tray. |
| User notification settings | User can set: notify always / notify between hours X–Y / never notify (but this effectively pauses them as a donor — app warns them of this). |

---

## 5. Donor Response & Queue System

### 5.1 Donor Request Detail Screen

| Item | Behaviour / Rule |
|---|---|
| Request info shown | Blood group, hospital/location name, distance from donor, urgency level, requester first name, units needed, time since request was posted, optional notes. |
| Map | Mini embedded map showing request pin and donor's current location with estimated walk/drive time. |
| Contact info | Phone number hidden at this stage — only revealed after donor is selected by requester. |
| Actions available | "Accept" (enters queue) / "Decline" (removes this request from donor's view) / "Remind me in 10 min" (snooze — re-notifies in 10 min if request still active). |

### 5.2 Queue Management

| Item | Behaviour / Rule |
|---|---|
| Queue visibility for requester | Requester sees a live-updating list of donors who accepted, ordered by AI rank. Each card shows: donor first name, blood group, verified badge, distance, ETA estimate, last donation date. |
| Queue visibility for donor | Donor sees *"You are in the queue — waiting for [Requester first name] to confirm."* with a queue position indicator (e.g. "Position 2 of 5 accepted donors"). |
| Live location sharing | Once a donor accepts (enters queue), their location is shared with the requester every 30 seconds. Only requester can see it — not other donors in queue. |
| Queue expiry | If requester takes no action for 30 minutes, a reminder is sent. After 60 minutes with no selection, the request auto-expires. All queued donors notified: *"This request has expired. Thank you for your willingness."* |
| Maximum queue size | 20 donors maximum in queue. Donors who tap Accept after the queue is full see: *"The queue is full. You will be notified if a spot opens."* |
| Queue waitlist | Donors beyond position 20 are placed on a waitlist — if a queued donor withdraws, the first waitlisted donor is auto-added and notified. |

### 5.3 Requester Selection

| Item | Behaviour / Rule |
|---|---|
| Selecting a donor | Requester taps a donor card → sees full detail → taps "Confirm this donor". One-step confirmation dialog with donor name and blood group shown. |
| After selection | Selected donor receives: *"You've been selected! [Requester name] needs blood at [Location]. Here are their contact details."* Full phone number now revealed. |
| Unselected donors | All other queued donors receive: *"Another donor has been selected for this request. Thank you for accepting — you may receive similar requests soon."* Queue cleared. |
| Changing selection | Requester can change their selection within 10 minutes of confirming, if the donor has not yet confirmed en-route. After 10 minutes or after donor confirms, selection is locked. |
| Multiple units needed | If request is for 2+ units, requester can select up to N donors (equal to units needed). Each selected donor follows the same flow independently. |

### 5.4 Contact Options Screen

| Item | Behaviour / Rule |
|---|---|
| Available contact methods | Phone call (native dialer), WhatsApp (deep link with pre-filled message), Messenger (deep link). |
| Pre-filled message | *"Hi, I am responding to your blood donation request on Veno. I am on my way to [Location]."* Available in Bengali and English based on user's app language setting. |
| In-app chat | Not included in v1 — avoids storing message content, reduces legal complexity. Deep links to existing apps are sufficient. |
| Contact info security | Donor's contact info is only visible to the requester who selected them — not to other donors or the general public. |

---

## 6. Post-Donation Confirmation System

### 6.1 Donation Confirmation Timeline

| Trigger | Behaviour |
|---|---|
| T+0 (selection confirmed) | Donor status → `MATCHED`. Timer starts. |
| T+2 hours | If no confirmation yet: push notification to donor: *"Did you make it to the donation? Tap to confirm."* |
| T+6 hours | Second reminder sent to both donor and requester. |
| T+24 hours (donor taps "Done") | Full donation completion flow runs (see 6.2). |
| T+48 hours (no response at all) | System auto-closes with status `UNCONFIRMED`. No cooldown applied. Requester shown: *"Donation outcome not confirmed. We hope the donation took place!"* Donor returns to `ACTIVE`. |
| Requester marks "did not happen" | Request closes. Donor returns to `ACTIVE`. No cooldown. Flagged for review if this occurs repeatedly with the same donor. |

### 6.2 What Happens When Donor Taps "Done"

| Item | Behaviour |
|---|---|
| State change | `COOLDOWN`. `donorOptedIn = false`. `donationCooldownUntil = NOW + 120 days`. Invisible to new requests instantly. |
| Profile update | `totalDonations + 1`. `lastDonationDate = TODAY`. `donationHistory[]` entry added with requestId, date, location, blood group. |
| Gamification | Points calculation runs (see Section 8). Badges checked and awarded. If leaderboard rank changes, notification sent. |
| Public profile | Donation count updated on donor card. Visible to future requesters when selecting from queue. |
| Push notification to donor | *"Thank you for saving a life! 🩸 Your donation has been recorded. Recovery pause: 120 days. Next eligible date: [date]. You've earned [X] points!"* |
| Push notification to requester | *"[Donor first name] has confirmed the donation. Thank you for using Veno."* Request marked as `COMPLETED`. |
| Auto-opt-in scheduler | System schedules a job for `donationCooldownUntil` date. On that date: reads `autoReenableAfterCooldown` preference and acts accordingly (see Section 3.2.2). |

---

## 7. Live Map & Location System

### 7.1 Map Modes

| Mode | Description |
|---|---|
| Home map (all users) | Shows anonymised heat map of recent blood requests in the city. No individual donor pins visible for privacy. |
| Requester tracking view | After selecting a donor: shows requester's own pin + selected donor's live moving pin (Uber-style). ETA countdown. Donor name shown. |
| Donor navigation view | After accepting a request: shows route to hospital/location. One-tap to open Google Maps / Apple Maps for turn-by-turn navigation. |
| Donor list map | On requester's queue screen: each accepted donor shown as an **approximate** pin (area-level, not exact address) until selected — protects donor privacy. |
| Post-match exact pin | Only after requester selects a donor does the donor's exact real-time location show on the map for that requester. |

### 7.2 Location Privacy Rules

| Rule | Behaviour |
|---|---|
| Donor location to requester (pre-match) | Area-level only (nearest 500 m grid snap). Requester sees approximate zone, not exact location. |
| Donor location to requester (post-match) | Exact real-time GPS. Updates every 30 seconds. Stops sharing when donor taps "Done" or request closes. |
| Donor location to other donors | **Never shared.** Donors cannot see each other's location at any point. |
| Location data retention | Live location data is streamed via Supabase Realtime and **not persisted** beyond the session. No location history stored. |
| Location permission handling | App explains why location is needed at each step. "While using app" permission requested — never "Always" (background) by default for donors. |
| Background location for donors | When donor has accepted a request, a persistent foreground notification keeps the session alive: *"Veno — You are en route to donate blood."* Location tracked while this notification is active. |

---

## 8. Gamification System

### 8.1 Points System

| Action | Points |
|---|---|
| Completing a donation | 500 pts |
| First donation ever | +200 bonus (one-time) |
| Accepting a request (even if not selected) | 20 pts — rewards willingness |
| Completing profile with NID verification | +100 pts (one-time) |
| Uploading medical report | +50 pts (one-time) |
| Donating within 1 hour of receiving request | +100 speed bonus |
| Donating for a Critical-urgency request | +150 bonus |
| Referral: friend joins and completes first donation | +300 pts |
| Points expiry | Points **do not expire** — lifetime accumulation |

### 8.2 Badge System

| Badge | Criteria |
|---|---|
| First Drop | Completed first donation |
| Swift Responder | Responded and donated within 1 hour of notification (3 separate times) |
| Life Saver ×5 / ×10 / ×25 / ×50 | Milestone badges for total donations |
| Critical Hero | Donated for 3 Critical-urgency requests |
| Verified Guardian | NID verified + medical report uploaded |
| Consistent Donor | Donated in 4 consecutive eligible windows (donated → recovered → donated again, 4 times in sequence) |
| Community Pillar | Referred 3 users who each completed at least 1 donation |
| Night Responder | Accepted and completed a donation between 10 PM and 6 AM |
| Badge visibility | Top 3 earned badges displayed on donor card visible to requesters — adds trust signal when selecting from queue |

### 8.3 Leaderboard

| Item | Behaviour / Rule |
|---|---|
| Scopes | District-level (default) / Division-level / National — user can switch view |
| Ranking metric | Total lifetime points (not just donation count — includes all engagement points) |
| Privacy | Leaderboard name is first name + last initial only (e.g. "Faisal S."). Full name never shown publicly. |
| Rank notification | Notification sent when user enters top 10 in their district: *"You are now ranked #7 in Narayanganj!"* |
| Opt out | User can opt out of public leaderboard visibility in Privacy Settings — they still earn points but don't appear on others' lists. |

---

## 9. Digital Donor Card

| Item | Behaviour / Rule |
|---|---|
| Contents | Full name, blood group (large, prominent), verified badge (if applicable), total donations, last donation date, next eligible date, top 3 badges, unique QR code. |
| QR code data | Encodes: `userId`, blood group, verified status, `lastDonationDate` — no sensitive personal data in QR payload. Server-side lookup on scan. |
| QR scanning | Any Veno user can scan another user's donor card QR. Shows a read-only public profile view. |
| Sharing | Card can be saved as a PNG image to device gallery or shared via any app (WhatsApp, etc.). Useful for hospital staff to quickly verify donor. |
| Offline access | Donor card is cached locally — accessible without internet for 7 days since last sync. Shows last-known data with "Last updated: [date]" label. |
| Cooldown indicator | If donor is in `COOLDOWN`, card shows a red banner: *"Currently in recovery — eligible again on [date]."* QR still scannable but shows ineligible status. |

---

## 10. Notification Architecture — Full Specification

### 10.1 Notification Types

| Type | Description |
|---|---|
| `REQUEST_NEARBY` | Blood request within donor's radius. Sent to top 20 matching donors. |
| `ACCEPTED_BY_DONOR` | Requester notified that a new donor accepted their request. |
| `SELECTED_BY_REQUESTER` | Donor notified they were selected. Contact info revealed. |
| `NOT_SELECTED` | Queued donors notified that another donor was chosen. |
| `DONATION_CONFIRMED` | Requester notified when donor taps "Done". |
| `COOLDOWN_START` | Donor notified of 120-day pause beginning. |
| `COOLDOWN_END_AUTO` | Donor notified they have been automatically re-enabled (if preference is ON). |
| `COOLDOWN_END_MANUAL` | Donor prompted to re-enable themselves (if preference is OFF). |
| `REQUEST_EXPIRED` | Sent to requester and all queued donors when a request auto-closes with no selection. |
| `DONATION_REMINDER` | Sent to matched donor at T+2h and T+6h if no "Done" tap. |
| `POINTS_EARNED` | Sent after gamification calculation completes. |
| `BADGE_UNLOCKED` | Sent immediately when a badge threshold is crossed. |
| `LEADERBOARD_RANK` | Sent when user enters top 10 in their district. |
| `PAUSE_SCHEDULED_RESUME` | Sent when user's scheduled pause end date arrives. |
| `SYSTEM_ALERT` | Admin-broadcast for app updates, maintenance, important health advisories. |

### 10.2 Notification Preferences

All notification types can be individually enabled or disabled in **Settings → Notifications**, except `SYSTEM_ALERT` which is always on. Default state for all other types: **ON**.

### 10.3 Do Not Disturb (DND) Integration

| Item | Behaviour / Rule |
|---|---|
| DND mode | User sets DND hours (e.g. 11 PM – 7 AM) in Notification Settings. |
| `REQUEST_NEARBY` during DND | Suppressed if urgency is Low or Medium. **Always delivered** if urgency is Critical — DND cannot block critical blood requests. |
| Other notifications during DND | Queued and delivered at DND end time in a batch. |
| Override message | If a Critical notification fires during DND: *"This request was sent during your quiet hours because it was marked Critical."* |

---

## 11. Security & Data Privacy

### 11.1 Data Classification

| Class | Contents | Protection |
|---|---|---|
| Class A — Highly sensitive | NID/Passport images, medical report files, exact real-time GPS | Encrypted at rest + in transit. Strict access logging. Never exposed via API without auth. |
| Class B — Sensitive personal | Full phone number, date of birth, health profile JSON, donation history | Encrypted at rest. Only accessible to the account holder and authorised admin roles. |
| Class C — Semi-public | First name + last initial, blood group, district, total donations, badges | Visible to other Veno users in appropriate contexts (donor card, queue list). |
| Class D — Public | Anonymised heat map data, aggregate statistics | No personal identifiers. |

### 11.2 Authentication & Access

| Item | Rule |
|---|---|
| Session tokens | JWT with 24-hour expiry. Refresh token with 30-day expiry. Both invalidated on password change or logout. |
| RBAC roles | `USER` (standard), `VERIFIED_USER` (NID verified), `ADMIN`, `SUPER_ADMIN`. Each role has explicit permission sets defined in database policy. |
| Device trust | New device login sends a push notification to existing registered devices: *"New login detected on [device name]."* User can invalidate other sessions. |
| API rate limiting | Authentication endpoints: 10 req/min. Blood request creation: 1 per 2 hours per user. General API: 300 req/min per authenticated user. |
| 1 active request rule | Enforced at **database level** via unique constraint — not just application level. Cannot be bypassed by multiple simultaneous API calls. |

### 11.3 Account Deletion

| Item | Behaviour |
|---|---|
| Trigger | User submits deletion request in Settings → Account → Delete Account. |
| Grace period | 14-day grace period — account deactivated (invisible) but not deleted. User can reactivate by logging in. |
| After 14 days | Hard delete: all Class A and Class B data permanently erased. Class C anonymised (blood group and district retained for aggregate statistics only). |
| Audit log | Deletion timestamp and confirming admin recorded. Proof of deletion available on request for regulatory compliance. |
| Active request during deletion | If user has an active request or is in a queue: deletion request is queued. App shows: *"Your deletion will process in 14 days. Your active request will be closed in 24 hours."* |

---

## 12. Eligibility Engine — Health Rules

The eligibility engine runs every time a donor is included in a search result. It is the last check before a donor is added to the notification list. All thresholds are configurable by admin without an app deployment.

| Rule | Behaviour |
|---|---|
| Minimum age | 18 years old. Checked against date of birth at registration. Enforced server-side. |
| Minimum weight | 50 kg recommended. If health profile present and weight < 45 kg: flagged `INELIGIBLE` with message to consult a doctor. |
| Hemoglobin | If health profile present: males < 13 g/dL, females < 12 g/dL → flagged as ineligible with note to consult doctor. |
| 120-day buffer | `donationCooldownUntil > NOW` → excluded from all searches. Hard rule, no exceptions. |
| Medication flags | If AI parsed conditions include anticoagulants, antibiotics (active course), chemotherapy → `INELIGIBLE` with expiry date if provided. |
| Infectious disease flags | HIV, Hepatitis B/C (active), TB (active), Malaria (within 3 months) → `INELIGIBLE` indefinitely until cleared by admin with new medical report. |
| Pregnancy | If user profile indicates pregnancy: automatically `INELIGIBLE` until 6 months post-delivery (user sets delivery date in profile). |
| Recent tattoo / piercing | If user self-reports (profile toggle): `INELIGIBLE` for 6 months from procedure date. |
| Recent surgery | If user self-reports: `INELIGIBLE` for 6 months or until medical clearance uploaded. |
| Flag messaging | Each ineligibility flag shows the user a specific, non-alarming message in profile: *"You are currently paused from donations due to [reason]. Expected re-eligibility: [date] or when cleared."* |

---

## 13. Admin Panel (Web-Based)

The admin panel is a separate web interface (not part of the mobile app) for Veno staff and institutional partners.

| Feature | Description |
|---|---|
| User management | View, search, suspend, unsuspend accounts. View verification status. Override eligibility flags with audit log entry. |
| Request monitoring | Live dashboard of all active requests, their status, donor queue sizes, and match rates. |
| Donation analytics | Total donations by district/month. Average response time. Top donors. Unmet request rate. |
| Notification broadcast | Send `SYSTEM_ALERT` to all users or filtered segments (by district, blood group, etc.). |
| Cooldown override | Admin can manually shorten or waive a 120-day cooldown with documented medical reason and audit log entry. |
| Dispute resolution | View flagged donation outcomes. Mark as confirmed/denied. Update donor and requester profiles accordingly. |
| Health rule configuration | Update eligibility thresholds (hemoglobin cutoffs, age minimums) without app deployment. |
| Data export | Anonymised aggregate exports for NGO/hospital partners and research use. No personally identifiable data in exports. |

---

## 14. Implementation Phases

| Phase | Timeline | Deliverables |
|---|---|---|
| Phase 1 | Weeks 1–3 | Requirements finalisation, database schema design, Supabase project setup with PostGIS, UI/UX wireframes for all screens. |
| Phase 2 | Weeks 4–7 | Auth system (OTP, JWT, RBAC), user profile CRUD, document upload + encrypted storage, blood request CRUD API, geofence radius query. |
| Phase 3 | Weeks 8–12 | React Native app: onboarding, dashboard, request creation, donor opt-in toggle, maps integration, donor state machine implementation. |
| Phase 4 | Weeks 10–13 | AI integration: Gemini medical OCR parser, donor scoring algorithm, health chatbot. Notification system: Expo Push + all 15 notification types. |
| Phase 5 | Weeks 13–15 | Queue system, live location sharing, Uber-style donor tracking map, contact deep links, post-donation confirmation flow. |
| Phase 6 | Weeks 14–16 | Gamification: points engine, badges, leaderboard. Digital donor card + QR generation/scanning. Offline card caching. |
| Phase 7 | Weeks 16–17 | Security audit: rate limiting, input validation, encryption review, RBAC policy review, penetration test simulation. |
| Phase 8 | Weeks 17–19 | Full testing: unit tests, integration tests, user acceptance testing with 20+ beta users. Performance testing under simulated load. |
| Phase 9 | Weeks 20–21 | Documentation, research paper, demo video, final submission. App store build preparation. |

---

## 15. Key User-Facing Settings Reference

Every setting that affects automated behaviour must be surfaced clearly in the app's Settings screen so users always understand and control what the app does on their behalf.

### Settings → Donation Preferences

| Setting | Options / Default |
|---|---|
| Auto re-enable after cooldown | ON / OFF — **default ON**. Controls whether app auto-opts back in after 120-day recovery. |
| Pause donations | Toggle with optional return date. Temporary unavailability without full opt-out. |
| Notification radius preference | Show requests within 3 km / 5 km / 10 km (affects what donor sees, not what requester targets). |
| Blood group display | Whether to show blood group on leaderboard entries and community features. |

### Settings → Notifications

| Setting | Options / Default |
|---|---|
| Per-type toggles | Each of the 15 notification types listed individually with on/off switch — **default all ON**. |
| DND hours | Set quiet window. Critical requests always break through regardless. |
| Notification language | Bengali / English (independent of app interface language). |

### Settings → Privacy

| Setting | Options / Default |
|---|---|
| Leaderboard visibility | Appear on public leaderboard: ON / OFF — **default ON**. |
| Contact visibility | Show phone to accepted donors only (default) / show to all nearby donors. |
| Location sharing confirmation | Confirm before sharing real-time location: ON / OFF — **default OFF** for speed. |
| Data download | Request a ZIP of all personal data — delivered within 48 hours to registered email. |
| Account deletion | Initiates 14-day grace period deletion flow. |

---

> **Final Note:** This specification covers every state, transition, edge case, automation rule, and user control in Veno v1. Before implementation of each section begins, the corresponding database schema tables and API contract should be agreed upon by the team and documented in a separate technical schema document.
