![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-meta-publisher

Publish to **Instagram**, **Facebook Pages**, and **Threads** from n8n — including **Images, Videos, Reels, Stories, and Carousels** — with a single, DRY node.

> Built from the official **n8n community node starter** structure so you can develop, lint, and ship confidently.&#x20;

---

## Table of contents

- [Features](#features)
- [Supported resources & operations](#supported-resources--operations)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Credentials](#credentials)
- [Quick start (Fields mode)](#quick-start-fields-mode)
- [JSON payload mode (optional)](#json-payload-mode-optional)
- [Outputs](#outputs)
- [Rate limits & retries](#rate-limits--retries)
- [Development](#development)
- [Testing locally](#testing-locally)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- One node to publish across **Instagram / Facebook Pages / Threads**
- **Create → poll → publish** workflow handled for you
- **Reels, Stories, Carousels** (IG) + **Photos/Videos** (FB) + **Text/Image/Video/Carousel** (Threads)
- Two input styles:
  - **Fields mode** (simple UI fields)
  - **JSON payload mode** for programmatic/batch posting

- Consistent JSON output (status, IDs, permalinks-ready payloads)
- Friendly polling with jitter; configurable timeouts

---

## Supported resources & operations

**Instagram**

- Publish Image, Publish Video (optional cover image)
- Publish Reel (thumb offset, share to feed)
- Publish Story (image/video)
- Publish Carousel (2–10 items)

**Facebook Pages**

- Publish Photo
- Publish Video (status polled until ready)

**Threads**

- Publish Text
- Publish Image (optional alt text)
- Publish Video (optional alt text)
- Publish Carousel (2–20 items)

---

## Prerequisites

You’ll need on your development machine:

- **git**
- **Node.js v20+** and npm
- **n8n** installed globally

```bash
npm install n8n -g
```

For a smooth developer experience, see n8n’s guide on setting up the node development environment.&#x20;

---

## Installation

### Community Nodes (recommended for users)

- Publish the package to npm, then install it from within n8n via _Community Nodes_.

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
2. Choose **Resource**:
   - Instagram / Facebook Page / Threads

3. Choose **Operation** (e.g., _Publish Reel_).
4. Fill required fields (e.g., IG User ID, Media URL, Caption).
5. Optionally adjust **Polling Interval** and **Max Wait**.
6. Run the workflow.

**Example (IG → Publish Image)**

- Resource: Instagram
- Operation: Publish Image
- IG User ID: `1789…`
- Image URL: `https://…/photo.jpg`
- Caption: `Hello from n8n 🚀`

---

## JSON payload mode (optional)

Instead of filling parameters in the node UI, you can set **Input Source = JSON Property**.
This allows you to feed one or more publishing jobs from the incoming item JSON.

### 1. Configure the Node

- Set **Input Source** → `From JSON Property`
- Set **JSON Property Path** → the field in your input JSON where the job(s) are stored.
  - Use `$json` to pass the entire input item.
  - Use a path like `data.post` if your jobs are nested inside `{"data": { "post": {...}}}`.

### 2. JSON Job Format

Each job must be an object with at least:

- `resource`: `"instagram" | "facebook" | "threads"`
- `operation`: one of the supported operations
- Required fields for that operation (see below)

---

#### **Common Fields**

- `resource` – platform to publish to
- `operation` – type of publish action
- `pollSec` _(optional)_ – polling interval (default: `2`)
- `maxWaitSec` _(optional)_ – max wait before timeout (default: `300`)

---

#### **Instagram**

All Instagram jobs require:

- `igUserId` – Instagram Business User ID
- `autoPublish` _(default: true)_

Operations:

- `publishImage` → `mediaUrl`, `caption?`
- `publishVideo` → `mediaUrl`, `caption?`, `coverUrl?`
- `publishReel` → `videoUrl`, `caption?`, `thumbOffsetMs?`, `shareToFeed?`
- `publishStory` → `mediaUrl`, `storyKind` (`"image"` | `"video"`), `caption?`
- `publishCarousel` → `items[]` (`{ type: "image|video", url: "..." }`), `caption?`

---

#### **Facebook Page**

All Facebook jobs require:

- `pageId` – Page ID

Operations:

- `publishFbPhoto` → `imageUrl`, `caption?`
- `publishFbVideo` → `videoUrl`, `title?`, `description?`

---

#### **Threads**

All Threads jobs require:

- `thUserId` (or `userId` alias) – Threads User ID

Operations:

- `threadsPublishText` → `text`
- `threadsPublishImage` → `imageUrl`, `text?`, `altText?`
- `threadsPublishVideo` → `videoUrl`, `text?`, `altText?`
- `threadsPublishCarousel` → `items[]` (`{ type: "image|video", url: "...", altText? }`), `text?`

You can also pass **an array of jobs** to publish multiple posts in one execution.

### 3. Example: Multiple Jobs

```json
[
	{
		"resource": "instagram",
		"operation": "publishStory",
		"igUserId": "112233445566",
		"mediaUrl": "https://example.com/video.mp4",
		"caption": "Hello world",
		"storyKind": "video",
		"autoPublish": true
	},
	{
		"resource": "instagram",
		"operation": "publishStory",
		"igUserId": "112233445566",
		"mediaUrl": "https://example.com/story-image.jpg",
		"caption": "Story (image)",
		"storyKind": "image",
		"autoPublish": true
	},

	{
		"resource": "instagram",
		"operation": "publishImage",
		"igUserId": "112233445566",
		"mediaUrl": "https://example.com/image.jpg",
		"caption": "My IG image post",
		"autoPublish": true
	},
	{
		"resource": "instagram",
		"operation": "publishVideo",
		"igUserId": "112233445566",
		"mediaUrl": "https://example.com/video.mp4",
		"caption": "My IG video post",
		"coverUrl": "https://example.com/cover.jpg",
		"autoPublish": true
	},
	{
		"resource": "instagram",
		"operation": "publishReel",
		"igUserId": "112233445566",
		"videoUrl": "https://example.com/reel.mp4",
		"caption": "My IG reel",
		"thumbOffsetMs": 0,
		"shareToFeed": true,
		"autoPublish": true
	},
	{
		"resource": "instagram",
		"operation": "publishCarousel",
		"igUserId": "112233445566",
		"items": [
			{ "type": "image", "url": "https://example.com/img1.jpg" },
			{ "type": "video", "url": "https://example.com/vid1.mp4" }
		],
		"caption": "My carousel",
		"autoPublish": true
	},

	{
		"resource": "facebook",
		"operation": "publishFbPhoto",
		"pageId": "112233445566",
		"imageUrl": "https://example.com/photo.jpg",
		"caption": "FB photo caption"
	},
	{
		"resource": "facebook",
		"operation": "publishFbVideo",
		"pageId": "112233445566",
		"videoUrl": "https://example.com/video.mp4",
		"title": "FB Video Title",
		"description": "FB Video Description"
	},

	{
		"resource": "threads",
		"operation": "threadsPublishText",
		"thUserId": "987654321",
		"text": "This is a Threads text post"
	},
	{
		"resource": "threads",
		"operation": "threadsPublishImage",
		"thUserId": "987654321",
		"imageUrl": "https://example.com/thread-img.jpg",
		"text": "Threads image caption",
		"altText": "Alt text for accessibility"
	},
	{
		"resource": "threads",
		"operation": "threadsPublishVideo",
		"thUserId": "987654321",
		"videoUrl": "https://example.com/thread-video.mp4",
		"text": "Threads video caption",
		"altText": "Alt text for video"
	},
	{
		"resource": "threads",
		"operation": "threadsPublishCarousel",
		"thUserId": "987654321",
		"items": [
			{ "type": "image", "url": "https://example.com/thread-img1.jpg", "altText": "Alt 1" },
			{ "type": "video", "url": "https://example.com/thread-vid1.mp4", "altText": "Alt 2" }
		],
		"text": "Threads carousel caption"
	}
]
```

### 4. Example: Single Job

```json
{
	"resource": "instagram",
	"operation": "publishImage",
	"igUserId": "17841476543960845",
	"mediaUrl": "https://example.com/image.jpg",
	"caption": "My first IG post",
	"autoPublish": true
}
```

---

## Outputs

Every successful publish returns a consistent JSON shape (fields may vary slightly by resource/operation):

```json
{
	"resource": "instagram|facebook|threads",
	"type": "image|video|reel|story|carousel|text",
	"creationId": "1789...", // IG/Threads container or parent (when applicable)
	"children": ["childId1"], // for carousels
	"status": "FINISHED|PUBLISHED|READY|ERROR|...",
	"published": true,
	"publishResult": { "id": "1790..." }, // media/thread object
	"videoId": "1234567890" // FB video id when relevant
}
```

Use this to chain downstream steps (e.g., fetch permalink, store IDs).

---

## Rate limits & retries

- The node polls at your chosen interval with gentle jitter to be friendly to API limits.
- Increase **Max Wait (sec)** for long videos/reels.
- For high-volume workflows, consider spacing items or batching upstream.

---

## Development

This repo uses the same conventions as the n8n node starter:

- TypeScript build to `dist/`
- ESLint + Prettier for quality
- Starter-like scripts: `build`, `lint`, `lintfix`

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

- Lint before committing (`npm run lint` / `npm run lintfix`)
- Keep code DRY: use shared client, poller, and resource adapters

---

## License

MIT — same as the official starter.&#x20;

---

### Notes

- Ensure your Meta app has the appropriate permissions for your chosen resource(s) and that your IG account is a professional account linked to a Page when required.
- Threads uses a separate host (`graph.threads.net`) under the Meta umbrella; this node handles it internally — you just choose **Threads** in the UI.
