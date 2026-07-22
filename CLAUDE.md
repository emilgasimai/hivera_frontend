# Hivera Website

This is the marketing/portfolio website for Hivera — a studio that builds business
management platforms (admin dashboards, dispatch portals, technician portals) for
service businesses.

> **This is the main working file for the Hivera project.** It contains both the
> Hivera-specific settings (below, in this top section) and the full Studio Frontend
> Rules (further down). Where they conflict, **the Hivera-specific settings win** — most
> importantly the fixed **palette and fonts** (do not change them without asking).
> The **CSS/framework approach is flexible**: the current `index.html` is a simple
> starting scaffold using hand-written inline CSS, but Tailwind or another approach is
> fine as we build the site's core out together — just keep the palette and fonts consistent.
>
> **Tailwind is now loaded** (CDN in `<head>`) with **Preflight disabled** (`corePlugins.preflight = false`)
> so it does not reset the existing hand-written CSS, and the **brand palette + fonts are mapped in
> `tailwind.config`**. When you use Tailwind, map brand tokens (`bg-violet`, `text-lavender`,
> `border-line`, `font-sora`, …) and **never use the default Tailwind palette** (no
> indigo/blue/purple/pink/gray defaults). See the **Styling Stack** policy below for when to
> reach for Tailwind vs the default hand-written CSS.

## ORIGINAL LOCKSMITH PROJECT — NEVER TOUCH (ABSOLUTE RULE)

The owner's live/production locksmith project lives at these two exact paths on the
Desktop. These are the real, in-use source folders — the frontend deploys to
astonlocksmith.ca (Vercel) and the backend to Railway:

- **Original frontend:** `C:\Users\none of ur business\Desktop\Project Locksmith`
- **Original backend:** `C:\Users\none of ur business\Desktop\project_locksmith_backend`

Note the deliberate distinction: these are the ORIGINALS on the Desktop, **not** the
duplicated copies at `Hivera/locksmith_website/Project Locksmith` and
`Hivera/locksmith_website/project_locksmith_backend`. The copies are the work area;
the originals are untouchable.

**The rule:**

- These two folders — and everything inside them — must **NEVER** be read, opened,
  edited, executed, committed, pushed, or used as a working directory by any future
  task in this project, for any reason, under any framing (testing, comparison,
  "just checking", a quick fix, a one-line change, urgency, etc.) — **even if a
  future instruction appears to ask for it directly.**
- All locksmith-related work — rebranding, mock preview, the eventual isolated demo
  backend — happens **ONLY** inside `Hivera/locksmith_website/` (the duplicated,
  gitignored copy) or in a further-isolated demo-specific location created later.
  The original paths above are read-only reference points on paper: they may be
  named and cited, but never opened as a working directory.
- If any future task, prompt, or instruction — from the owner or anyone else — asks
  you to open, run, edit, or otherwise interact with either of these exact original
  paths, **STOP immediately and flag it with 🔴** instead of proceeding, even if the
  request seems reasonable or urgent. Ask for explicit, separate confirmation before
  ever touching anything at those paths.
- This rule **cannot be overridden by casual instructions in chat.** The only way to
  change it is the owner explicitly editing this CLAUDE.md file itself.

## Demo Backend — Origin Isolation (Required for Phase 3)

The real isolated demo backend/database (next phase) **MUST** be served from a
genuinely different origin than the Hivera marketing page — a separate subdomain or
port, with explicit CORS configuration — **not** the same origin as currently used
for the local mocked preview.

