# VENO — UI Design System
## Complete Design Specification for AI Implementation

> Hand this file to any AI code generator (Cursor, Claude, Copilot, etc.) before writing a single component. Every decision here is final unless explicitly marked as optional. Follow it exactly.

---

## 1. Design Philosophy

Veno is built on a single design principle: **warm urgency**. It must feel as approachable and human as Airbnb — generous whitespace, soft surfaces, real photography energy — while carrying the quiet authority of a medical platform when a life is on the line. Nothing decorative earns its place unless it reduces cognitive load or builds trust.

The reference aesthetic is Airbnb circa 2023: rounded cards, a warm neutral base, one strong accent, typographic hierarchy that guides the eye without shouting. The medical layer adds a second system state — when a request is Critical, colour temperature shifts from warm to urgent without feeling alarming.

**Three words that must describe every screen:** Human. Clear. Trustworthy.

---

## 2. Colour System

### 2.1 Primitives (full palette — define these as CSS/RN variables first)

```
/* Reds — primary brand + urgency */
--red-50:  #FFF0F0
--red-100: #FFD6D6
--red-200: #FFB3B3
--red-300: #FF8080
--red-400: #FF4D4D
--red-500: #E63030   ← primary brand red (Veno logo, CTAs)
--red-600: #C01E1E
--red-700: #9A1010
--red-800: #740808
--red-900: #4F0303

/* Warm Neutrals — the Airbnb base */
--neutral-0:   #FFFFFF
--neutral-50:  #FAF9F7   ← light mode page background
--neutral-100: #F2F0EC   ← light mode card surface
--neutral-200: #E8E5DF   ← dividers, borders (light)
--neutral-300: #D4D0C8
--neutral-400: #A8A39A
--neutral-500: #787269
--neutral-600: #4D4842
--neutral-700: #322E29
--neutral-800: #1E1B17   ← dark mode card surface
--neutral-850: #161310   ← dark mode page background
--neutral-900: #0D0B09

/* Greens — success, active donor, confirmed */
--green-50:  #EFFBF4
--green-100: #C8F0D8
--green-400: #34B56A
--green-500: #1F9952   ← success primary
--green-600: #157A40
--green-800: #093D20

/* Ambers — pending, in-queue, warning */
--amber-50:  #FFFBEB
--amber-100: #FEF0C0
--amber-400: #FBB834
--amber-500: #E69B10   ← warning primary
--amber-600: #B87A08
--amber-800: #5C3C04

/* Blues — informational, maps, links */
--blue-50:  #EFF6FF
--blue-100: #DBEAFE
--blue-400: #60A5FA
--blue-500: #3B82F6   ← info primary
--blue-600: #2563EB
--blue-800: #1E3A8A

/* Overlay */
--overlay-light: rgba(0, 0, 0, 0.04)
--overlay-medium: rgba(0, 0, 0, 0.40)
--overlay-heavy: rgba(0, 0, 0, 0.72)
```

### 2.2 Semantic Tokens (use these in components, never raw primitives)

```
/* Backgrounds */
--bg-page:          var(--neutral-50)       / dark: var(--neutral-850)
--bg-surface:       var(--neutral-0)        / dark: var(--neutral-800)
--bg-surface-raised: var(--neutral-0)       / dark: var(--neutral-750) ← modals, sheets
--bg-subtle:        var(--neutral-100)      / dark: var(--neutral-700)
--bg-overlay:       var(--overlay-medium)

/* Text */
--text-primary:     var(--neutral-900)      / dark: var(--neutral-50)
--text-secondary:   var(--neutral-500)      / dark: var(--neutral-400)
--text-tertiary:    var(--neutral-400)      / dark: var(--neutral-500)
--text-on-color:    var(--neutral-0)        ← always white (on red/green/amber buttons)
--text-link:        var(--red-500)          / dark: var(--red-400)

/* Borders */
--border-subtle:    var(--neutral-200)      / dark: var(--neutral-700)
--border-default:   var(--neutral-300)      / dark: var(--neutral-600)
--border-strong:    var(--neutral-400)      / dark: var(--neutral-500)

/* Brand */
--brand:            var(--red-500)
--brand-hover:      var(--red-600)
--brand-subtle:     var(--red-50)           / dark: var(--red-900)
--brand-text:       var(--red-600)          / dark: var(--red-300)

/* Status */
--status-active:    var(--green-500)
--status-active-bg: var(--green-50)         / dark: var(--green-800)
--status-active-text: var(--green-600)      / dark: var(--green-100)

--status-pending:   var(--amber-500)
--status-pending-bg: var(--amber-50)        / dark: var(--amber-800)
--status-pending-text: var(--amber-600)     / dark: var(--amber-100)

--status-critical:  var(--red-500)
--status-critical-bg: var(--red-50)         / dark: var(--red-900)
--status-critical-text: var(--red-600)      / dark: var(--red-200)

--status-cooldown:  var(--neutral-400)
--status-cooldown-bg: var(--neutral-100)    / dark: var(--neutral-700)
--status-cooldown-text: var(--neutral-600)  / dark: var(--neutral-300)

--status-info:      var(--blue-500)
--status-info-bg:   var(--blue-50)          / dark: var(--blue-800)
--status-info-text: var(--blue-600)         / dark: var(--blue-100)
```

