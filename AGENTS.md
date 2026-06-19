# Prototype Instructions

Run the local server yourself and open the preview in the in-app browser. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

## Durable Creative Direction

- Preserve the selected “Rain Curtain” visual system: cold blue-gray environments, charcoal dialogue surface, restrained typography, and red as the only strong accent.
- New locations should feel like the same school and weather, with realistic environment art rather than placeholder panels.
- Character routes must pair evidence with an ordinary memory of Haruka so she remains a person rather than only a mystery.
- Extend the prototype through the existing dialogue, choice, fact-card, history, save, auto, and skip patterns; do not redesign the shell when adding chapters.
- Keep the score story-driven: ambient, investigation, confrontation, and Haruka-memory modes should change with narrative state while rain remains a supporting layer.
- Reference public scene assets through Vite's base URL so local preview and GitHub Pages subpath deployments behave identically.
- Keep the first paint lightweight: use the classroom preview immediately, fade in the compressed full scene, then preload later locations after the title is ready.
- Preserve a complete title flow with a skippable opening, new game, continue, chapter select, and functional settings.
