# Almanac Design Vibe Guide

Source inputs: `index.html`, `forest.png`, `og.png`, `logo1.png`, `logo.svg`, `logo.png`, and `almanac-mark.png`.

This site should feel like a calm, living research companion for codebases: part old-world field guide, part modern agent tool, part quiet command line. The core tension is intentional: warm parchment and forest imagery make the product feel organic and durable, while terminal panels, monospace snippets, and file-tree examples keep it grounded in developer work.

## Design Thesis

Almanac is a living wiki for codebases. The visual system should make documentation feel less like admin work and more like accumulated knowledge growing in the margins of real engineering.

The strongest mood words are:

- Scholarly
- Organic
- Calm
- Agent-native
- Trustworthy
- Slightly magical, but never whimsical
- Technical without feeling sterile

The design should avoid SaaS gloss. No generic gradients, neon dashboards, floating glass cards, or over-explained feature sections. Almanac should feel like a well-kept notebook found inside a forest lab.

## Visual Metaphor

The existing hero image establishes the main metaphor: a road through a sunlit forest. It suggests orientation, memory, and a path through complexity. Use this as the north star for future visuals.

Primary associations:

- Forest: living knowledge, growth, branching paths, hidden context.
- Road: navigation, continuity, a path through the codebase.
- Book: durable record, wiki, preserved reasoning.
- Terminal: agent workflow, repo-native tooling, developer trust.
- Leaf: organic growth and subtle identity mark.

Do not replace this with abstract AI imagery. The product is not "AI sparkle"; it is persistent, navigable memory.

## Color System

The palette is warm paper plus deep greens, with dark terminal ink for technical surfaces.

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Page background | `--bg` | `#faf6ed` | Main site background, parchment base |
| Deeper band | `--bg-deep` | `#f4efe4` | Alternating sections |
| Surface | `--surface` | `#ede5d2` | Inline code and quiet fills |
| Paper | `--paper` | `#fffaf0` | Cards and content panels |
| Paper edge | `--paper-edge` | `#e8dcc6` | Card borders |
| Text | `--text` | `#342f25` | Body text |
| Ink | `--ink` | `#26313a` | Headings and terminal buttons |
| Muted text | `--muted` | `#695f50` | Paragraphs and secondary copy |
| Faint text | `--faint` | `#978d7e` | Footer, metadata, step numbers |
| Primary green | `--accent` | `#166534` | Links and primary CTA |
| Hover green | `--accent-hover` | `#15803d` | CTA hover |
| Bright green | `--accent-bright` | `#16a34a` | Icons, highlights, active states |
| Sage | `--sage` | `#6a7358` | Terminal prompt and quiet success states |
| Border | `--border` | `#d8d0c0` | Section rules, card grids |

Use green sparingly. It should feel like life appearing through paper and ink, not like a monochrome green brand system. Pair it with parchment, dark ink, and warm neutral borders.

## Typography

The current type stack is a key part of the brand.

| Role | Typeface | Use |
| --- | --- | --- |
| Editorial serif | Palatino, Book Antiqua, Georgia fallback | H1, H2, card titles, brand wordmark |
| Product sans | DM Sans | Navigation, body support text, labels, UI copy |
| Code mono | JetBrains Mono | Commands, file paths, terminal UI, technical labels |
| Italic accent | Newsreader italic | Section labels |

Guidelines:

- Use serif headings for the sense of old knowledge and permanence.
- Use DM Sans for clarity in product explanations.
- Use JetBrains Mono only for actual command, file, or agent workflow material.
- Italics should feel editorial and alive, not decorative.
- Hero scale is reserved for the main promise. Do not use giant type inside cards or small panels.

## Imagery

### Hero

Use `forest.png` as the canonical hero image. It should be full-bleed, centered, and darkened with a vertical overlay so white text stays legible.

Current overlay behavior:

- Top: transparent dark wash.
- Middle: stronger contrast for hero copy.
- Bottom: deep fade into near-black, helping the terminal panel sit naturally.

### Open Graph

`og.png` is the social-share expression of the same system: forest background, centered editorial headline, green italic emphasis, pill eyebrow, logo lockup in the bottom left, URL in the bottom right.

### Logo

The preferred landing-page mark is `logo1.png`: an open book with a terminal prompt. It combines the two halves of the product better than the pure book mark.

Use the marks this way:

- `logo1.png`: primary web/nav mark.
- `logo.svg`: simple scalable book-and-leaf identity mark.
- `almanac-mark.png`: app icon or compact brand use.
- Favicons and touch icons: browser/device surfaces only.