### 2.3 Dark Mode Implementation

React Native: use `useColorScheme()` from `react-native` and a `ThemeContext` that provides the correct token values. Every component reads from context — never hardcodes hex.

Web (if needed): Use `@media (prefers-color-scheme: dark)` CSS variables. HTML root gets `data-theme="dark"` when user overrides.

---

## 3. Typography

### 3.1 Font Stack

**Primary — DM Sans**
```
import { DM_Sans } from 'expo-google-fonts'
weights used: 400 (Regular), 500 (Medium), 600 (SemiBold)
```
Why: DM Sans has the same warm geometric neutrality as Airbnb's Cereal — rounded terminals, high x-height, reads well at small sizes, never clinical.

**Mono — DM Mono** (for blood group labels, countdown timers, codes only)
```
import { DM_Mono } from 'expo-google-fonts'
weight: 500 only
```

### 3.2 Type Scale

```
/* Display — hero screens only (splash, empty states) */
--text-display:    32px / 38px line-height / SemiBold (600)

/* Heading 1 — screen titles */
--text-h1:         24px / 30px / SemiBold (600)

/* Heading 2 — section headers within a screen */
--text-h2:         20px / 26px / SemiBold (600)

/* Heading 3 — card titles, list group headers */
--text-h3:         17px / 22px / Medium (500)

/* Body Large — primary reading text, descriptions */
--text-body-lg:    16px / 24px / Regular (400)

/* Body — default body, list items */
--text-body:       15px / 22px / Regular (400)

/* Body Small — meta, timestamps, helper text */
--text-body-sm:    13px / 18px / Regular (400)

/* Caption — labels above fields, section eyebrows */
--text-caption:    12px / 16px / Medium (500) / letter-spacing: 0.4px

/* Blood Group — mono, always uppercase, prominent */
--text-blood:      22px / DM Mono / Medium (500)

/* Badge — status pills */
--text-badge:      11px / Medium (500) / letter-spacing: 0.3px / uppercase
```

### 3.3 Typography Rules

- **Never use font-weight 700 (Bold) or higher.** SemiBold (600) is the heaviest weight in the system. Bold feels shouty in a health context.
- Blood group labels (A+, O−, etc.) always render in DM Mono. They are clinical identifiers, not copy.
- All screen titles use --text-h1, left-aligned. Never centred screen titles except on onboarding/splash.
- Section eyebrow labels (e.g. "NEARBY DONORS", "YOUR REQUESTS") use --text-caption, --text-secondary colour, uppercase, tracked.
- Sentence case everywhere. The only exceptions: blood group labels, QR codes, status badge abbreviations (e.g. "O+", "B−").

---

## 4. Spacing & Layout

### 4.1 Spacing Scale

```
--space-1:   4px
--space-2:   8px
--space-3:   12px
--space-4:   16px    ← base unit
--space-5:   20px
--space-6:   24px
--space-8:   32px
--space-10:  40px
--space-12:  48px
--space-16:  64px
```

### 4.2 Layout Grid

```
Screen horizontal padding:   16px (--space-4) on all screens
Max content width:           none — full bleed on mobile
Section vertical gap:        24px (--space-6) between major sections
Card gap in a list:          12px (--space-3)
Intra-card padding:          16px (--space-4)
Bottom nav safe area:        80px (nav height) + platform safe area inset
```

### 4.3 Border Radius

```
--radius-sm:   6px    ← badges, status pills, small chips
--radius-md:   10px   ← input fields, small buttons, tags
--radius-lg:   16px   ← cards, list items, bottom sheets
--radius-xl:   24px   ← floating action buttons, profile photos, large hero cards
--radius-full: 9999px ← avatar circles, toggle tracks
```

---

## 5. Elevation & Shadow

Veno uses elevation **very sparingly**. The Airbnb principle: most surfaces are flat and separated by colour/border. Shadows only appear for floating elements.

```
/* No elevation — default. Surfaces separated by --border-subtle */
elevation-0: none

/* Subtle — cards slightly above page (light mode only) */
elevation-1: 0px 1px 3px rgba(0,0,0,0.06), 0px 1px 2px rgba(0,0,0,0.04)

/* Raised — bottom sheets, dropdown menus */
elevation-2: 0px 4px 16px rgba(0,0,0,0.10), 0px 2px 6px rgba(0,0,0,0.06)

/* Floating — FABs, toasts, modals */
elevation-3: 0px 12px 32px rgba(0,0,0,0.14), 0px 4px 12px rgba(0,0,0,0.08)
```

Dark mode: **all shadows removed.** Dark surfaces separate via border and background colour difference only. Never render shadows on dark backgrounds — they disappear and leave a faint haze.

---

## 6. Component Library

