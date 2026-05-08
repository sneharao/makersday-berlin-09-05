---
name: Library Intelligence System
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f4'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e3'
  on-surface: '#1a1c1c'
  on-surface-variant: '#41484a'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#71787a'
  outline-variant: '#c0c8ca'
  surface-tint: '#3d646d'
  primary: '#002127'
  on-primary: '#ffffff'
  primary-container: '#0a373f'
  on-primary-container: '#79a0aa'
  inverse-primary: '#a5cdd7'
  secondary: '#256772'
  on-secondary: '#ffffff'
  secondary-container: '#aceaf7'
  on-secondary-container: '#2b6b76'
  tertiary: '#08006f'
  on-tertiary: '#ffffff'
  tertiary-container: '#1302ab'
  on-tertiary-container: '#8b8eff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c0e9f4'
  primary-fixed-dim: '#a5cdd7'
  on-primary-fixed: '#001f25'
  on-primary-fixed-variant: '#244c55'
  secondary-fixed: '#afedfa'
  secondary-fixed-dim: '#93d0dd'
  on-secondary-fixed: '#001f24'
  on-secondary-fixed-variant: '#004e59'
  tertiary-fixed: '#e1dfff'
  tertiary-fixed-dim: '#c1c1ff'
  on-tertiary-fixed: '#08006c'
  on-tertiary-fixed-variant: '#302dbe'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e3'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  title-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '700'
    lineHeight: '1'
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
  xl: 64px
  container-max: 1440px
  gutter: 24px
---

## Brand & Style

The design system is built upon the concept of "Digital Scholasticism." It merges the quiet, focused atmosphere of a physical library with the high-velocity precision of modern artificial intelligence. The aesthetic is **Corporate Modern** with a heavy emphasis on **High-Contrast Functionalism**.

The target audience consists of researchers, students, and professionals who require a tool that feels authoritative yet effortless. The emotional response should be one of "calm productivity"—where the interface recedes to let the content and the conversation take center stage. Visuals are crisp, using the deep petrol tones to ground the experience in technical sophistication, while the mint and periwinkle accents signal intelligent interactivity.

## Colors

This design system utilizes a high-contrast palette to ensure maximum legibility during long reading sessions. 

*   **Primary (Dark Petrol):** Used for structural navigation elements, primary headings, and high-importance text to provide a solid visual anchor.
*   **Secondary (Petrol & Light Petrol):** Applied to secondary actions, icons, and borders to create a tiered visual hierarchy without overwhelming the user.
*   **Accent (Dark Periwinkle):** Reserved exclusively for "AI-driven" moments—such as the message send button, active AI status indicators, or primary calls to action.
*   **Functional (Mint Green):** Used for success states, verification badges, and highlighting new library additions.
*   **Surfaces:** The system defaults to a clean White background, utilizing Pastel Petrol for chat bubbles or selected states to maintain a soft, tech-focused "glow."

## Typography

The design system employs **Hanken Grotesk** for its exceptional clarity and modern technical feel. The typeface choice ensures that both short chat prompts and long-form library excerpts remain legible over extended periods.

Hierarchy is established through weight and color rather than excessive size shifts. Headers use **Dark Petrol** at a semi-bold or bold weight. Body text utilizes **Petrol** for a slightly softer contrast that reduces eye strain, while labels and metadata use the **Light Petrol** or **Grey** tones to sit back in the visual stack.

## Layout & Spacing

The system follows a **12-column fluid grid** for dashboard views and a **centered fixed-width column** for the primary chat experience to minimize horizontal eye travel. 

A strict 8px rhythm governs all spatial relationships. Navigation sidebars are set to a fixed width of 280px to maximize the available space for reading and chatting. Generous internal padding (24px) within cards and chat containers prevents the technical interface from feeling cramped, reinforcing the "clean" design mandate.

## Elevation & Depth

To maintain a modern and "clean" aesthetic, this design system avoids heavy drop shadows. Instead, it utilizes **Tonal Layering** and **Low-Contrast Outlines**.

*   **Surface 0 (Background):** Pure White (#FFFFFF).
*   **Surface 1 (Sidebars/Containers):** Grey (#F2F2F2) or Pastel Petrol (#EEFCFF).
*   **Surface 2 (Active Cards):** White with a 1px Petrol (#155B66) border at 20% opacity.
*   **Interaction Shadow:** A single, highly diffused shadow (0px 4px 20px rgba(10, 55, 63, 0.08)) is used only for floating elements like dropdown menus or active modals to suggest they are temporarily layered above the workspace.

## Shapes

The shape language is defined by a **Rounded** (Level 2) approach. This balances the rigid, structured nature of a library with the fluid, organic nature of conversation.

*   **Buttons & Inputs:** 0.5rem (8px) corner radius.
*   **Chat Bubbles:** 1rem (16px) corner radius, with the corner closest to the sender sharpened to 4px to indicate directionality.
*   **Cards & Modals:** 1.5rem (24px) corner radius to create a soft, approachable frame for complex data.

## Components

### Buttons
*   **Primary Action:** Solid Dark Periwinkle (#6264EF) with White text. Used for "Send," "Upload," or "Finalize."
*   **Secondary Action:** Ghost style with Petrol (#155B66) borders or Solid Mint Green (#9BF3D4) with Dark Petrol text for high-visibility tools.

### Chat Bubbles
*   **User Bubble:** Pastel Petrol (#EEFCFF) background with Dark Petrol text. Aligned right.
*   **AI Bubble:** White background with a 1px Light Petrol (#A6D8D8) border. Aligned left.

### Library Cards
*   Used for book or document previews. Features a 1px Grey (#F2F2F2) border, a Mint Green (#9BF3D4) category tag, and Hanken Grotesk Medium for the title.

### Input Fields
*   Search and chat inputs use a White background with a subtle 1px border. On focus, the border transitions to Dark Periwinkle with a faint 4px outer glow of the same color.

### Chips & Tags
*   Small, rounded pills using Mint Green (success/verified) or Light Petrol (category) with condensed labels to help organize large libraries without visual clutter.