# Hivera Website

This is the marketing/portfolio website for Hivera — a studio that builds business
management platforms (admin dashboards, dispatch portals, technician portals) for
service businesses.

> **This is the main working file for the Hivera project.** It contains both the
> Hivera-specific settings (below, in this top section) and the full Studio Frontend
> Rules (further down). Where they conflict, **the Hivera-specific settings win** — most
> importantly the fixed **palette and fonts** (do not change them without asking).
> The **CSS/framework approach is flexible**: the current `hivera-index.html` is a simple
> starting scaffold using hand-written inline CSS, but Tailwind or another approach is
> fine as we build the site's core out together — just keep the palette and fonts consistent.

## Design system

- **Color palette** follows Railway.app tones:
  - Background `#13111C`
  - Primary violet `#6C3FE7`, gradient to `#A063F7`
  - Lavender accent `#B9A6F5`
  - Text `#F2F0F7`, muted `#9D96B8`, borders `#2B2740`
  - A small honey-amber `#F5B942` appears **ONLY** in the logo hexagon core — do not use it anywhere else.
- **Fonts:** Sora (display/headings), Inter (body), JetBrains Mono (labels/eyebrows).
- **Signature visual motif:** hexagons/honeycomb (the "hive" identity). Keep it subtle.
- **Dark theme only.** Restrained, premium feel — avoid neon or oversaturated colors.

## Structure

- The site is currently a **single file** (HTML + CSS + JS inline). The file is named
  `hivera-index.html` in the project root. Keep it working as-is for now.
- Sections, in order:
  - `nav`
  - `hero`
  - `services` ("What we build")
  - `work` — **live demos**: emulator frame with Admin / Dispatch / Technician role tabs.
    Currently a placeholder; will later embed a real demo via `iframe`.
  - `about`
  - `contact`
  - `footer`
- Placeholders to be filled later:
  - `[Your Name]`
  - `[Your City]`
  - LinkedIn URL (`YOUR-PROFILE`)
  - email address (currently `hello@hivera.app`)

## Rules

- **Respond to me in Turkish in chat**; keep all code, comments, and commit messages in English.
- **Do not change the color palette or fonts** without asking.
- The emulator section will later load a live demo of a field-service platform (separate
  frontend + backend repos). **Keep the iframe swap point intact** — see the comment inside
  `.emu-screen` in `hivera-index.html`:
  ```html
  <!-- When the real demo is deployed, replace the placeholder below with:
       <iframe src="https://demo.hivera.app/?role=admin" title="Hivera live demo" loading="lazy"></iframe>
       and switch the src per role in script. -->
  ```
  The per-role `src` switching hook also lives in the page `<script>` (the commented
  `document.querySelector('.emu-screen iframe').src = ...` line inside the role-tab handler).

---

# Studio Frontend Rules

_(General studio defaults, inherited from the desktop `CLAUDE.md`. The Hivera-specific
settings above override these wherever they conflict.)_

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft (see guardrails below).
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds. Stop only when no visible differences remain or user says so.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)
- `serve.mjs` lives in the project root. Start it in the background before taking any screenshots.
- If the server is already running, do not start a second instance.

## Screenshot Workflow
- Puppeteer is installed at `C:/Users/nateh/AppData/Local/Temp/puppeteer-test/`. Chrome cache is at `C:/Users/nateh/.cache/puppeteer/`.
- **Always screenshot from localhost:** `node screenshot.mjs http://localhost:3000`
- Screenshots are saved automatically to `./temporary screenshots/screenshot-N.png` (auto-incremented, never overwritten).
- Optional label suffix: `node screenshot.mjs http://localhost:3000 label` → saves as `screenshot-N-label.png`
- `screenshot.mjs` lives in the project root. Use it as-is.
- After screenshotting, read the PNG from `temporary screenshots/` with the Read tool — Claude can see and analyze the image directly.
- When comparing, be specific: "heading is 32px but reference shows ~24px", "card gap is 16px but should be 24px"
- Check: spacing/padding, font size/weight/line-height, colors (exact hex), alignment, border-radius, shadows, image sizing

## Output Defaults
- Single `index.html` file, all styles inline, unless user says otherwise
- Tailwind CSS via CDN: `<script src="https://cdn.tailwindcss.com"></script>`
- Placeholder images: `https://placehold.co/WIDTHxHEIGHT`
- Mobile-first responsive

## Brand Assets
- Always check the `brand_assets/` folder before designing. It may contain logos, color guides, style guides, or images.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- If a logo is present, use it. If a color palette is defined, use those exact values — do not invent brand colors.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette (indigo-500, blue-600, etc.). Pick a custom brand color and derive from it.
- **Shadows:** Never use flat `shadow-md`. Use layered, color-tinted shadows with low opacity.
- **Typography:** Never use the same font for headings and body. Pair a display/serif with a clean sans. Apply tight tracking (`-0.03em`) on large headings, generous line-height (`1.7`) on body.
- **Gradients:** Layer multiple radial gradients. Add grain/texture via SVG noise filter for depth.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`. Use spring-style easing.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states. No exceptions.
- **Images:** Add a gradient overlay (`bg-gradient-to-t from-black/60`) and a color treatment layer with `mix-blend-multiply`.
- **Spacing:** Use intentional, consistent spacing tokens — not random Tailwind steps.
- **Depth:** Surfaces should have a layering system (base → elevated → floating), not all sit at the same z-plane.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color

## Project Overrides
- If a project folder has its own CLAUDE.md, its rules (palette, fonts, structure, stack) take priority over the defaults here — including the Tailwind CDN default.

## Client Privacy & Rebranding
- When reusing code from client projects for demos or marketing, strip ALL client identifiers: company names, logos, phone numbers, addresses, real customer data. Replace with generic placeholders (e.g. "Acme Services").
- Never commit real client data to public repositories.

## Quality Floor
- Respect `prefers-reduced-motion` on every animation.
- Every image gets meaningful `alt` text; decorative SVGs get `aria-hidden="true"`.
- Screenshot at two widths minimum: 375px (mobile) and 1440px (desktop).
- Lazy-load iframes and below-the-fold images (`loading="lazy"`).

## Language
- Chat with me in Turkish; keep all code, comments, and commit messages in English.
