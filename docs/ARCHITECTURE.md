# Architecture

## Tech Stack
- **Framework**: [Astro](https://astro.build) (Static Site Generation)
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Content**: Markdown (`.md`) and MDX for blog posts.
- **Deployment**: Vercel / Netlify / GitHub Pages.

## Directory Structure
- `src/pages/`: Contains the routing logic and page templates.
- `src/content/posts/`: Where all the blog post markdown files reside.
- `src/components/`: Reusable UI components built with Astro and Tailwind.
- `public/`: Static assets like images and fonts.

## Data Flow
Content is authored in Markdown files with YAML frontmatter. Astro processes these files at build time, applies the layouts from `src/pages` and `src/components`, and generates highly optimized static HTML.
