![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-meta-publisher

Publish to **Instagram**, **Facebook Pages**, and **Threads** from n8n — including **Images, Videos, Reels, Stories, and Carousels** — with a single, DRY node.

> Built from the official **n8n community node starter** structure so you can develop, lint, and ship confidently.&#x20;

---

## Table of contents

* [Features](#features)
* [Supported platforms & operations](#supported-platforms--operations)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Credentials](#credentials)
* [Quick start (Fields mode)](#quick-start-fields-mode)
* [JSON payload mode (optional)](#json-payload-mode-optional)
* [Outputs](#outputs)
* [Rate limits & retries](#rate-limits--retries)
* [Development](#development)
* [Testing locally](#testing-locally)
* [Contributing](#contributing)
* [License](#license)

---

## Features

* One node to publish across **Instagram / Facebook Pages / Threads**
* **Create → poll → publish** workflow handled for you
* **Reels, Stories, Carousels** (IG) + **Photos/Videos** (FB) + **Text/Image/Video/Carousel** (Threads)
* Two input styles:

    * **Fields mode** (simple UI fields)
    * **JSON payload mode** for programmatic/batch posting
* Consistent JSON output (status, IDs, permalinks-ready payloads)
* Friendly polling with jitter; configurable timeouts

---

## Supported platforms & operations

**Instagram**

* Publish Image, Publish Video (optional cover image)
* Publish Reel (thumb offset, share to feed)
* Publish Story (image/video)
* Publish Carousel (2–10 items)

**Facebook Pages**

* Publish Photo
* Publish Video (status polled until ready)

**Threads**

* Publish Text
* Publish Image (optional alt text)
* Publish Video (optional alt text)
* Publish Carousel (2–20 items)

---

## Prerequisites

You’ll need on your development machine:

* **git**
* **Node.js v20+** and npm
* **n8n** installed globally

```bash
npm install n8n -g
```

For a smooth developer experience, see n8n’s guide on setting up the node development environment.&#x20;

---

## Installation

### Community Nodes (recommended for users)

* Publish the package to npm, then install it from within n8n via *Community Nodes*.

### Local (developers)

```bash
# in your repo
npm i
npm run build
# restart n8n pointing to your custom nodes folder if needed
```

The project follows the n8n node starter layout and build flow.&#x20;

---

## Credentials

Add a credential in n8n called **Meta Graph API** with an **Access Token** (prefer long-lived).
The node will also attempt **OAuth2** if configured in your instance, then fall back to the access token.

> Keep tokens in **Credentials**, not in node fields. This keeps secrets secure and reusable across workflows.

---

## Quick start (Fields mode)

1. Drag **Meta Publisher** into your workflow.
2. Choose **Platform**:

    * Instagram / Facebook Page / Threads
3. Choose **Operation** (e.g., *Publish Reel*).
4. Fill required fields (e.g., IG User ID, Media URL, Caption).
5. Optionally adjust **Polling Interval** and **Max Wait**.
6. Run the workflow.

**Example (IG → Publish Image)**

* Platform: Instagram
* Operation: Publish Image
* IG User ID: `1789…`
* Image URL: `https://…/photo.jpg`
* Caption: `Hello from n8n 🚀`

---

## JSON payload mode (optional)

For advanced batching/programmatic posts, switch **Input Source** to **From JSON Property** and point to a JSON object/array in the incoming item (e.g. `$json` or `data`). Each object must include at least `platform` and `operation`. Any missing field falls back to node UI defaults.

**Single job (from `$json`)**

```json
{
  "platform": "instagram",
  "operation": "publishImage",
  "igUserId": "1789...",
  "mediaUrl": "https://example.com/image.jpg",
  "caption": "Hello world",
  "autoPublish": true
}
```

**Multiple jobs (from `$json.data`)**

```json
{
  "data": [
    {
      "platform": "threads",
      "operation": "threadsPublishText",
      "userId": "12345",
      "text": "Posting from n8n 💚"
    },
    {
      "platform": "facebook",
      "operation": "publishFbPhoto",
      "pageId": "999999",
      "imageUrl": "https://example.com/photo.jpg",
      "caption": "FB photo!"
    }
  ]
}
```

Set **JSON Property Path** to `data` for the second example.

---

## Outputs

Every successful publish returns a consistent JSON shape (fields may vary slightly by platform/operation):

```json
{
  "platform": "instagram|facebook|threads",
  "type": "image|video|reel|story|carousel|text",
  "creationId": "1789...",     // IG/Threads container or parent (when applicable)
  "children": ["childId1"],    // for carousels
  "status": "FINISHED|PUBLISHED|READY|ERROR|...",
  "published": true,
  "publishResult": { "id": "1790..." },  // media/thread object
  "videoId": "1234567890"      // FB video id when relevant
}
```

Use this to chain downstream steps (e.g., fetch permalink, store IDs).

---

## Rate limits & retries

* The node polls at your chosen interval with gentle jitter to be friendly to API limits.
* Increase **Max Wait (sec)** for long videos/reels.
* For high-volume workflows, consider spacing items or batching upstream.

---

## Development

This repo uses the same conventions as the n8n node starter:

* TypeScript build to `dist/`
* ESLint + Prettier for quality
* Starter-like scripts: `build`, `lint`, `lintfix`

Typical loop:

```bash
npm i
npm run dev     # tsc --watch
# In another terminal, run n8n and test
```

Refer to n8n’s “Using this starter” steps (generate repo, install deps, lint, test locally, publish) for overall workflow.&#x20;

---

## Testing locally

n8n documents how to **run your node locally**; follow those instructions to link your development build and iterate quickly.&#x20;

---

## Contributing

Issues and PRs are welcome! Please:

* Lint before committing (`npm run lint` / `npm run lintfix`)
* Keep code DRY: use shared client, poller, and platform adapters

---

## License

MIT — same as the official starter.&#x20;

---

### Notes

* Ensure your Meta app has the appropriate permissions for your chosen platform(s) and that your IG account is a professional account linked to a Page when required.
* Threads uses a separate host (`graph.threads.net`) under the Meta umbrella; this node handles it internally — you just choose **Threads** in the UI.
