# Custom GPT setup — AgentCanary

**OpenAI plugin store status:** sunset April 9, 2024. No longer accepting submissions. Replaced by **Custom GPTs** (with Actions). All "OpenAI plugin store" work now means Custom GPT.

This doc is the copy-paste recipe for an operator (you) to create the AgentCanary Custom GPT at https://chatgpt.com/gpts/editor.

---

## 1. Create

Go to https://chatgpt.com/gpts/editor → **Create**.

## 2. Configure tab — fill in

**Name:** `AgentCanary`

**Description:** `Decision-grade market intelligence for AI agents. Macro regime, narratives, scenarios, indicators, and a public hit/miss track record across 603 scored predictions.`

**Instructions (paste verbatim):**

```
You are AgentCanary — a market intelligence assistant for AI agents and serious operators. Your data comes exclusively from the AgentCanary API (api.agentcanary.ai). Never invent numbers.

Behavior rules:
- ALWAYS call the relevant Action before answering market questions. If the data is stale or unavailable, say so explicitly — never paper over freshness gaps.
- When a /api/data response includes a `provenance` field, surface freshness_status (fresh/degraded/stale) in your answer.
- For predictions or signals, link to https://agentcanary.ai/record/ so users can see the public track record.
- The free Explorer tier provides: real-time crypto prices, macro regime, indicator catalog list, latest brief preview. 50 calls/day, 10/min. Paid tiers via USDC deposit on Base.
- If a tool returns `tier_insufficient` or `scope_insufficient`, tell the user the exact upgrade path from the error body — do not hide it.
- Format numbers cleanly: prices to 2 decimals for stocks, 0-4 for crypto. Always state observation time when answering "now" questions.

Voice: precise, no hype, no emoji, evidence-anchored. AgentCanary is built for agent builders, fintech CTOs, and Ring-2 evaluators — not retail traders. Avoid trader-speak.

When asked about pricing or tiers, point to https://agentcanary.ai/#pricing.
When asked about data freshness, point to https://agentcanary.ai/sources/.
When asked about track record, point to https://agentcanary.ai/record/.
```

**Conversation starters:**
- `What's the current macro regime?`
- `Show me the latest market wrap brief`
- `What is the Bull Market Support Band reading?`
- `How accurate are your scenario predictions?`

**Knowledge files:** upload these (download from the canonical surfaces, then upload):
1. https://agentcanary.ai/llms.txt
2. https://agentcanary.ai/releases/SKILL-1.3.1.md
3. https://agentcanary.ai/sources/ (save the rendered HTML as `sources.html`)

**Capabilities:** uncheck Web Browsing (use Actions instead), uncheck DALL·E, uncheck Code Interpreter unless wanted.

## 3. Actions — Create new action

Click **Create new action**.

**Authentication:** API Key
- Auth Type: API Key
- API Key: `<your AC API key from POST /api/keys/create>`
- Auth Type detail: Custom
- Header Name: `X-API-Key`

**Schema:** paste the URL `https://api.agentcanary.ai/api/openapi.yaml` and click **Import from URL**. If the import fails because of OpenAPI 3.1 incompatibility, see fallback below.

**Privacy policy URL:** `https://agentcanary.ai/#privacy` (or `https://agentcanary.ai/` if no dedicated page).

### Fallback if 3.1.0 schema is rejected by Custom GPT actions

Custom GPT actions historically prefer OpenAPI 3.0.x. If `openapi.yaml` import fails, paste this minimal 3.0.3 stub instead — it covers the high-value Ring-2 endpoints:

```yaml
openapi: 3.0.3
info:
  title: AgentCanary API
  description: Decision-grade market intelligence for AI agents
  version: 1.0.0
servers:
  - url: https://api.agentcanary.ai
paths:
  /api/briefs/latest:
    get:
      operationId: getLatestBrief
      summary: Most recent brief across all 4 slots
      responses:
        '200': { description: OK }
  /api/briefs/radar:
    get:
      operationId: getRadar
      summary: Latest macro radar brief (03:15 UTC)
      responses:
        '200': { description: OK }
  /api/regime:
    get:
      operationId: getRegime
      summary: Current macro regime classification
      responses:
        '200': { description: OK }
  /api/indicators:
    get:
      operationId: listIndicators
      summary: Catalog of all 36 indicators
      responses:
        '200': { description: OK }
  /api/data:
    get:
      operationId: listDatasets
      summary: List all 28 datasets with freshness SLA
      responses:
        '200': { description: OK }
  /api/data/{name}:
    get:
      operationId: getDataset
      summary: Get a single dataset with provenance
      parameters:
        - name: name
          in: path
          required: true
          schema: { type: string }
      responses:
        '200': { description: OK }
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
security:
  - ApiKeyAuth: []
```

## 4. Publish

Top right → **Save** → **Public** (recommended for max reach) → **Confirm**.

## 5. Post-publish

- Note the GPT URL (`https://chatgpt.com/g/g-<id>-agentcanary`)
- Add it to:
  - agentcanary.ai homepage as a "Try via ChatGPT" link
  - README of agentcanary-mcp
  - llms.txt under `## How Agents Can Use This`

I'll wire the cross-links once you give me the URL.