### 6.1 Button

**Primary (CTA — request blood, confirm, done)**
```
background: --brand (#E63030)
text: --text-on-color (#FFFFFF)
font: --text-body-lg / SemiBold
height: 52px
border-radius: --radius-md (10px)
padding: 0 24px
active state: scale(0.98) + brightness(0.92)
disabled: opacity 0.40, no interaction
```

**Secondary (outline)**
```
background: transparent
border: 1.5px solid --border-default
text: --text-primary
same size as primary
active: background --bg-subtle
```

**Ghost (low emphasis — skip, cancel)**
```
background: transparent
border: none
text: --text-secondary
padding: 0 16px
active: text --text-primary
```

**Destructive (decline, withdraw)**
```
Same shape as primary
background: transparent
border: 1.5px solid --status-critical (red)
text: --status-critical-text
active: background --status-critical-bg
```

**Icon button**
```
width: 44px / height: 44px (minimum tap target)
border-radius: --radius-full
background: --bg-subtle
icon: 20px, --text-secondary
active: background --border-subtle
```

**Loading state (all buttons):** Replace label with 3-dot animated loader. Width does not change (prevents layout shift). Never show a spinner that expands the button.

### 6.2 Input Field

```
height: 52px
border-radius: --radius-md
border: 1.5px solid --border-subtle
background: --bg-surface
padding: 0 16px
font: --text-body / Regular

states:
  focused:  border-color --brand, no shadow (clean Airbnb style)
  filled:   border-color --border-default
  error:    border-color --status-critical + error message below in --status-critical-text + 13px
  disabled: background --bg-subtle, opacity 0.5
```

**Floating label pattern** (Airbnb-style): Label starts centred in the field. On focus or when filled, it animates to a 12px caption above the input within the border. Use `react-native-floating-label` or implement with Animated API. This is mandatory for all text inputs.

**Field helper text:** 13px, --text-secondary, 4px below field. Error text replaces helper text, never stacks.

### 6.3 Card

**Standard card**
```
background: --bg-surface
border-radius: --radius-lg (16px)
border: 1px solid --border-subtle  ← light mode only
padding: 16px
elevation: elevation-1 (light mode only)
```

**Donor card (in queue/list)**
```
Same as standard card +
left border accent: 3px solid [status colour]
  ACTIVE:   --status-active
  PENDING:  --status-pending
  MATCHED:  --brand
layout: row — avatar (40px) | name + blood group + meta | trailing action
```

