# Tech Guidelines

## Coding Standards
- **Astro Components**: Use `.astro` files for layout and UI components. Keep logic inside the frontmatter script block (`---`).
- **Styling**: Use Tailwind CSS utility classes exclusively. Avoid writing custom CSS in `<style>` blocks unless absolutely necessary for complex animations or pseudo-elements not covered by Tailwind.
- **TypeScript**: Use TypeScript for configuration files and any complex client-side logic to ensure type safety.

## Content Management
- Ensure every blog post in `src/content/posts/` includes valid YAML frontmatter (title, published date, description, category, tags).
- Image assets for posts should be optimized and referenced correctly in the frontmatter.

## Performance
- Leverage Astro's zero-JS architecture by default. Only hydrate interactive components when necessary using directives like `client:load`, `client:idle`, or `client:visible`.
