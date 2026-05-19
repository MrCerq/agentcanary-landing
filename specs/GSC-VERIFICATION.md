# Google Search Console verification — AgentCanary

Without GSC, organic Google traffic is invisible. This is the lean recipe.

## What I can do vs. what needs you

**You (one-time):** Add the domain in GSC, pick a verification method, hand me the token.

**Me:** Place the verification artifact on the live site, commit + push, then ping you to click "Verify" in GSC.

## Setup

1. Go to https://search.google.com/search-console
2. Add property → **URL prefix** → `https://agentcanary.ai`
3. Pick verification method:
   - **(Recommended) HTML file**: GSC gives you a file like `google6e7f8a9b1c2d3e4f.html`. Download it, paste filename + 1-line content here, I commit it to the repo root.
   - **Meta tag**: GSC gives you `<meta name="google-site-verification" content="ABC..." />`. Paste the content value here, I insert it in `<head>` of index.html.
   - **DNS TXT**: GSC gives you a TXT value. You add it to the Cloudflare/Namecheap DNS panel (I can't reach DNS).

Easiest: HTML file. Send me the filename + content, I do the rest in <5min.

## After verification

1. Submit sitemap: in GSC → Sitemaps → submit `https://agentcanary.ai/sitemap.xml` (already at 485+ URLs)
2. Submit IndexNow for the new pages from this batch:
   - /sources/
   - /record/ (rebuilt with calibration section)
   (IndexNow lets us push updates instead of waiting for crawl)
3. Wait 24-72h for first index data to appear

## What I'll do once verified

- Add a section to weekly sweep that reports GSC top queries + impressions (via GSC API — needs you to grant my service account access OR you paste the JSON report once a week)
- Track which of the 13 distribution channels actually moves the GSC needle

## GA4 (optional, separate from GSC)

If you want behavioral analytics alongside search analytics, also set up GA4:
1. https://analytics.google.com → Admin → Create property
2. Paste me the Measurement ID (looks like `G-XXXXXXXXXX`)
3. I inject the GA4 snippet on agentcanary.ai (single `<script>` tag in `<head>`)

GA4 is *not* required for SEO — only for measuring what users do once they arrive.