## Layout

The page should feel spacious, centered, and readable. Current max widths:

- Main container: `1200px`
- Narrow reading container: `840px`

Spacing should follow the existing scale:

- XS: `0.5rem`
- SM: `1rem`
- MD: `2rem`
- LG: `4rem`
- XL: `6rem`
- 2XL: `10rem`

Use full-width sections with constrained inner content. Cards are acceptable for repeated items, but avoid nested cards or decorative card stacks. The site works best when sections breathe and the content itself carries the structure.

## Components

### Navigation

The nav begins transparent over the hero and becomes parchment with blur after scrolling. This gives the first viewport a cinematic feel without sacrificing usability.

Rules:

- Keep the brand mark large enough to be recognizable.
- Use white nav text over the hero, muted text after scroll.
- Keep the GitHub CTA compact, green, and monospace.

### Hero Eyebrow

The eyebrow is a glassy pill with a pulsing green dot. It should be used only for the top-level positioning phrase, currently "Agent-maintained knowledge."

Use this pattern sparingly. It is a signal, not a generic badge component.

### Terminal Panels

Terminal panels are the main technical proof objects. They should look like real developer surfaces but remain warm and integrated with the parchment system.

Rules:

- Background: `#1e1e1e`
- Bar: `#2a2a2a`
- Use macOS-style red/yellow/green dots.
- Keep body text small, monospace, and readable.
- Use green highlights for success or important paths.
- Use sage and tan for quieter command output.

### Cards

Cards use `--paper` backgrounds, `--paper-edge` borders, and 8px radius. They should be simple and content-first.

Use cards for:

- Problem statements
- Feature items
- Repeated capability blocks

Avoid cards for:

- Whole page sections
- Hero content
- Decorative wrappers around already framed UI

### Flow Steps

The "How it works" flow uses circular icons, small monospace step numbers, and dotted connector lines. This pattern should communicate a process without becoming a heavy diagram.

Keep process copy short and concrete. Mention real commands and paths when possible.

## Motion

Motion is subtle and calm.

Existing patterns:

- Fade-up entrance using `cubic-bezier(0.16, 1, 0.3, 1)`.
- Scroll reveal from `translateY(32px)` to rest.
- Hero content staggers in by 0.15s increments.
- The green dot pulses slowly.
- Buttons lift by 1 to 2px on hover.

Do not add bouncy, playful, or high-energy animation. The motion should feel like a page settling into view.

## Copy Voice

The copy should be plain, specific, and slightly lyrical. It should speak to developers who have felt the pain of lost context.

Good patterns:

- "Your agents can read the code. They can't read the reasons."
- "Write code. The wiki writes itself."
- "Just keep building."
- "Review them like any commit. They're just markdown."

Voice rules:

- Lead with the pain of forgotten decisions, not generic productivity.
- Make agent behavior concrete with commands, paths, and examples.
- Prefer short declarative lines.
- Keep the magic quiet. Let the product feel powerful through specificity.
- Avoid marketing filler like "unlock", "supercharge", "seamless", or "AI-powered productivity".

## Iconography

Use thin-line icons that match the current inline SVG style:

- Stroke width around `1.5`
- Rounded line caps and joins
- Green accent color
- Simple metaphors: document, graph, link, spark, database, search

The leaf icon is the recurring section motif. Keep it as the organic brand marker.

## Implementation Notes

When extending the page:

- Reuse the CSS variables in `:root`.
- Keep border radius at `8px` or lower except pills and circles.
- Preserve the parchment and forest contrast.
- Keep responsive behavior simple: grids collapse to one column under `900px`; nav links hide on smaller screens.
- Maintain the grain overlay at very low opacity. It should be felt, not noticed.
- Use real product artifacts in examples: `.almanac/pages/`, `topics.yaml`, `index.db`, `almanac capture sweep`, and `search --mentions`.

## Do And Don't

Do:

- Use warm paper backgrounds.
- Use forest, book, leaf, path, and terminal motifs.
- Make developer proof visible.
- Keep headings editorial and spacious.
- Let green be a living accent.
- Use calm scroll and hover motion.

Don't:

- Turn the site into a generic SaaS dashboard.
- Use purple/blue AI gradients.
- Add abstract robot or neural-network imagery.
- Overuse glassmorphism beyond the hero eyebrow/nav blur.
- Make every section a floating card.
- Replace concrete commands with vague promises.

## One-Sentence Creative Brief

Design Almanac like a codebase field guide: parchment pages, forest paths, living green annotations, and terminal proof that the wiki is quietly growing as agents work.
