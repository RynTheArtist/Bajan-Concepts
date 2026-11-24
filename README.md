# Bajan Concepts

Marketing + quote-request site for Bajan Concepts (custom motorcycle airbrush, Sierra Vista, AZ).
Plain HTML/CSS/JS plus one PHP file — no build step, runs on any standard shared host.

## Deploy
1. Upload everything in this repo to the host's web root (`public_html`), keeping the folder layout.
2. Edit the top of `quote.php`: `QUOTE_TO` (where quotes are delivered), `MAIL_FROM` (a real mailbox on the domain, e.g. `quotes@bajanconcepts.net`).
3. Turn on SSL, then un-comment the HTTPS redirect in `.htaccess`.
4. Submit a test quote. Every request is also saved to `_data/quotes.jsonl` (web-blocked) as a backup.
5. If mail doesn't arrive, set up SPF/DKIM for the domain in the host's DNS panel.

## Update content
- Contact info: `index.html` (search `210-460-0972`, `bajaninc@yahoo.com`) and `quote.php`.
- Gallery: add `assets/img/<name>.webp` (≈1400px) + `<name>-sm.webp` (≈640px), copy a `<figure class="g-item">` block in `index.html`.
- Colors: CSS variables at the top of `assets/css/style.css`.
- Domain in `index.html` (canonical, og:image, JSON-LD), `robots.txt`, `sitemap.xml`: replace `www.bajanconcepts.net` if the primary domain differs.