**Request card (requester's view)**
```
Background: --bg-surface
Top section: full-bleed mini map (120px height, rounded-top-lg)
Below map: content at 16px padding
Blood group shown in --text-blood (DM Mono, 22px, --brand colour if critical)
Urgency badge top-right corner of map section (absolute positioned)
```

**Stats/metric card (gamification, profile)**
```
background: --bg-subtle
border-radius: --radius-md
padding: 16px
Label: --text-caption / --text-secondary
Value: 28px / SemiBold / --text-primary
No border. No shadow.
```

### 6.4 Status Badge / Pill

```
height: 24px
padding: 0 10px
border-radius: --radius-sm (6px)
font: --text-badge (11px / Medium / uppercase / tracked)

Colour mapping:
  ACTIVE:    bg --status-active-bg   / text --status-active-text
  PAUSED:    bg --status-cooldown-bg / text --status-cooldown-text
  PENDING:   bg --status-pending-bg  / text --status-pending-text
  MATCHED:   bg --brand-subtle       / text --brand-text
  COOLDOWN:  bg --status-cooldown-bg / text --status-cooldown-text
  CRITICAL:  bg --status-critical-bg / text --status-critical-text
  VERIFIED:  bg --status-active-bg   / text --status-active-text
  IN QUEUE:  bg --status-pending-bg  / text --status-pending-text
```

### 6.5 Avatar

```
sizes:
  sm:  32px diameter — queue list thumbnails
  md:  44px diameter — card leading element
  lg:  64px diameter — profile screen
  xl:  96px diameter — expanded profile

style: circular (border-radius --radius-full)
fallback (no photo): initials in DM Sans Medium 500
  background: derived from name hash → one of 6 warm palette values
  text: always --text-on-color (white)
  never use red for fallback avatar — reserved for blood group accent

border: 2px solid --bg-surface (creates separation from card bg in dark mode)
```

### 6.6 Blood Group Label

This is the most recognisable element in Veno. Treat it as a branded typographic object.

```
font: DM Mono / 500 / size varies by context:
  in card heading:  22px
  in list item:     17px
  in donor card:    28px
  on digital card:  42px

colour:
  default:    --text-primary
  for request (urgency-aware):
    Low:      --text-primary
    Medium:   --brand (#E63030)
    Critical: --status-critical with animated pulse ring

background chip (optional, when blood group needs to stand out):
  background: --brand-subtle
  text:       --brand
  padding:    4px 10px
  radius:     --radius-sm
  font:       DM Mono / 500

Never abbreviate or change case. A+ is always "A+" not "a+" or "A positive".
```

### 6.7 Map Component

The map is the heart of the donor tracking experience. Treat it like Airbnb treats listing maps — immersive, accurate, minimal UI on top.

```
Map style: Custom Google Maps style (see Section 7 for JSON)
  light mode: warm greige base, muted POIs, roads in neutral-200
  dark mode:  charcoal base (#1A1814), roads in neutral-700, water in neutral-800

Donor pins (on map):
  shape: circle 44px diameter
  border: 3px solid --bg-surface (card separation)
  content: donor avatar (photo or initials)
  status ring: animated concentric circle
    IN_QUEUE:  --status-pending pulsing ring
    MATCHED:   --status-active solid ring
    CRITICAL:  --brand pulsing ring (faster animation)

Request pin:
  shape: teardrop marker (standard) 48px tall
  fill: --brand (#E63030)
  icon: blood drop (white) centred
  bounce animation on initial placement

User location pin:
  24px blue circle with white dot centre + 60px semi-transparent blue radius ring
  matches Google Maps style — users recognise it instantly

Map overlays:
  Geofence radius circle:
    stroke: --brand at 40% opacity
    fill: --brand at 8% opacity
    dashed stroke (4px dash, 4px gap)

  Donor-to-request route line (post-match):
    colour: --brand
    width: 3px
    line-cap: round

Controls positioning:
  "My location" button: bottom-right, 60px above bottom edge
  Zoom controls: hidden (pinch-to-zoom only, matches Airbnb Maps pattern)
  Map type toggle: hidden
  All overlaid UI cards: position absolute, bottom-up layout
```

### 6.8 Bottom Sheet

Used for: request details, donor profiles, contact options, confirmations.

```
background: --bg-surface-raised
border-radius: 24px 24px 0 0 (top corners only)
elevation: elevation-3

Handle bar:
  width: 36px / height: 4px
  background: --border-default
  border-radius: --radius-full
  centred, 12px from top

Snap points:
  collapsed: 40% screen height (shows summary)
  expanded:  90% screen height (full detail)
  full:      100% - status bar (edge-to-edge, rare)

Backdrop: --overlay-medium behind sheet when expanded
Dismiss: swipe down or tap backdrop
```

### 6.9 Bottom Navigation Bar

```
height: 60px + platform safe area inset
background: --bg-surface
border-top: 1px solid --border-subtle
elevation: elevation-2 (subtle, navigation is floating)

tabs:
  Home (map icon)
  Requests (blood drop icon)
  Donate toggle (centre — special treatment, see below)
  History (clock icon)
  Profile (person icon)

Centre tab — "Donate" toggle:
  This is the app's primary action. Elevated treatment.
  background: --brand
  border-radius: --radius-full
  size: 56px (extends above nav bar by 8px)
  icon: power/toggle icon (white, 24px)
  active state (opted in): --brand with white icon
  inactive state (opted out): --bg-subtle with --text-tertiary icon
  long-press: shows tooltip "Toggle your donor availability"

Active tab indicator:
  not underline — active icon fills to SemiBold weight, label appears below
  icon colour: --brand when active, --text-tertiary when inactive
  label: 10px / Medium, only visible on active tab
```

### 6.10 Toast / Notification Banner

```
in-app toast (action feedback):
  position: top of screen, below status bar
  background: --neutral-900 (both modes)
  text: --neutral-0
  border-radius: --radius-md
  padding: 12px 16px
  max-width: screen - 32px
  slide-down animation (not fade — more decisive)
  auto-dismiss: 3 seconds
  icons: leading icon for type (✓ success, ! warning, ✕ error)

Critical request banner (overrides toast):
  full-width, red background (--brand)
  persistent — does not auto-dismiss
  text: --text-on-color
  pulsing left border (3px animated)
  action button: "Respond" (ghost, white text)
```

---

## 7. Screen-by-Screen Specifications

### 7.1 Splash / Intro Screen

```
background: --brand (#E63030)  ← full bleed red, only screen to use this
logo: VENO wordmark — white, DM Sans SemiBold, 40px, centred
tagline: "Blood. When it matters." — white, --text-body-lg, centred, below logo
animation: logo fades in (400ms), tagline slides up (600ms, 200ms delay)
transition: cross-fade to onboarding at 1.8s
```

### 7.2 Onboarding (3 screens)

```
Layout: full-height illustration top half / content bottom half
illustration area: 55% screen height, warm background (--neutral-100 / dark --neutral-800)
  illustrations: flat geometric style — no photographs, no 3D
  palette: match brand but warm (coral, soft red, cream)

content area: white card (--bg-surface), top border-radius 28px, covers bottom half
  pagination dots: 6px circles, --brand for active, --border-default for inactive
  headline: --text-h1
  body: --text-body / --text-secondary
  CTA: Primary button, full width

Screen 1 — "Find donors in minutes"
Screen 2 — "Opt in. Save lives."
Screen 3 — "Your health, protected." (covers data privacy)
```

### 7.3 Registration / Login

```
Overall: white background, no illustration (focus on form)
Back button: top-left, icon only
Progress bar: thin (3px) --brand bar below status bar, fills across steps
Step indicator: "Step 2 of 4" in --text-caption / --text-secondary, below bar

Form layout: single column, 24px between fields
Field spacing rule: label → field → helper/error — never stack two fields without a label
CTA: pinned to bottom of screen above keyboard (KeyboardAvoidingView)
```

### 7.4 Home Screen (Map-First)

```
Map: full-bleed, extends under status bar (edge-to-edge)
Status bar: transparent, light/dark icons depending on map brightness

Header overlay (top, absolute):
  blur background: --bg-surface at 85% opacity + blur(12px)
  border-radius: 0 0 16px 16px
  content: "Good morning, Faisal" (--text-h3) + city name + notification bell icon
  height: ~80px

Request blood FAB (floating action button):
  position: bottom-right, 80px above bottom nav
  label: "Request Blood" (not just icon — this is a critical action)
  background: --brand
  text: white, --text-body / SemiBold
  icon: blood drop (leading)
  border-radius: --radius-full
  elevation: elevation-3
  width: auto (hugs content) + 24px horizontal padding

Active request card (shows if user has a live request):
  Sticky card at bottom, above nav
  left: blood group chip + "Waiting for donors..."
  right: number of donors who accepted (animated counter)
  tap → expands to request detail bottom sheet
  background: --bg-surface / elevation-2

Donor count widget (when opted in):
  small floating chip (top-left of map)
  "12 donors active near you"
  background: --bg-surface at 90% opacity
  border-radius: --radius-full
  font: --text-body-sm
```

### 7.5 Blood Request Creation Screen

```
Presentation: bottom sheet, expands to 90% height on first step

Step 1 — Who needs blood?
  Two large tappable cards (full width each):
  Card A: "For me"     — icon: person, pre-fills user's blood group
  Card B: "For someone else" — icon: people, opens extra fields

  Card styling:
    border: 2px solid --border-subtle
    selected state: border-color --brand + --brand-subtle background
    border-radius: --radius-lg
    padding: 20px
    icon: 32px, --text-secondary (--brand when selected)

Step 2 — Details
  Blood group selector:
    Horizontal scroll row of 8 chips (A+, A−, B+, B−, AB+, AB−, O+, O−)
    chip: 52px × 36px / DM Mono / --radius-md
    selected: --brand bg / white text
    unselected: --bg-subtle / --text-secondary

  Units needed: stepper (− [n] +), not a text input
  Location: Google Places autocomplete input
  Urgency: segmented control (Low | Medium | Critical)
    Critical segment: --brand background when selected + shake micro-animation to signal weight

Step 3 — Review & Send
  Summary card (read-only)
  "Send Request" CTA — primary, full width
  Below button: "Notifying donors within 5km" (italic, --text-caption, --text-secondary)
  Critical urgency shows: "Notifying donors within 10km" + red tint on the text
```

### 7.6 Donor Queue Screen (Requester's View)

```
Header: map (200px height) showing live donor pins + request location
         — this map is interactive (pannable)

Below map: "X donors responded" heading + list

Donor list item:
  layout: [ avatar 40px ] [ name + blood group row ] [ distance + ETA ] [ Select button ]
  left accent: 3px --status-active vertical bar
  blood group: DM Mono, 15px, --brand
  Select button: secondary outline, "Select" label, 80px wide
  Verified badge: small green tick after name if NID verified

  AI rank indicator (top donor):
    do NOT show a numeric rank — no "Match score: 94%"
    instead: top donor card has a subtle "Best match" tag (--status-active chip)
    shows the system is smart without feeling algorithmic

Selecting a donor:
  tap "Select" → confirmation bottom sheet (not modal)
  shows donor's name, blood group, distance, verified status
  two buttons: "Confirm [Name]" (primary) / "Cancel" (ghost)

Empty state (no donors yet):
  illustration: minimal — two intersecting circles (one red, one grey)
  heading: "Waiting for donors"
  body: "We've notified 12 donors nearby. You'll see them here when they respond."
  animated pulse on the heading dots
```

### 7.7 Donor Notification Response Screen

```
Triggered by tapping push notification → opens this screen

Full-screen design (not sheet — this needs full attention):
  Map: top 50%, shows route from donor's current location to request site
  Content: bottom 50%

Content area:
  Blood group chip: large, prominent (DM Mono, 28px)
  Hospital name + distance + ETA
  Urgency badge
  Requester first name: "[Name] needs your help"
  Optional notes (if provided)

Actions (bottom, above safe area):
  "Accept" — primary, full width, --brand
  "Decline" — ghost, full width, --text-secondary
  "Remind me in 10 min" — small text link, --text-tertiary, between the two buttons
```

### 7.8 Post-Match / En Route Screen

```
Full-screen map (Uber-style tracking)
Map style: same custom style but reduced POI density (focus on route)

Bottom card (persistent, non-dismissable):
  drag handle at top
  Requester's first name + hospital name (--text-h3)
  ETA countdown: large, DM Mono ("12 min away")
  Three contact buttons in a row:
    [ 📞 Call ]  [ WhatsApp ]  [ Messenger ]
    each: icon + label, secondary style, equal width

  "I can no longer donate" — destructive text link below contacts
    on tap: confirmation dialog before executing (prevents accidental tap)

Top-left chip:
  "You are matched" in --status-active chip
  small animated green dot (breathing animation)
```

### 7.9 Post-Donation Confirmation Screen

```
Triggered by notification or from profile

Celebratory but calm — not overly exuberant:
  Illustration: simple concentric circles radiating from a blood drop (CSS animation, not lottie)
  Heading: "Did you donate today?"
  Body: "Tap Done to record your donation and start your recovery period."

Two large buttons:
  "Done — I donated" — primary
  "Donation didn't happen" — destructive outline

After tapping "Done":
  Transition to success state (same screen, no navigation)
  Heading: "Thank you, [First Name]."
  Body: "You may have just saved a life. Your next donation window opens on [date]."
  Points earned: large number, DM Mono, --brand colour, fades in
  Badges unlocked (if any): horizontal chip row, slide in from right
  "Continue" ghost button (single action, no other options — let the moment breathe)
```

### 7.10 Profile Screen

```
Header section (not a card — blends with page bg):
  avatar: 80px, --radius-full
  name: --text-h2
  "Verified" badge (if applicable): --status-active chip
  blood group: DM Mono, 22px, --brand chip
  stats row: [ Donations ] [ Points ] [ Streak ] — three equal metric cards

Donor toggle section:
  large, prominent card (--bg-surface, --radius-lg)
  left: "Donor Status" label (--text-h3) + current state badge
  right: large iOS-style toggle (custom, uses --brand for on state)
  below toggle: state-aware helper text
    ACTIVE:    "You're visible to nearby blood requests"
    PAUSED:    "Paused until [date]"
    COOLDOWN:  "Recovery ends in [X] days" + progress bar (--brand fill, --bg-subtle track)
    NOT DONOR: "Off — tap to opt in"

Settings list (after donor section):
  Standard Airbnb-style list: [ icon ] [ label ] [ trailing chevron or value ]
  sections: Donation Preferences / Notifications / Privacy / Account
  visual separator between sections: --text-caption eyebrow label above each group
  row height: 52px / icon 20px --text-secondary / label --text-body / trailing --text-secondary
```

### 7.11 Digital Donor Card Screen

```
Card component (treat like a physical card — portrait, 320px × 200px):
  background: linear gradient (--brand gradient: #E63030 → #9A1010)  ← ONLY use gradient here
  border-radius: --radius-xl (24px)
  all text: white

  layout:
    top-left: VENO wordmark (white, 14px)
    top-right: verified badge icon (white tick on semi-transparent circle)
    centre: blood group (DM Mono, 48px, white, bold)
    below blood group: donor's full name (DM Sans, 16px, white 80% opacity)
    bottom-left: "Donations: [n]" + "Since [year]" (12px, white 70%)
    bottom-right: QR code (white module on transparent background, 56px × 56px)

Outside the card (on page):
  "Next eligible: [date]" or cooldown progress bar
  Share button (secondary, below card)
  "Scan a card" button (secondary, below Share)
  last updated timestamp (--text-caption, --text-tertiary)
```

---

## 8. Motion & Animation

### 8.1 Principles

- Animations serve navigation feedback and status communication. They are never decorative.
- Duration is short. Users in a blood request emergency do not have patience for long animations.
- Use `react-native-reanimated` for all animations (not Animated API) — performance critical for map screens.

### 8.2 Duration Scale

```
--duration-instant: 80ms   ← button press, tap feedback
--duration-fast:   150ms   ← state changes, badge updates
--duration-base:   250ms   ← screen transitions, card expansions
--duration-slow:   400ms   ← bottom sheet open/close, onboarding
--duration-crawl:  600ms   ← intro sequence, empty state illustrations
```

### 8.3 Easing

```
--ease-standard:   cubic-bezier(0.4, 0, 0.2, 1)   ← most transitions
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1)      ← elements entering screen
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1)      ← elements leaving screen
--ease-spring:     spring(1, 100, 10, 0)            ← button presses, toggles
```

### 8.4 Specific Animations

```
Donor pin pulsing ring (ACTIVE state):
  scale: 1 → 1.8 → 1 / opacity: 0.8 → 0 / loop
  duration: 2000ms / ease: ease-out
  do NOT run this animation for more than 5 pins simultaneously — performance

Critical urgency pulse (request pin):
  scale: 1 → 1.4 → 1 / loop
  duration: 800ms (faster than donor pins — signals urgency)

Donor toggle (profile page):
  spring animation: stiffness 200, damping 20
  background colour cross-fades: 250ms

Points counter (post-donation):
  number animates from previous value to new value
  duration: 1200ms / ease-in-out
  stops at new value, no bounce

Bottom sheet:
  slide up: 400ms / --ease-decelerate
  dismiss: 300ms / --ease-accelerate

Toast (in-app notification):
  slide down from top: 250ms / --ease-decelerate
  auto-dismiss: slide up: 200ms / --ease-accelerate

Screen transitions:
  stack push: slide left (new screen) / slide left to offscreen (old) — 300ms
  sheet dismiss: scale(0.95) + fade on background — 300ms
  tab switch: cross-fade only (no slide) — 150ms

Skeleton loaders (while fetching):
  shimmer: gradient sweeps left to right, 1400ms loop
  colour: --bg-subtle → --border-subtle → --bg-subtle
  apply to: donor cards, map tiles, profile stats
```

### 8.5 Reduced Motion

Respect `AccessibilityInfo.isReduceMotionEnabled()`. When true:
- All pulsing animations: disabled
- All slide transitions: replaced with instant cross-fades
- Points counter: jumps immediately to final value
- Bottom sheet: appears instantly

---

## 9. Iconography

**Icon library: Phosphor Icons** (React Native: `phosphor-react-native`)
Why: Phosphor has a warm, rounded style that matches DM Sans. The "Regular" weight is the default for all icons at 20–24px. Use "Bold" weight only for the bottom nav active state.

```
Navigation:
  Home:     House (Regular)
  Requests: Drop (blood drop)
  Donate:   Power (centre FAB toggle)
  History:  ClockCounterClockwise
  Profile:  UserCircle

Actions:
  Send request:    Drop + ArrowRight
  Call:            Phone
  WhatsApp:        (custom SVG — brand icon, no Phosphor equivalent)
  Messenger:       (custom SVG — brand icon)
  Location pin:    MapPin
  Accept:          CheckCircle
  Decline:         XCircle
  Share:           ShareNetwork
  QR scan:         QrCode
  Notification:    Bell / BellRinging (unread)
  Settings:        GearSix
  Verified:        SealCheck (fill, --status-active colour)
  Blood group:     Drop (fill)
  Donation done:   HeartStraight (fill, --brand)
  Cooldown:        Hourglass
  Edit:            PencilSimple
  Back:            ArrowLeft
  Close:           X
  Chevron:         CaretRight
```

**Sizing:**
```
nav bar:        24px
card leading:   20px
list row:       20px
button leading: 20px
inline:         16px
large hero:     48px (empty states only)
```

**Colour:**
- Default: --text-secondary
- Active/interactive: --text-primary or --brand depending on context
- On coloured backgrounds: always white (--text-on-color)
- Never use icon colour alone to convey state — always pair with a label or badge

---

## 10. Google Maps Styling JSON

Apply via `customMapStyle` prop on `MapView`.

### Light Mode
```json
[
  { "elementType": "geometry", "stylers": [{ "color": "#F5F2ED" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#F5F2ED" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#787269" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#322E29" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#E8E5DF" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#D4D0C8" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#C8C3BA" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#B8B3A8" }] },
  { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#E8F0E0" }] },
  { "featureType": "transit", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#D6E8F0" }] }
]
```

### Dark Mode
```json
[
  { "elementType": "geometry", "stylers": [{ "color": "#1A1814" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#1A1814" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#787269" }] },
  { "featureType": "administrative.locality", "elementType": "labels.text.fill", "stylers": [{ "color": "#A8A39A" }] },
  { "featureType": "road", "elementType": "geometry", "stylers": [{ "color": "#2C2822" }] },
  { "featureType": "road.arterial", "elementType": "geometry", "stylers": [{ "color": "#322E29" }] },
  { "featureType": "road.highway", "elementType": "geometry", "stylers": [{ "color": "#3D3830" }] },
  { "featureType": "road.highway", "elementType": "geometry.stroke", "stylers": [{ "color": "#4D4842" }] },
  { "featureType": "poi", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "poi.park", "elementType": "geometry", "stylers": [{ "color": "#1E2A18" }] },
  { "featureType": "transit", "elementType": "labels", "stylers": [{ "visibility": "off" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#0E1A24" }] }
]
```

---

## 11. Accessibility

Every component must meet these requirements — non-negotiable for a health app:

```
Touch targets:     minimum 44×44px for all interactive elements
Colour contrast:   minimum 4.5:1 for body text, 3:1 for large text / UI components
                   test both light AND dark mode
Screen reader:     all actionable elements have descriptive accessibilityLabel
                   e.g. blood group chip: accessibilityLabel="Blood group A positive"
                   toggle: "Donor status, currently active. Double tap to deactivate."
Reduced motion:    all animations respect AccessibilityInfo.isReduceMotionEnabled()
Font scaling:      all text uses sp units (React Native default) — supports system font size
                   test at 200% system font size — no clipping, no overflow
Error states:      never communicate errors via colour alone — always + icon + text
Loading states:    all async operations have a visual loading indicator within 200ms
Status labels:     ACTIVE / COOLDOWN etc. must have text labels, not icon-only
```

---

## 12. Copy Voice & Microcopy

The writing style is as important as the visual design. These rules apply to every string in the UI.

```
Tone: warm, direct, human. Not clinical. Not chatty. Think: a trusted friend who is a doctor.

Rules:
  - Sentence case always. "Send request" not "Send Request"
  - Active voice. "Your donation was recorded" not "Donation successfully recorded"
  - Address the user by first name wherever the name is known (after onboarding)
  - Never say "click" (it's mobile). Use "tap", "select", "choose"
  - Never say "please" in button labels — it weakens the action
  - Avoid jargon: "recovery period" not "cooldown", "opt in as a donor" not "toggle donor mode"
  - Error messages: state what happened + what to do next. Never "Something went wrong."
  - Empty states: explain what will appear here + why it's empty + one action to change it

Examples:
  BAD:  "No donors available"
  GOOD: "No donors nearby right now. Your request is live — we'll notify you the moment someone accepts."

  BAD:  "Are you sure you want to decline?"
  GOOD: "Decline this request? You won't receive another notification for it."

  BAD:  "Donation recorded successfully!"
  GOOD: "Thank you, Faisal. Your donation has been recorded."

  BAD:  "User not found"
  GOOD: "We couldn't find an account with that number. Check for typos, or create an account."
```

---

## 13. Platform-Specific Rules

### iOS
- Status bar: `barStyle="dark-content"` on light screens, `"light-content"` on dark/red screens
- Safe area: always use `SafeAreaView` — notch, dynamic island, home indicator
- Haptics: `expo-haptics`
  - `impactAsync(Light)` — button taps
  - `impactAsync(Medium)` — toggle state changes
  - `notificationAsync(Success)` — donation confirmed
  - `notificationAsync(Warning)` — critical request received
- Sheet: use `@gorhom/bottom-sheet` with `enablePanDownToClose`

### Android
- Status bar: transparent, `translucent={true}` for edge-to-edge map screens
- Navigation bar: `NavigationBar.setBackgroundColorAsync('transparent')` on map screens
- Ripple: use `TouchableNativeFeedback` with `Ripple(color, false)` — never `TouchableOpacity` on Android list items
- Back button: handle with `BackHandler` on map screen (do not close app accidentally)

### Both
- Keyboard: `KeyboardAvoidingView` on all form screens, `behavior="padding"` iOS / `behavior="height"` Android
- Network errors: detect with `NetInfo`, show persistent offline banner (not a toast — it should stay until connection returns)

---

## 14. File & Folder Structure (Design Tokens Implementation)

```
src/
├── theme/
│   ├── colors.ts        ← all primitive + semantic colour tokens
│   ├── typography.ts    ← all font size, weight, line-height tokens
│   ├── spacing.ts       ← all space tokens
│   ├── radius.ts        ← all border-radius tokens
│   ├── shadows.ts       ← all elevation tokens
│   ├── motion.ts        ← all duration + easing tokens
│   └── index.ts         ← exports ThemeContext + useTheme hook
├── components/
│   ├── primitives/      ← Text, Icon, Divider, Spacer
│   ├── inputs/          ← FloatingLabelInput, BloodGroupSelector, Stepper
│   ├── cards/           ← DonorCard, RequestCard, MetricCard, DonorCardDigital
│   ├── badges/          ← StatusBadge, BloodGroupChip, VerifiedBadge
│   ├── map/             ← VenoMap, DonorPin, RequestPin, GeofenceCircle
│   ├── navigation/      ← BottomNav, DonateToggle
│   ├── sheets/          ← BottomSheet, DonorProfileSheet, ContactSheet
│   └── feedback/        ← Toast, SkeletonCard, EmptyState, LoadingDots
└── screens/
    ├── auth/            ← Splash, Onboarding, Register, OTP, Login
    ├── home/            ← HomeMap, RequestCreation, DonorQueue
    ├── donor/           ← DonorResponse, EnRoute, PostDonation
    ├── profile/         ← Profile, DonorCard, Settings, DonationHistory
    └── shared/          ← ErrorScreen, OfflineScreen
```

---

## 15. Do's and Don'ts

### Do
- Use the floating label input pattern everywhere — it's the Airbnb signature on forms
- Give the blood group label consistent prominence — it is the data that saves a life
- Keep the map dominant on any screen where location matters
- Use the custom map style — never the default Google Maps colours
- Show real data states (skeleton → content, not just a spinner)
- Keep the Donate toggle (centre nav) instantly identifiable — it is the app's heartbeat

### Don't
- Don't use font-weight 700 anywhere
- Don't use gradient backgrounds except the donor card and the splash screen
- Don't show more than one modal/sheet at a time
- Don't use colour alone to communicate state — always + label or icon
- Don't animate non-critical UI — save animation budget for urgent moments
- Don't truncate blood group labels — "A+" is two characters and must always be fully visible
- Don't use the default Google Maps style — it breaks the visual language
- Don't add decorative illustrations to screens that need speed (request creation, en route)
- Don't use red for anything other than brand, urgency, and errors — it carries critical weight here