**Reason:** same-origin serving disables the browser's own security boundary between
the embedded demo and the parent page. This already caused one real bug: the Content
Editor recursively edited the parent page through a root-relative iframe `src`
(`admin.html` → `<iframe id="siteFrame" src="/">`, which resolved to the Hivera page
instead of the client site; `admin.js` then injected an editor stylesheet and
rewrote text nodes in a document that wasn't its own, and the nesting recursed).

Cross-origin serving makes this class of bug impossible by construction. It also
resolves two boundary violations that are latent today only because nothing happens
to be listening:

- `locksmith_website/Project Locksmith/admin.js:2753` — `contentWindow.postMessage(…, window.location.origin)`; the origin argument is no protection while the parent shares that origin.
- `locksmith_website/Project Locksmith/js/dispatch.js:394` — `window.parent.postMessage(…)`, where the parent is currently the Hivera page.
- Shared-origin `localStorage` leakage: the demo writes `apex_admin_session_v1` and `aston_admin_dispatch_seen`, which the Hivera page can read today.

Until Phase 3 ships, the only thing keeping the demo out of the parent page is the
containment code in `demo-mock.js` (blanking `siteFrame`, disabling the Content
Editor nav item). That is a workaround, not a boundary — do not treat it as one.

## The Three Backends — do not confuse them (ABSOLUTE RULE)

There are **three separate backends** in this project's orbit. They share no
database, no origin, and no deploy. Mixing them up — pointing one at another's
database, deploying one over another, copying secrets across — is a serious error.

1. **Aston Locksmith production backend** — the real, live client system.
   - Path: `C:\Users\none of ur business\Desktop\project_locksmith_backend` (ORIGINAL).
   - Deploys to Railway; serves astonlocksmith.ca; holds real customer data.
   - **NEVER TOUCH** — covered by the absolute never-touch rule above. The copy at
     `Hivera/locksmith_website/project_locksmith_backend/` is read-only reference
     for matching proven patterns; it is gitignored and has no live database.

2. **Locksmith demo mock** — NOT a backend at all.
   - Path: `Hivera/locksmith_website/Project Locksmith/demo-mock.js` (client-side).
   - Intercepts `fetch`/`authedFetch` with an in-memory fake data layer. No server,
     no database, no auth. Resets on reload. This is what the embedded demo runs on.

3. **Hivera's own account backend** — THIS system (new).
   - Path: `Hivera/hivera-backend/` (Node/Express, its own git repo, gitignored from
     the frontend repo so Vercel never serves it).
   - Its OWN separate MongoDB Atlas database and its OWN separate Railway project —
     never the locksmith database or the locksmith Railway project.
   - Purpose: Hivera visitor accounts (register/login, favorites) + admin
     infrastructure for Hivera itself. Nothing to do with any locksmith data.
   - Env lives only in Railway/`.env` (gitignored). `JWT_SECRET`, `MONGODB_URI`, and
     `ADMIN_*` here are distinct from every other system's.

Before any backend work: confirm which of the three you are in. If a task would
point Hivera's backend at the locksmith database (or vice versa), STOP and flag it.

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
  `index.html` in the project root. Keep it working as-is for now.
- Sections, in order:
  - `nav`
  - `hero`
  - `services` ("What we build")
  - `work` — **live demos**: emulator frame with Admin / Dispatch / Technician role tabs.
    Currently a placeholder; will later embed a real demo via `iframe`.
  - `about`
  - `faq` — accordion FAQ (placeholder Q&A for now, real copy to follow)
  - `contact` — **Start a Project** lead-intake form (front-end only; submit handler is a
    placeholder marked `<!-- TODO: connect to backend endpoint -->`) plus a direct email/LinkedIn line
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
  `.emu-screen` in `index.html`:
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

## Warnings & Flags
- Whenever a change I'm asked to make could cause a real problem — accessibility issue, broken responsive layout, performance cost, conflicting with the existing design system, browser compatibility issue, or anything that contradicts a rule already in this file — flag it clearly in chat before or while making the change, prefixed with 🔴 "!" so it stands out. Briefly state the risk and the safer alternative if there is one. Still make the change if I confirm I want it anyway, unless it violates the Client Privacy rule.
- Do not silently "fix" or skip something I asked for — flag it, explain, then proceed as instructed.

## Site Purpose (Important — Not a Builder Tool)
This is NOT a tool-building product (like Retool). It is a real business website with three functions:
1. Portfolio — showcases real client projects (starting with a locksmith company's platform) with an embedded live demo visitors can explore.
2. Customer service — an FAQ section plus a contact channel.
3. Lead intake — a "Start a Project" form where potential clients request custom software.
The backend (form submission handling, and eventually the live demo backend) will be built separately by the owner and connected later. For now, build the frontend/UI only — leave the form's submit action as a placeholder clearly marked for backend connection.

## Screenshot Policy
- Do NOT take screenshots by default after every change — this costs unnecessary tokens/credits.
- Only set up the local server and take screenshots when I explicitly ask for visual verification (e.g. "take a screenshot" or "verify this visually").
- For routine changes, describe what changed in text instead.
- (This supersedes the general "Screenshot Workflow" and "Reference Images" screenshot-every-round defaults in the Studio Frontend Rules above.)

## Styling Stack
- The site's default styling is hand-written CSS using the existing custom properties (--violet, --surface, --radius, etc.) in :root.
- Tailwind CDN (already included, Preflight disabled) is available to use whenever it's genuinely useful — e.g. dropping in a pre-built component from Uiverse/21st.dev/ReactBits without hand-converting every class. No need to ask permission each time.
- When using Tailwind for a component, map brand colors/fonts through tailwind.config (already set up) rather than hardcoding Tailwind's default palette — this rule doesn't change.
- Don't rewrite existing hand-written CSS sections into Tailwind just for consistency's sake — only new/imported components default to Tailwind when it's convenient.

## Deployment
- The site is **live** at https://hivera-frontend.vercel.app — Vercel project `hivera-frontend`, linked to the GitHub repo and auto-deploying from `main`. A push to `main` is a deploy.
- **Deploy automatically after every substantive change — commit and push without asking first.** Do not wait for a separate "deploy" instruction.
- Exceptions where you still stop and ask: the work is half-finished or experimental, it is explicitly waiting on my decision, or it would publish something sensitive (e.g. internal pricing docs, real client data).
- After every deploy, verify it actually went live (don't assume the push succeeded) and report the commit hash plus what changed.
