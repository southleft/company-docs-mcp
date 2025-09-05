# Tokens: Typography & Spacing (Canvas Kit)

Story UI should rely on Canvas tokens instead of hard-coded values.

## Typography
- Fonts are provided via `@workday/canvas-kit-react-fonts` (app) and @font-face in Storybook head.
- Default family is provided by tokens (`system.fontFamily.default`); rely on component defaults or set via global.
- Use type components from `@workday/canvas-kit-react/text` for correct sizing/weights.

## Spacing
- Prefer `gap`, `padding`, `margin` props on Layout components. Use token‑aligned increments (e.g., 4/8/12/16).
- Avoid pixel literals in inline styles; use component props and token values.

## Color
- Respect token names; do not hard-code hex.
- Use Status/Brand colors via components (e.g., `StatusIndicator`).

## Breakpoints & density
- Use `Grid` column maps (e.g., `{sm:1, md:2, lg:3}`) for responsive.
- Keep consistent density; avoid mixing large gaps with tight typography.
