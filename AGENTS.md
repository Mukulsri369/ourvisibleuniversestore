<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture decisions
- Products, categories, settings, images, and click events are database-backed; public access is limited by row-level policies and admin writes use an allowlisted authenticated email.
- Store media uses private object storage served through a validated public image route so storage credentials never reach visitors.
- Retailer affiliate URLs are stored per product and passed through unchanged; outbound click logging is best-effort and never blocks navigation.
- Public product queries include the legacy Amazon URL and use it only when the retailer-neutral affiliate URL is missing, so older records retain working purchase links.
- A database trigger blocks publishing, activating, restoring live products, or changing live affiliate links when another record uses the same effective URL; drafts and trash count, self-edits do not, and URL comparison never rewrites stored links.
