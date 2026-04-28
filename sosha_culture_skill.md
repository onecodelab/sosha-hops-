---
name: Sosha Culture Design System
description: Brand identity guidelines, Tailwind config, and custom CSS for replicating the "Sosha Culture Look" (Flat/Clean version) across projects.
---

# 🎨 Sosha Culture Design System (Flat Edition)

This guide outlines the core design components, fonts, colors, and key visual assets needed to apply the **Sosha Culture** brand identity to any new or existing project. This version focuses on a **flat, minimalist** aesthetic without wavy background effects, but maintains standard Dark and Light modes.

## 1. Typography 📝
The UI depends on pairing modern sans-serif fonts with elegant, brand-specific typography.

### Google Fonts Import
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300;1,700&family=Satisfy&display=swap');
```

### Tailwind Configuration
```js
fontFamily: {
    sans: ['Inter', 'sans-serif'], // The primary UI font
    brand: ['"Cormorant Garamond"', 'serif'], // Elegant branding (.serif-ital)
    mono: ['"JetBrains Mono"', 'monospace'], // Technical data (.mono-os)
    cursive: ['"Satisfy"', 'cursive'], // Vibe-based annotations (.cursive-vibe)
}
```

## 2. Core Color Palette 🎨
The palette supports standard light/dark modes with a focus on high contrast and clean surfaces.

### Tailwind Theme Settings
```javascript
colors: {
    primary: {
        DEFAULT: '#FFB800',  // Sosha Yellow
        hover: '#EAB308',
        foreground: '#000000',
    },
    secondary: {
        DEFAULT: '#84CC16',  // Cucumber Green
        hover: '#65A30D',
    },
    'brand-yellow': '#FFB800',
    'brand-green': '#72BF44',
    'brand-blue': '#020617',
    background: 'var(--background)',
    card: 'var(--card)',
    border: 'var(--border)',
    foreground: 'var(--foreground)',
    muted: 'var(--muted)',
}
```

## 3. CSS Variables & Theming ☀️🌙
Adaptive variables for standard Light (Fresh) and Dark (Classic) modes.

```css
:root {
    /* Dark Mode (Default) */
    --background: #020202;
    --card: #0A0A0A;
    --border: rgba(255, 184, 0, 0.25);
    --foreground: #FAFAFA;
    --muted: #71717A;
    --glass-bg: rgba(20, 20, 20, 0.4);
    --glass-border: rgba(255, 255, 255, 0.08);
}

body[data-theme="fresh"] {
    /* Light Mode */
    --background: #FFFFFF;
    --card: #F9FAFB;
    --border: rgba(255, 184, 0, 0.15);
    --foreground: #020617;
    --muted: #64748B;
    --glass-bg: rgba(255, 255, 255, 0.7);
    --glass-border: rgba(0, 0, 0, 0.05);
}
```

## 4. Key Visual Classes ✨

### The Glass Panel
Used for elegant, blurry floating cards and modals.
```css
.glass-panel {
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
}
```

### Static Backgrounds (No Waves)
Backgrounds are solid and flat, avoiding "liquid" or "wavy" animations.
* `.liquid-bg` - Now follows `var(--background)`.
* `.river-gradient` - Now follows `var(--background)`.

## Creating & Using the Brand Look
1. Embed the **fonts**.
2. Sync your **Tailwind Config** with the above core colors and typography.
3. Import the **Adaptive CSS variables**.
4. Ensure `body` has a smooth `0.5s` transition for theme switching.
