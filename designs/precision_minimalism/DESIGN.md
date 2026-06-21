---
name: Precision Minimalism
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#584140'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#8c706f'
  outline-variant: '#e0bfbd'
  surface-tint: '#ae2f34'
  primary: '#8d151f'
  on-primary: '#ffffff'
  primary-container: '#ae2f34'
  on-primary-container: '#ffcdca'
  inverse-primary: '#ffb3b0'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e5e2e1'
  on-secondary-container: '#656464'
  tertiary: '#005050'
  on-tertiary: '#ffffff'
  tertiary-container: '#006a6a'
  on-tertiary-container: '#97e7e6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdad8'
  primary-fixed-dim: '#ffb3b0'
  on-primary-fixed: '#410006'
  on-primary-fixed-variant: '#8c151f'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#a0f0f0'
  tertiary-fixed-dim: '#84d4d3'
  on-tertiary-fixed: '#002020'
  on-tertiary-fixed-variant: '#004f4f'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  headline-xl:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Outfit
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0em
  body-lg:
    fontFamily: Outfit
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Outfit
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Outfit
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 12px
  md: 24px
  lg: 48px
  xl: 80px
  gutter: 24px
  margin-mobile: 20px
  margin-desktop: 64px
---

## Brand & Style
The design system is rooted in high-end functionalism, drawing inspiration from the "utility-luxe" aesthetic. It targets a discerning audience that values efficiency, clarity, and premium craftsmanship. The emotional response is one of immediate trust and effortless navigation.

The design style is **Minimalism with a Technical Edge**. It prioritizes high-contrast legibility and expansive whitespace over decorative elements. Surfaces are stark and purposeful, utilizing a "less but better" philosophy where every pixel serves a functional intent. The interface remains quiet to allow content and primary actions to command full attention.

## Colors
The palette is intentionally restricted to maintain a rigorous brand identity.
- **Primary (#AE2F34):** A sophisticated, deep red reserved exclusively for high-priority calls to action and critical status indicators. It should never be used for large backgrounds or decorative accents.
- **Primary Text (#121212):** A deep charcoal that provides maximum contrast against white surfaces, ensuring superior legibility.
- **Surfaces:** Pure white (#FFFFFF) is the default background for all primary containers to maximize the "breathability" of the layout.
- **Accents:** Use a neutral grey (#F7F7F7) for secondary backgrounds or subtle grouping, and a fine light grey (#E5E5E5) for all structural borders.

## Typography
The typography system relies on **Outfit** to bridge the gap between geometric precision and approachable warmth. 

- **Headlines:** Use Bold (700) or SemiBold (600) weights with slightly tight letter-spacing to create a strong, architectural presence.
- **Body:** Maintain generous line heights (1.5x or higher) to ensure long-form readability and support the minimalist aesthetic.
- **Labels:** Small labels use a SemiBold weight with increased tracking (+5%) and uppercase styling for a technical, "wayfinding" feel similar to premium travel apps.

## Layout & Spacing
The design system utilizes a **8px linear scale** for all spatial relationships.

- **Grid:** A 12-column fluid grid on desktop with generous 64px outer margins. On mobile, a 4-column grid with 20px margins.
- **Whitespace:** Emphasize "excessive" padding within containers (minimum 24px) to separate content modules without the need for heavy dividers.
- **Alignment:** Strict adherence to a left-aligned rhythm for text, creating a clean vertical "axis" for the eye to follow.

## Elevation & Depth
This system avoids heavy shadows and traditional skeuomorphism in favor of **Layered Flatness**.

- **Tonal Separation:** Depth is primarily communicated through color shifts (e.g., a #F7F7F7 background behind a #FFFFFF card).
- **Fine Lines:** Use 1px solid borders (#E5E5E5) to define boundaries. 
- **Shadows:** When necessary for temporary overlays (modals/menus), use a single, ultra-soft "Ambient" shadow: `0px 12px 32px rgba(0, 0, 0, 0.05)`. Avoid shadows on buttons or standard cards.

## Shapes
The shape language is controlled and systematic. A standard **8px (0.5rem) corner radius** is applied to primary components to soften the technical edge while maintaining a professional, structured appearance. Icons should follow a similar stroke weight (1.5px to 2px) to match the fine-line border aesthetic.

## Components
- **Buttons:** Primary buttons are solid #AE2F34 with white text, 8px radius, and no shadow. Secondary buttons use a 1px #121212 border with a transparent background.
- **Inputs:** 1px #E5E5E5 border, 8px radius. On focus, the border transitions to #121212. Use Outfit Medium for placeholder text.
- **Cards:** White background with a 1px #E5E5E5 border. No shadow. Internal padding should be a minimum of 24px (md).
- **Chips/Badges:** Small, 4px radius, using #F7F7F7 background and #121212 text.
- **Lists:** Clean rows separated by 1px #E5E5E5 horizontal dividers. Remove dividers on the last item of a group.
- **Selection Controls:** Checkboxes and Radio buttons use a strict 1px stroke. When active, they fill with #AE2F34.