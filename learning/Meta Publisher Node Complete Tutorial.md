Amazing—here’s a **complete, DRY, production‑ready** scaffold for a single **MetaPublisher** n8n community node that can publish to **Instagram, Facebook Pages, and Threads** with Reels, Stories, and Carousels included.

> It’s organized so adding new ops is just a few lines in `/lib/ops.ts` or the small platform adapters.

---

# Folder layout

```
meta-publisher/
├─ package.json
├─ tsconfig.json
├─ src/
│  ├─ index.ts
│  ├─ nodes/
│  │  └─ MetaPublisher.node.ts
│  ├─ credentials/
│  │  └─ MetaGraphApi.credentials.ts
│  └─ lib/
│     ├─ client.ts
│     ├─ poll.ts
│     ├─ types.ts
│     ├─ ig.ts
│     ├─ fb.ts
│     ├─ threads.ts
│     └─ ops.ts
```

---

# package.json

```json
{
	"name": "n8n-nodes-meta-publisher",
	"version": "1.0.0",
	"description": "Publish to Instagram, Facebook Pages, and Threads (images, videos, reels, stories, carousels).",
	"license": "MIT",
	"keywords": ["n8n-community-node", "instagram", "facebook", "threads", "meta"],
	"main": "dist/index.js",
	"types": "dist/index.d.ts",
	"scripts": {
		"build": "tsc -p tsconfig.json",
		"dev": "tsc -w -p tsconfig.json"
	},
	"dependencies": {},
	"devDependencies": {
		"@types/node": "^20.11.30",
		"typescript": "^5.4.5"
	}
}
```

---

# tsconfig.json

```json
{
	"compilerOptions": {
		"target": "ES2019",
		"module": "commonjs",
		"declaration": true,
		"outDir": "dist",
		"rootDir": "src",
		"strict": true,
		"esModuleInterop": true,
		"skipLibCheck": true
	},
	"include": ["src/**/*.ts"]
}
```

---

# src/index.ts

```ts
import { MetaPublisher } from './nodes/MetaPublisher.node';
import { MetaGraphApi } from './credentials/MetaGraphApi.credentials';

export const nodes = [MetaPublisher];
export const credentials = [MetaGraphApi];
```

---

# src/credentials/MetaGraphApi.credentials.ts

```ts
import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MetaGraphApi implements ICredentialType {
	name = 'metaGraphApi';
	displayName = 'Meta Graph API (Access Token)';
	documentationUrl = 'https://developers.facebook.com/';
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Page/IG/Threads access token. If OAuth2 is also configured, OAuth2 takes precedence.',
		},
	];
}
```

> You can also wire OAuth2 with n8n’s built‑in `oAuth2Api` credential. This node tries OAuth2 first, then falls back to this token.

---

# src/lib/types.ts

```ts
export type Platform = 'instagram' | 'facebook' | 'threads';

export type IgStatusCode = 'IN_PROGRESS' | 'FINISHED' | 'ERROR';
export type ThreadsStatusCode = 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';

export type CarouselItem = { type: 'image' | 'video'; url: string; altText?: string };

export type PublishResult = {
	platform: Platform;
	type: 'image' | 'video' | 'reel' | 'story' | 'carousel' | 'text';
	creationId?: string; // IG/Threads container or parent
	children?: string[]; // for carousels
	status?: string; // platform status
	published?: boolean;
	publishResult?: any; // media/thread object
	result?: any; // FB photo response, etc.
	videoId?: string; // FB video id
};
```

---

# src/lib/client.ts

```ts
import type { IExecuteFunctions } from 'n8n-workflow';

export const GRAPH_VERSION = 'v20.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function isAbsolute(u: string) {
	return /^https?:\/\//i.test(u);
}

export async function apiRequest(
	thisArg: IExecuteFunctions,
	method: 'GET' | 'POST',
	endpoint: string,
	qs: Record<string, any> = {},
	body: Record<string, any> = {},
	itemIndex = 0,
): Promise<any> {
	const url = isAbsolute(endpoint) ? endpoint : `${GRAPH_BASE}${endpoint}`;
	const options: any = { method, url, qs, body, json: true };

	// Try OAuth2 first
	try {
		return await thisArg.helpers.requestWithAuthentication.call(thisArg, 'oAuth2Api', options);
	} catch (e: any) {
		if (!String(e?.message || '').includes('is not configured')) throw e;
	}

	// Fallback to raw access token credential
	try {
		const cred: any = await (thisArg.getCredentials as any)('metaGraphApi');
		if (cred?.accessToken) {
			options.qs = { ...qs, access_token: cred.accessToken };
			return await thisArg.helpers.request(options);
		}
	} catch {
		// no credential, keep going to plain request
	}

	return thisArg.helpers.request(options);
}
```

---

# src/lib/poll.ts

```ts
export async function pollUntil<T>({
	check,
	isDone,
	intervalMs = 2000,
	maxMs = 180000,
	backoffJitter = true,
}: {
	check: () => Promise<T>;
	isDone: (r: T) => boolean;
	intervalMs?: number;
	maxMs?: number;
	backoffJitter?: boolean;
}): Promise<T> {
	const start = Date.now();
	let attempt = 0;
	let res: T;

	while (true) {
		attempt++;
		res = await check();
		if (isDone(res)) return res;

		if (Date.now() - start >= maxMs) return res;
		const jitter = backoffJitter ? Math.min(300, attempt * 30) : 0;
		await new Promise((r) => setTimeout(r, intervalMs + jitter));
	}
}
```

---

# src/lib/ig.ts

```ts
import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';
import type { IgStatusCode } from './types';

export type IgStatus = { status_code?: IgStatusCode };

export type IgCreateArgs =
	| { kind: 'IMAGE'; igUserId: string; url: string; caption?: string }
	| { kind: 'VIDEO'; igUserId: string; url: string; caption?: string; coverUrl?: string }
	| {
			kind: 'REELS';
			igUserId: string;
			url: string;
			caption?: string;
			thumbOffsetMs?: number;
			shareToFeed?: boolean;
	  }
	| { kind: 'STORY_IMAGE'; igUserId: string; url: string; caption?: string }
	| { kind: 'STORY_VIDEO'; igUserId: string; url: string; caption?: string }
	| { kind: 'CAROUSEL_PARENT'; igUserId: string; children: string[]; caption?: string }
	| { kind: 'CAROUSEL_CHILD_IMAGE'; igUserId: string; url: string }
	| { kind: 'CAROUSEL_CHILD_VIDEO'; igUserId: string; url: string };

export async function igCreateContainer(ctx: IExecuteFunctions, i: number, a: IgCreateArgs) {
	const base = (body: Record<string, any>) =>
		apiRequest.call(ctx, 'POST', `/${encodeURIComponent((a as any).igUserId)}/media`, {}, body, i);

	switch (a.kind) {
		case 'IMAGE':
			return (await base({ image_url: a.url, caption: a.caption }))?.id as string;
		case 'VIDEO':
			return (
				await base({
					video_url: a.url,
					media_type: 'VIDEO',
					caption: a.caption,
					cover_url: a.coverUrl,
				})
			)?.id as string;
		case 'REELS': {
			const body: any = { video_url: a.url, media_type: 'REELS', caption: a.caption };
			if (typeof a.thumbOffsetMs === 'number') body.thumb_offset = Math.floor(a.thumbOffsetMs);
			if (typeof a.shareToFeed === 'boolean') body.share_to_feed = a.shareToFeed;
			return (await base(body))?.id as string;
		}
		case 'STORY_IMAGE':
			return (await base({ image_url: a.url, caption: a.caption, media_type: 'STORIES' }))
				?.id as string;
		case 'STORY_VIDEO':
			return (await base({ video_url: a.url, caption: a.caption, media_type: 'STORIES' }))
				?.id as string;
		case 'CAROUSEL_CHILD_IMAGE':
			return (await base({ image_url: a.url, is_carousel_item: true }))?.id as string;
		case 'CAROUSEL_CHILD_VIDEO':
			return (await base({ video_url: a.url, is_carousel_item: true }))?.id as string;
		case 'CAROUSEL_PARENT':
			return (await base({ caption: a.caption, media_type: 'CAROUSEL', children: a.children }))
				?.id as string;
	}
}

export function igGetStatus(this: IExecuteFunctions, creationId: string) {
	return apiRequest.call(
		this,
		'GET',
		`/${encodeURIComponent(creationId)}`,
		{ fields: 'status_code' },
		{},
	);
}

export async function igPublish(
	this: IExecuteFunctions,
	i: number,
	igUserId: string,
	creationId: string,
) {
	const res = await apiRequest.call(
		this,
		'POST',
		`/${encodeURIComponent(igUserId)}/media_publish`,
		{},
		{ creation_id: creationId },
		i,
	);
	if (!res?.id) throw new Error('IG publish failed: ' + JSON.stringify(res));
	return res;
}
```

---

# src/lib/fb.ts

```ts
import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';

export type FbPhotoResult = { id?: string; post_id?: string };
export type FbVideoStatus = { status?: { video_status?: string }; processing_progress?: number };

export async function fbPublishPhoto(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageId: string; mediaUrl: string; caption?: string },
) {
	const { pageId, mediaUrl, caption } = args;
	const body: any = { url: mediaUrl };
	if (caption) body.caption = caption;
	const res = await apiRequest.call(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/photos`,
		{},
		body,
		i,
	);
	if (!res?.id) throw new Error('FB photo publish failed: ' + JSON.stringify(res));
	return res as FbPhotoResult;
}

export async function fbCreateVideo(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageId: string; videoUrl: string; title?: string; description?: string },
) {
	const { pageId, videoUrl, title, description } = args;
	const body: any = { file_url: videoUrl };
	if (title) body.title = title;
	if (description) body.description = description;
	const res = await apiRequest.call(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/videos`,
		{},
		body,
		i,
	);
	const vid = (res?.video_id || res?.id) as string | undefined;
	if (!vid) throw new Error('FB video create failed: ' + JSON.stringify(res));
	return vid;
}

export async function fbGetVideoStatus(
	ctx: IExecuteFunctions,
	videoId: string,
): Promise<FbVideoStatus> {
	return apiRequest.call(
		ctx,
		'GET',
		`/${encodeURIComponent(videoId)}`,
		{ fields: 'status,processing_progress' },
		{},
	);
}
```

---

# src/lib/threads.ts

```ts
import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';

const T_BASE = 'https://graph.threads.net';

export type ThreadsStatus = {
	status?: 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';
	error_message?: string;
};

function tPost(thisArg: IExecuteFunctions, i: number, path: string, qs: any = {}) {
	return apiRequest.call(thisArg, 'POST', `${T_BASE}${path}`, qs, {}, i);
}
function tGet(thisArg: IExecuteFunctions, path: string, qs: any = {}) {
	return apiRequest.call(thisArg, 'GET', `${T_BASE}${path}`, qs, {});
}

export async function thCreateContainer(
	ctx: IExecuteFunctions,
	i: number,
	a: {
		userId: string;
		kind: 'TEXT' | 'IMAGE' | 'VIDEO';
		text?: string;
		imageUrl?: string;
		videoUrl?: string;
		altText?: string;
		replyToId?: string;
		topicTag?: string;
		locationId?: string;
	},
) {
	const qs: any = {};
	if (a.text) qs.text = a.text;
	if (a.replyToId) qs.reply_to_id = a.replyToId;
	if (a.topicTag) qs.topic_tag = a.topicTag;
	if (a.locationId) qs.location_id = a.locationId;

	if (a.kind === 'TEXT') qs.media_type = 'TEXT';
	if (a.kind === 'IMAGE') {
		qs.media_type = 'IMAGE';
		qs.image_url = a.imageUrl;
		if (a.altText) qs.alt_text = a.altText;
	}
	if (a.kind === 'VIDEO') {
		qs.media_type = 'VIDEO';
		qs.video_url = a.videoUrl;
		if (a.altText) qs.alt_text = a.altText;
	}

	const res = await tPost(ctx, i, `/${encodeURIComponent(a.userId)}/threads`, qs);
	if (!res?.id) throw new Error(`Threads create container failed: ${JSON.stringify(res)}`);
	return res.id as string;
}

export async function thCreateCarouselItem(
	ctx: IExecuteFunctions,
	i: number,
	a: { userId: string; type: 'image' | 'video'; url: string; altText?: string },
) {
	const qs: any = { is_carousel_item: true, media_type: a.type.toUpperCase() };
	if (a.type === 'image') qs.image_url = a.url;
	else qs.video_url = a.url;
	if (a.altText) qs.alt_text = a.altText;

	const res = await tPost(ctx, i, `/${encodeURIComponent(a.userId)}/threads`, qs);
	if (!res?.id) throw new Error(`Threads create carousel item failed: ${JSON.stringify(res)}`);
	return res.id as string;
}

export async function thCreateCarouselParent(
	ctx: IExecuteFunctions,
	i: number,
	a: { userId: string; children: string[]; text?: string },
) {
	const qs: any = { media_type: 'CAROUSEL', children: a.children.join(',') };
	if (a.text) qs.text = a.text;
	const res = await tPost(ctx, i, `/${encodeURIComponent(a.userId)}/threads`, qs);
	if (!res?.id) throw new Error(`Threads create carousel parent failed: ${JSON.stringify(res)}`);
	return res.id as string;
}

export async function thPublish(
	ctx: IExecuteFunctions,
	i: number,
	userId: string,
	containerId: string,
) {
	const res = await tPost(ctx, i, `/${encodeURIComponent(userId)}/threads_publish`, {
		creation_id: containerId,
	});
	if (!res?.id) throw new Error(`Threads publish failed: ${JSON.stringify(res)}`);
	return res; // { id: thread_id }
}

export async function thGetStatus(ctx: IExecuteFunctions, containerId: string) {
	return tGet(ctx, `/${encodeURIComponent(containerId)}/`, {
		fields: 'id,status,error_message',
	}) as Promise<ThreadsStatus>;
}
```

---

# src/lib/ops.ts

```ts
import type { IExecuteFunctions } from 'n8n-workflow';
import { pollUntil } from './poll';
import type { PublishResult, CarouselItem } from './types';

import { igCreateContainer, igGetStatus, igPublish } from './ig';
import { fbPublishPhoto, fbCreateVideo, fbGetVideoStatus } from './fb';
import {
	thCreateContainer,
	thCreateCarouselItem,
	thCreateCarouselParent,
	thGetStatus,
	thPublish,
} from './threads';

export const OPS = {
	/* ===================== Instagram ===================== */

	async publishImage(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			igUserId: string;
			mediaUrl: string;
			caption?: string;
			pollSec: number;
			maxWaitSec: number;
			autoPublish: boolean;
		},
	): Promise<PublishResult> {
		const id = await igCreateContainer(ctx, i, {
			kind: 'IMAGE',
			igUserId: a.igUserId,
			url: a.mediaUrl,
			caption: a.caption,
		});
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, id),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub = a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, id) : null;
		return {
			platform: 'instagram',
			type: 'image',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
		};
	},

	async publishVideo(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			igUserId: string;
			mediaUrl: string;
			caption?: string;
			coverUrl?: string;
			pollSec: number;
			maxWaitSec: number;
			autoPublish: boolean;
		},
	): Promise<PublishResult> {
		const id = await igCreateContainer(ctx, i, {
			kind: 'VIDEO',
			igUserId: a.igUserId,
			url: a.mediaUrl,
			caption: a.caption,
			coverUrl: a.coverUrl,
		});
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, id),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub = a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, id) : null;
		return {
			platform: 'instagram',
			type: 'video',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
		};
	},

	async publishReel(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			igUserId: string;
			videoUrl: string;
			caption?: string;
			thumbOffsetMs?: number;
			shareToFeed?: boolean;
			pollSec: number;
			maxWaitSec: number;
			autoPublish: boolean;
		},
	): Promise<PublishResult> {
		const id = await igCreateContainer(ctx, i, {
			kind: 'REELS',
			igUserId: a.igUserId,
			url: a.videoUrl,
			caption: a.caption,
			thumbOffsetMs: a.thumbOffsetMs,
			shareToFeed: a.shareToFeed,
		});
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, id),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub = a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, id) : null;
		return {
			platform: 'instagram',
			type: 'reel',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
		};
	},

	async publishStory(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			igUserId: string;
			mediaUrl: string;
			kind: 'image' | 'video';
			caption?: string;
			pollSec: number;
			maxWaitSec: number;
			autoPublish: boolean;
		},
	): Promise<PublishResult> {
		const id = await igCreateContainer(
			ctx,
			i,
			a.kind === 'image'
				? { kind: 'STORY_IMAGE', igUserId: a.igUserId, url: a.mediaUrl, caption: a.caption }
				: { kind: 'STORY_VIDEO', igUserId: a.igUserId, url: a.mediaUrl, caption: a.caption },
		);
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, id),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub = a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, id) : null;
		return {
			platform: 'instagram',
			type: 'story',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
		};
	},

	async publishCarousel(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			igUserId: string;
			items: CarouselItem[];
			caption?: string;
			pollSec: number;
			maxWaitSec: number;
			autoPublish: boolean;
		},
	): Promise<PublishResult> {
		if (a.items.length < 2 || a.items.length > 10) throw new Error('Carousel requires 2–10 items');
		const childIds: string[] = [];
		for (const it of a.items) {
			const child = await igCreateContainer(
				ctx,
				i,
				it.type === 'image'
					? { kind: 'CAROUSEL_CHILD_IMAGE', igUserId: a.igUserId, url: it.url }
					: { kind: 'CAROUSEL_CHILD_VIDEO', igUserId: a.igUserId, url: it.url },
			);
			childIds.push(child);
		}
		const parentId = await igCreateContainer(ctx, i, {
			kind: 'CAROUSEL_PARENT',
			igUserId: a.igUserId,
			children: childIds,
			caption: a.caption,
		});
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, parentId),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub =
			a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, parentId) : null;
		return {
			platform: 'instagram',
			type: 'carousel',
			creationId: parentId,
			children: childIds,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
		};
	},

	/* ===================== Facebook Pages ===================== */

	async publishFbPhoto(
		ctx: IExecuteFunctions,
		i: number,
		a: { pageId: string; imageUrl: string; caption?: string },
	): Promise<PublishResult> {
		const res = await fbPublishPhoto(ctx, i, {
			pageId: a.pageId,
			mediaUrl: a.imageUrl,
			caption: a.caption,
		});
		return { platform: 'facebook', type: 'image', result: res, published: true };
	},

	async publishFbVideo(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			pageId: string;
			videoUrl: string;
			title?: string;
			description?: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		const videoId = await fbCreateVideo(ctx, i, {
			pageId: a.pageId,
			videoUrl: a.videoUrl,
			title: a.title,
			description: a.description,
		});
		const status = await pollUntil({
			check: () => fbGetVideoStatus(ctx, videoId),
			isDone: (r: any) => {
				const s = (r?.status?.video_status || '').toLowerCase();
				return ['ready', 'error', 'live', 'published'].includes(s);
			},
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		return {
			platform: 'facebook',
			type: 'video',
			videoId,
			status: status?.status?.video_status,
			published: true,
		};
	},

	/* ===================== Threads ===================== */

	async threadsPublishText(
		ctx: IExecuteFunctions,
		i: number,
		a: { userId: string; text: string; pollSec: number; maxWaitSec: number },
	): Promise<PublishResult> {
		const id = await thCreateContainer(ctx, i, { userId: a.userId, kind: 'TEXT', text: a.text });
		const st = await pollUntil({
			check: () => thGetStatus(ctx, id),
			isDone: (r: any) => ['FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED'].includes(r?.status ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = ['FINISHED', 'PUBLISHED'].includes(st?.status ?? '');
		const pub = finished ? await thPublish(ctx, i, a.userId, id) : null;
		return {
			platform: 'threads',
			type: 'text',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
		};
	},

	async threadsPublishImage(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			userId: string;
			imageUrl: string;
			text?: string;
			altText?: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		const id = await thCreateContainer(ctx, i, {
			userId: a.userId,
			kind: 'IMAGE',
			imageUrl: a.imageUrl,
			text: a.text,
			altText: a.altText,
		});
		const st = await pollUntil({
			check: () => thGetStatus(ctx, id),
			isDone: (r: any) => ['FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED'].includes(r?.status ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = ['FINISHED', 'PUBLISHED'].includes(st?.status ?? '');
		const pub = finished ? await thPublish(ctx, i, a.userId, id) : null;
		return {
			platform: 'threads',
			type: 'image',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
		};
	},

	async threadsPublishVideo(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			userId: string;
			videoUrl: string;
			text?: string;
			altText?: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		const id = await thCreateContainer(ctx, i, {
			userId: a.userId,
			kind: 'VIDEO',
			videoUrl: a.videoUrl,
			text: a.text,
			altText: a.altText,
		});
		const st = await pollUntil({
			check: () => thGetStatus(ctx, id),
			isDone: (r: any) => ['FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED'].includes(r?.status ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = ['FINISHED', 'PUBLISHED'].includes(st?.status ?? '');
		const pub = finished ? await thPublish(ctx, i, a.userId, id) : null;
		return {
			platform: 'threads',
			type: 'video',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
		};
	},

	async threadsPublishCarousel(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			userId: string;
			items: CarouselItem[];
			text?: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		if (a.items.length < 2 || a.items.length > 20)
			throw new Error('Threads carousel requires 2–20 items');
		const childIds: string[] = [];
		for (const it of a.items) {
			childIds.push(
				await thCreateCarouselItem(ctx, i, {
					userId: a.userId,
					type: it.type,
					url: it.url,
					altText: it.altText,
				}),
			);
		}
		const parentId = await thCreateCarouselParent(ctx, i, {
			userId: a.userId,
			children: childIds,
			text: a.text,
		});
		const st = await pollUntil({
			check: () => thGetStatus(ctx, parentId),
			isDone: (r: any) => ['FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED'].includes(r?.status ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = ['FINISHED', 'PUBLISHED'].includes(st?.status ?? '');
		const pub = finished ? await thPublish(ctx, i, a.userId, parentId) : null;
		return {
			platform: 'threads',
			type: 'carousel',
			creationId: parentId,
			children: childIds,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
		};
	},
} as const;
```

---

# src/nodes/MetaPublisher.node.ts

```ts
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { OPS } from '../lib/ops';
import type { CarouselItem } from '../lib/types';

export class MetaPublisher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher',
		name: 'metaPublisher',
		group: ['transform'],
		version: 1,
		description: 'Publish to Instagram, Facebook Pages, and Threads',
		defaults: { name: 'Meta Publisher' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{ name: 'oAuth2Api', required: false },
			{ name: 'metaGraphApi', required: false },
		],
		properties: [
			/* ----------------------- PLATFORM & OPERATION ----------------------- */
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				default: 'instagram',
				options: [
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'Facebook Page', value: 'facebook' },
					{ name: 'Threads', value: 'threads' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'publishImage',
				options: [
					/* IG */
					{ name: 'Publish Image (IG)', value: 'publishImage' },
					{ name: 'Publish Video (IG)', value: 'publishVideo' },
					{ name: 'Publish Reel (IG)', value: 'publishReel' },
					{ name: 'Publish Story (IG)', value: 'publishStory' },
					{ name: 'Publish Carousel (IG)', value: 'publishCarousel' },
					/* FB */
					{ name: 'Publish Photo (FB Page)', value: 'publishFbPhoto' },
					{ name: 'Publish Video (FB Page)', value: 'publishFbVideo' },
					/* Threads */
					{ name: 'Publish Text (Threads)', value: 'threadsPublishText' },
					{ name: 'Publish Image (Threads)', value: 'threadsPublishImage' },
					{ name: 'Publish Video (Threads)', value: 'threadsPublishVideo' },
					{ name: 'Publish Carousel (Threads)', value: 'threadsPublishCarousel' },
				],
			},

			/* ----------------------- SHARED POLLING ----------------------- */
			{
				displayName: 'Polling Interval (sec)',
				name: 'pollSec',
				type: 'number',
				default: 2,
				typeOptions: { minValue: 1, maxValue: 60 },
				description: 'Check processing status every N seconds',
			},
			{
				displayName: 'Max Wait (sec)',
				name: 'maxWaitSec',
				type: 'number',
				default: 300,
				typeOptions: { minValue: 30, maxValue: 3600 },
				description: 'Stop polling after this many seconds',
			},

			/* ----------------------- INSTAGRAM FIELDS ----------------------- */
			{
				displayName: 'IG User ID',
				name: 'igUserId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['instagram'] } },
			},
			{
				displayName: 'Auto Publish (IG)',
				name: 'autoPublish',
				type: 'boolean',
				default: true,
				displayOptions: { show: { platform: ['instagram'] } },
			},

			// IG Image
			{
				displayName: 'Image URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishImage'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishImage'] } },
			},

			// IG Video
			{
				displayName: 'Video URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishVideo'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishVideo'] } },
			},
			{
				displayName: 'Cover Image URL',
				name: 'coverUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishVideo'] } },
			},

			// IG Reel
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishReel'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishReel'] } },
			},
			{
				displayName: 'Thumbnail Offset (ms)',
				name: 'thumbOffsetMs',
				type: 'number',
				default: 0,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishReel'] } },
			},
			{
				displayName: 'Share to Feed',
				name: 'shareToFeed',
				type: 'boolean',
				default: true,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishReel'] } },
			},

			// IG Story
			{
				displayName: 'Story Type',
				name: 'storyKind',
				type: 'options',
				default: 'image',
				options: [
					{ name: 'Image', value: 'image' },
					{ name: 'Video', value: 'video' },
				],
				displayOptions: { show: { platform: ['instagram'], operation: ['publishStory'] } },
			},
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['instagram'], operation: ['publishStory'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishStory'] } },
			},

			// IG Carousel
			{
				displayName: 'Items',
				name: 'items',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { platform: ['instagram'], operation: ['publishCarousel'] } },
				options: [
					{
						displayName: 'Item',
						name: 'item',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								default: 'image',
								options: [
									{ name: 'Image', value: 'image' },
									{ name: 'Video', value: 'video' },
								],
							},
							{ displayName: 'URL', name: 'url', type: 'string', default: '', required: true },
						],
					},
				],
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['instagram'], operation: ['publishCarousel'] } },
			},

			/* ----------------------- FACEBOOK FIELDS ----------------------- */
			{
				displayName: 'Page ID',
				name: 'pageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['facebook'] } },
			},

			// FB Photo
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['facebook'], operation: ['publishFbPhoto'] } },
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['facebook'], operation: ['publishFbPhoto'] } },
			},

			// FB Video
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['facebook'], operation: ['publishFbVideo'] } },
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['facebook'], operation: ['publishFbVideo'] } },
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['facebook'], operation: ['publishFbVideo'] } },
			},

			/* ----------------------- THREADS FIELDS ----------------------- */
			{
				displayName: 'Threads User ID',
				name: 'thUserId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['threads'] } },
			},

			// Threads Text
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishText'] } },
			},

			// Threads Image
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishImage'] } },
			},
			{
				displayName: 'Text (optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishImage'] } },
			},
			{
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishImage'] } },
			},

			// Threads Video
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishVideo'] } },
			},
			{
				displayName: 'Text (optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishVideo'] } },
			},
			{
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishVideo'] } },
			},

			// Threads Carousel
			{
				displayName: 'Items',
				name: 'thItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishCarousel'] } },
				options: [
					{
						displayName: 'Item',
						name: 'item',
						values: [
							{
								displayName: 'Type',
								name: 'type',
								type: 'options',
								default: 'image',
								options: [
									{ name: 'Image', value: 'image' },
									{ name: 'Video', value: 'video' },
								],
							},
							{ displayName: 'URL', name: 'url', type: 'string', default: '', required: true },
							{ displayName: 'Alt Text', name: 'altText', type: 'string', default: '' },
						],
					},
				],
			},
			{
				displayName: 'Text (optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: { show: { platform: ['threads'], operation: ['threadsPublishCarousel'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const platform = this.getNodeParameter('platform', i) as 'instagram' | 'facebook' | 'threads';
			const operation = this.getNodeParameter('operation', i) as string;

			const pollSec = this.getNodeParameter('pollSec', i, 2) as number;
			const maxWaitSec = this.getNodeParameter('maxWaitSec', i, 300) as number;

			let result: any;

			/* ================= IG ================= */
			if (platform === 'instagram') {
				const igUserId = this.getNodeParameter('igUserId', i) as string;
				const autoPublish = this.getNodeParameter('autoPublish', i, true) as boolean;

				switch (operation) {
					case 'publishImage': {
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						const caption = this.getNodeParameter('caption', i, '') as string;
						result = await OPS.publishImage(this, i, {
							igUserId,
							mediaUrl,
							caption,
							pollSec,
							maxWaitSec,
							autoPublish,
						});
						break;
					}
					case 'publishVideo': {
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						const caption = this.getNodeParameter('caption', i, '') as string;
						const coverUrl = this.getNodeParameter('coverUrl', i, '') as string;
						result = await OPS.publishVideo(this, i, {
							igUserId,
							mediaUrl,
							caption,
							coverUrl,
							pollSec,
							maxWaitSec,
							autoPublish,
						});
						break;
					}
					case 'publishReel': {
						const videoUrl = this.getNodeParameter('videoUrl', i) as string;
						const caption = this.getNodeParameter('caption', i, '') as string;
						const thumbOffsetMs = this.getNodeParameter('thumbOffsetMs', i, 0) as number;
						const shareToFeed = this.getNodeParameter('shareToFeed', i, true) as boolean;
						result = await OPS.publishReel(this, i, {
							igUserId,
							videoUrl,
							caption,
							thumbOffsetMs,
							shareToFeed,
							pollSec,
							maxWaitSec,
							autoPublish,
						});
						break;
					}
					case 'publishStory': {
						const mediaUrl = this.getNodeParameter('mediaUrl', i) as string;
						const kind = this.getNodeParameter('storyKind', i) as 'image' | 'video';
						const caption = this.getNodeParameter('caption', i, '') as string;
						result = await OPS.publishStory(this, i, {
							igUserId,
							mediaUrl,
							kind,
							caption,
							pollSec,
							maxWaitSec,
							autoPublish,
						});
						break;
					}
					case 'publishCarousel': {
						const itemsCol = this.getNodeParameter('items', i, {}) as { item?: CarouselItem[] };
						const caption = this.getNodeParameter('caption', i, '') as string;
						const itemsArr = itemsCol.item ?? [];
						result = await OPS.publishCarousel(this, i, {
							igUserId,
							items: itemsArr,
							caption,
							pollSec,
							maxWaitSec,
							autoPublish,
						});
						break;
					}
					default:
						throw new Error(`Unsupported IG operation: ${operation}`);
				}
			} else if (platform === 'facebook') {

			/* ================= FB ================= */
				const pageId = this.getNodeParameter('pageId', i) as string;

				switch (operation) {
					case 'publishFbPhoto': {
						const imageUrl = this.getNodeParameter('imageUrl', i) as string;
						const caption = this.getNodeParameter('caption', i, '') as string;
						result = await OPS.publishFbPhoto(this, i, { pageId, imageUrl, caption });
						break;
					}
					case 'publishFbVideo': {
						const videoUrl = this.getNodeParameter('videoUrl', i) as string;
						const title = this.getNodeParameter('title', i, '') as string;
						const description = this.getNodeParameter('description', i, '') as string;
						result = await OPS.publishFbVideo(this, i, {
							pageId,
							videoUrl,
							title,
							description,
							pollSec,
							maxWaitSec,
						});
						break;
					}
					default:
						throw new Error(`Unsupported Facebook operation: ${operation}`);
				}
			} else if (platform === 'threads') {

			/* ================= Threads ================= */
				const userId = this.getNodeParameter('thUserId', i) as string;

				switch (operation) {
					case 'threadsPublishText': {
						const text = this.getNodeParameter('text', i, '') as string;
						result = await OPS.threadsPublishText(this, i, { userId, text, pollSec, maxWaitSec });
						break;
					}
					case 'threadsPublishImage': {
						const imageUrl = this.getNodeParameter('imageUrl', i) as string;
						const text = this.getNodeParameter('text', i, '') as string;
						const altText = this.getNodeParameter('altText', i, '') as string;
						result = await OPS.threadsPublishImage(this, i, {
							userId,
							imageUrl,
							text,
							altText,
							pollSec,
							maxWaitSec,
						});
						break;
					}
					case 'threadsPublishVideo': {
						const videoUrl = this.getNodeParameter('videoUrl', i) as string;
						const text = this.getNodeParameter('text', i, '') as string;
						const altText = this.getNodeParameter('altText', i, '') as string;
						result = await OPS.threadsPublishVideo(this, i, {
							userId,
							videoUrl,
							text,
							altText,
							pollSec,
							maxWaitSec,
						});
						break;
					}
					case 'threadsPublishCarousel': {
						const thItemsCol = this.getNodeParameter('thItems', i, {}) as {
							item?: Array<{ type: 'image' | 'video'; url: string; altText?: string }>;
						};
						const text = this.getNodeParameter('text', i, '') as string;
						result = await OPS.threadsPublishCarousel(this, i, {
							userId,
							items: thItemsCol.item ?? [],
							text,
							pollSec,
							maxWaitSec,
						});
						break;
					}
					default:
						throw new Error(`Unsupported Threads operation: ${operation}`);
				}
			}

			out.push({ json: result });
		}

		return [out];
	}
}
```

---

## How to use / build

1. Put the folder in your n8n custom nodes directory (or publish as a package).
2. `pnpm install && pnpm build` (or `npm/yarn` if you prefer).
3. Start n8n with this node loaded.
4. Add credentials:
   - Either **OAuth2** (preferred) or the **Meta Graph API (Access Token)** credential.
   - FB Page publishing needs a **Page access token**; IG/Threads need their respective publish scopes.

5. Drop the **Meta Publisher** node and pick **Platform** + **Operation**.

---

## Notes & knobs you can extend

- **Graph version**: bump once in `lib/client.ts`.
- **Rate safety**: adjust `pollSec`/`maxWaitSec` per workflow; the poller has gentle jitter to be friendly.
- **Return fields**: after publish, you can fetch enriched fields (e.g., IG `permalink`, FB `permalink_url`) in `ops.ts` and include them in `publishResult`.
- **Idempotency**: if reruns are common, stash `creationId`/`videoId` in item JSON to skip re-creation safely.

If you want, I can also add a small **README.md** and an optional **OAuth2 credential template** that exchanges user tokens for Page tokens automatically (so users don’t paste tokens).

Yes — base it on the **starter**. It’s the right scaffold for community nodes (build → `dist/`, `n8n` manifest, linting, etc.). Below is a **ready-to-use** `package.json` tailored for our **MetaPublisher** node, aligned with the starter conventions and our file layout.

```json
{
	"name": "n8n-nodes-meta-publisher",
	"version": "1.0.0",
	"description": "Publish to Instagram, Facebook Pages, and Threads (images, videos, reels, stories, carousels) via Meta Graph APIs.",
	"keywords": [
		"n8n-community-node-package",
		"instagram",
		"facebook",
		"threads",
		"meta",
		"publisher"
	],
	"license": "MIT",
	"homepage": "https://github.com/<you>/n8n-nodes-meta-publisher",
	"author": {
		"name": "<Your Name>",
		"email": "<you@example.com>"
	},
	"repository": {
		"type": "git",
		"url": "https://github.com/<you>/n8n-nodes-meta-publisher.git"
	},
	"engines": {
		"node": ">=20.15"
	},
	"main": "dist/index.js",
	"types": "dist/index.d.ts",
	"files": ["dist"],
	"scripts": {
		"build": "npx rimraf dist && tsc && gulp build:icons",
		"dev": "tsc --watch",
		"format": "prettier src --write",
		"lint": "eslint src package.json",
		"lintfix": "eslint src package.json --fix",
		"prepublishOnly": "npm run build && npm run lint"
	},
	"n8n": {
		"n8nNodesApiVersion": 1,
		"credentials": ["dist/credentials/MetaGraphApi.credentials.js"],
		"nodes": ["dist/nodes/MetaPublisher.node.js"]
	},
	"peerDependencies": {
		"n8n-workflow": "*"
	},
	"dependencies": {
		"rimraf": "^6.0.1"
	},
	"devDependencies": {
		"@types/node": "^20.11.30",
		"@typescript-eslint/parser": "~8.32.0",
		"eslint": "^8.57.0",
		"eslint-plugin-n8n-nodes-base": "^1.16.3",
		"gulp": "^5.0.0",
		"prettier": "^3.5.3",
		"typescript": "^5.8.2"
	}
}
```

### What changed vs the starter (and why)

- **`main`/`types` → `dist/*`**: matches the compiled output (starter sometimes leaves `index.js` root—use `dist`).
- **`n8n` manifest**: points to our compiled files:
  - `dist/credentials/MetaGraphApi.credentials.js`
  - `dist/nodes/MetaPublisher.node.js`

- **Scripts**: same build flow as starter (`rimraf` + `tsc` + optional `gulp build:icons`).
  If you don’t use icons yet, you can remove `gulp build:icons` (and `gulp` devDep).
- **Lint/format targets**: aimed at `src/` (since our code lives there).
- **Peer dep**: `n8n-workflow` stays a peer like the starter—keeps runtime lean.

### Folder layout (must match the manifest)

```
src/
  index.ts
  nodes/MetaPublisher.node.ts
  credentials/MetaGraphApi.credentials.ts
  lib/*.ts
dist/
  (compiled JS & d.ts)
```

### Quick tips

- Keep **CommonJS** output (tsconfig `module: "commonjs"`), which the starter expects.
- If you adopt the starter’s ESLint prepublish rules (`.eslintrc.prepublish.js`), restore the original `prepublishOnly` line that runs that config; otherwise the simplified `prepublishOnly` above is fine.
- If you later add SVG icons, include a tiny `gulpfile.js` (the starter has an example) so `gulp build:icons` converts them to base64 and injects them into the node description.

If you want, I can also drop in the **gulpfile** and a **.eslintrc** tuned for this repo, but you’re good to go with the package file above.

## MetaGraphApi.credentials.ts

import {
ICredentialType,
INodeProperties,
} from 'n8n-workflow';

export class MetaGraphApi implements ICredentialType {
name = 'metaGraphApi';
displayName = 'Meta Graph API';

    properties: INodeProperties[] = [
    	{
    		displayName: 'Access Token',
    		name: 'accessToken',
    		type: 'string',
    		typeOptions: { password: true },
    		default: '',
    		required: true,
    		description: 'Your long-lived Meta Graph API access token',
    	},
    ];

}

## JSON Input Source

Awesome—here’s a clean upgrade that lets **MetaPublisher** read inputs either from the usual **Fields** or from a **JSON payload** on the incoming item (e.g. `$json` or `$json.data`).

Below are **two drop-ins** for `src/nodes/MetaPublisher.node.ts`:

---

## 1) Add these properties (near the top of `properties`, before platform/operation)

```ts
/* ---------- Input source ---------- */
{
  displayName: 'Input Source',
  name: 'inputSource',
  type: 'options',
  default: 'fields',
  options: [
    { name: 'Fields', value: 'fields' },
    { name: 'From JSON Property', value: 'json' },
  ],
  description: 'Choose where this node should read its parameters from',
},
{
  displayName: 'JSON Property Path',
  name: 'jsonProp',
  type: 'string',
  default: '$json',
  placeholder: '$json or data',
  description:
    'Dot path inside the input item. Use "$json" to pass the whole item JSON, or "data" to pass $json.data, or e.g. "payload.post"',
  displayOptions: { show: { inputSource: ['json'] } },
},
```

> Users can now set **Input Source = From JSON Property** and provide `jsonProp = $json` or `data` etc.

---

## 2) Replace your `execute()` with this version (supports both modes)

```ts
async execute(this: IExecuteFunctions) {
  const items = this.getInputData();
  const out: INodeExecutionData[] = [];

  // small helpers
  const getFromPath = (root: any, path: string) => {
    if (!path || path === '$json') return root;
    return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), root);
  };
  const asArray = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

  // routes any "job" object to OPS (same keys used in our earlier design)
  const runJob = async (i: number, job: any) => {
    const platform = job.platform as 'instagram'|'facebook'|'threads';
    const operation = job.operation as string;

    // polling defaults: allow job to override node-level values
    const pollSec   = job.pollSec   ?? (this.getNodeParameter('pollSec', i, 2) as number);
    const maxWaitSec= job.maxWaitSec?? (this.getNodeParameter('maxWaitSec', i, 300) as number);

    switch (platform) {
      /* ================= IG ================= */
      case 'instagram': {
        const igUserId    = job.igUserId    ?? (this.getNodeParameter('igUserId', i) as string);
        const autoPublish = job.autoPublish ?? (this.getNodeParameter('autoPublish', i, true) as boolean);

        switch (operation) {
          case 'publishImage': {
            const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
            const caption  = job.caption  ?? (this.getNodeParameter('caption', i, '') as string);
            return OPS.publishImage(this, i, { igUserId, mediaUrl, caption, pollSec, maxWaitSec, autoPublish });
          }
          case 'publishVideo': {
            const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
            const caption  = job.caption  ?? (this.getNodeParameter('caption', i, '') as string);
            const coverUrl = job.coverUrl ?? (this.getNodeParameter('coverUrl', i, '') as string);
            return OPS.publishVideo(this, i, { igUserId, mediaUrl, caption, coverUrl, pollSec, maxWaitSec, autoPublish });
          }
          case 'publishReel': {
            const videoUrl      = job.videoUrl      ?? (this.getNodeParameter('videoUrl', i) as string);
            const caption       = job.caption       ?? (this.getNodeParameter('caption', i, '') as string);
            const thumbOffsetMs = job.thumbOffsetMs ?? (this.getNodeParameter('thumbOffsetMs', i, 0) as number);
            const shareToFeed   = job.shareToFeed   ?? (this.getNodeParameter('shareToFeed', i, true) as boolean);
            return OPS.publishReel(this, i, { igUserId, videoUrl, caption, thumbOffsetMs, shareToFeed, pollSec, maxWaitSec, autoPublish });
          }
          case 'publishStory': {
            const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
            const kind     = job.storyKind ?? (this.getNodeParameter('storyKind', i) as 'image'|'video');
            const caption  = job.caption  ?? (this.getNodeParameter('caption', i, '') as string);
            return OPS.publishStory(this, i, { igUserId, mediaUrl, kind, caption, pollSec, maxWaitSec, autoPublish });
          }
          case 'publishCarousel': {
            const itemsCol = job.items ?? ((this.getNodeParameter('items', i, {}) as any).item ?? []);
            const caption  = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
            return OPS.publishCarousel(this, i, { igUserId, items: itemsCol, caption, pollSec, maxWaitSec, autoPublish });
          }
          default:
            throw new Error(`Unsupported IG operation in JSON payload: ${operation}`);
        }
      }

      /* ================= FB ================= */
      case 'facebook': {
        const pageId = job.pageId ?? (this.getNodeParameter('pageId', i) as string);
        switch (operation) {
          case 'publishFbPhoto': {
            const imageUrl = job.imageUrl ?? (this.getNodeParameter('imageUrl', i) as string);
            const caption  = job.caption  ?? (this.getNodeParameter('caption', i, '') as string);
            return OPS.publishFbPhoto(this, i, { pageId, imageUrl, caption });
          }
          case 'publishFbVideo': {
            const videoUrl   = job.videoUrl   ?? (this.getNodeParameter('videoUrl', i) as string);
            const title      = job.title      ?? (this.getNodeParameter('title', i, '') as string);
            const description= job.description?? (this.getNodeParameter('description', i, '') as string);
            return OPS.publishFbVideo(this, i, { pageId, videoUrl, title, description, pollSec, maxWaitSec });
          }
          default:
            throw new Error(`Unsupported Facebook operation in JSON payload: ${operation}`);
        }
      }

      /* ================= Threads ================= */
      case 'threads': {
        const userId = job.thUserId ?? job.userId ?? (this.getNodeParameter('thUserId', i) as string);
        switch (operation) {
          case 'threadsPublishText': {
            const text = job.text ?? (this.getNodeParameter('text', i, '') as string);
            return OPS.threadsPublishText(this, i, { userId, text, pollSec, maxWaitSec });
          }
          case 'threadsPublishImage': {
            const imageUrl = job.imageUrl ?? (this.getNodeParameter('imageUrl', i) as string);
            const text     = job.text     ?? (this.getNodeParameter('text', i, '') as string);
            const altText  = job.altText  ?? (this.getNodeParameter('altText', i, '') as string);
            return OPS.threadsPublishImage(this, i, { userId, imageUrl, text, altText, pollSec, maxWaitSec });
          }
          case 'threadsPublishVideo': {
            const videoUrl = job.videoUrl ?? (this.getNodeParameter('videoUrl', i) as string);
            const text     = job.text     ?? (this.getNodeParameter('text', i, '') as string);
            const altText  = job.altText  ?? (this.getNodeParameter('altText', i, '') as string);
            return OPS.threadsPublishVideo(this, i, { userId, videoUrl, text, altText, pollSec, maxWaitSec });
          }
          case 'threadsPublishCarousel': {
            const itemsCol = job.items ?? ((this.getNodeParameter('thItems', i, {}) as any).item ?? []);
            const text     = job.text  ?? (this.getNodeParameter('text', i, '') as string);
            return OPS.threadsPublishCarousel(this, i, { userId, items: itemsCol, text, pollSec, maxWaitSec });
          }
          default:
            throw new Error(`Unsupported Threads operation in JSON payload: ${operation}`);
        }
      }

      default:
        throw new Error(`Unsupported platform in JSON payload: ${platform}`);
    }
  };

  for (let i = 0; i < items.length; i++) {
    const inputSource = this.getNodeParameter('inputSource', i) as 'fields' | 'json';

    try {
      if (inputSource === 'json') {
        // read external job(s) from item JSON
        const jsonProp = this.getNodeParameter('jsonProp', i) as string;
        const payload  = getFromPath(items[i].json, jsonProp === '$json' ? '' : jsonProp);
        if (payload == null) throw new Error(`No JSON found at path "${jsonProp}"`);

        const jobs = asArray(payload);
        for (const job of jobs) {
          if (!job || typeof job !== 'object') {
            if (this.continueOnFail()) {
              out.push({ json: { error: 'Invalid job payload (not an object)', sourcePath: jsonProp }, pairedItem: i });
              continue;
            }
            throw new Error('Invalid job payload (not an object)');
          }
          const result = await runJob(i, job);
          out.push({ json: result });
        }
      } else {
        // regular field mode → build a "job" from node params and run once
        const platform  = this.getNodeParameter('platform', i) as 'instagram'|'facebook'|'threads';
        const operation = this.getNodeParameter('operation', i) as string;
        const job = { platform, operation }; // runJob will pull any missing fields from node params
        const result = await runJob(i, job);
        out.push({ json: result });
      }
    } catch (err: any) {
      if (this.continueOnFail()) {
        out.push({ json: { error: err.message || String(err) }, pairedItem: i });
        continue;
      }
      throw err;
    }
  }

  return [out];
}
```

---

## JSON payload examples

**Single job from `$json`**

```json
{
	"platform": "instagram",
	"operation": "publishImage",
	"igUserId": "1789...",
	"mediaUrl": "https://…/image.jpg",
	"caption": "hello world",
	"autoPublish": true
}
```

**Multiple jobs from `$json.data`**

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
			"imageUrl": "https://…/photo.jpg",
			"caption": "FB photo!"
		}
	]
}
```

Set **Input Source = From JSON Property** and **JSON Property Path = data** for the second example.

---

This keeps everything **DRY**:

- Field mode stays fully supported.
- JSON mode lets you pass **one object or an array**.
- Missing fields in JSON fall back to the node’s own parameters (nice for defaults).
- Works with `continueOnFail()` per item.

## Monetising it with this Thin N8n Setup

Short answer: **yes**—the cleanest way to monetize is to keep your IP on a **hosted API** and ship a **thin n8n node** that just calls your API. Users pay you for the API key/usage; your heavy logic (Meta plumbing, retries, queues, token handling) never ships to them.

Below is a concrete, minimal setup you can copy.

---

# Architecture (high-level)

- **n8n node (client, open source):** collects params (or JSON payload) → calls your SaaS API.
- **Your API (closed source):** validates key/plan → enqueues a job → does create→poll→publish against Meta → stores result → returns or webhooks back.
- **Auth/Billing:** per-key quotas + Stripe; usage metering per call; optional HMAC signatures.
- **Tokens:**
  - v1 (fast): node sends user’s Meta access token per request → API uses it, doesn’t store.
  - v2 (pro): OAuth on your API → store tokens securely; node only sends a **tokenRef**.

---

# API contract (proposed)

```
POST /v1/jobs
Headers:
  Authorization: Bearer <YOUR_API_KEY>
  Idempotency-Key: <uuid>        // optional but recommended
Body:
{
  "platform": "instagram|facebook|threads",
  "operation": "publishImage|publishVideo|publishReel|publishStory|publishCarousel|threadsPublishText|...",
  "args": { ... },               // same shape as our OPS args
  "accessToken": "EAAG...",      // v1 fast path OR
  "tokenRef": "tok_123",         // v2 (server-stored)
  "callbackUrl": "https://..."   // optional webhook
}

202 Accepted
{ "jobId": "job_abc", "status": "queued" }

GET /v1/jobs/{jobId}
200
{
  "jobId": "job_abc",
  "status": "queued|running|succeeded|failed|expired",
  "result": { ... },             // final PublishResult when succeeded
  "error": { "code": "...", "message": "..." } // when failed
}
```

**Webhook (optional):** POST to `callbackUrl` with the same `jobId/status/result`.

---

# n8n: thin “SaaS” node (calls your API)

### Credential (API key + base URL)

`src/credentials/PublisherApi.credentials.ts`

```ts
import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class PublisherApi implements ICredentialType {
	name = 'publisherApi';
	displayName = 'MetaPublisher API';
	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://api.metapublisher.io',
		},
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
		},
	];
}
```

### Node (Fields or JSON → create job → optionally poll)

`src/nodes/MetaPublisherSaaS.node.ts` (essentials)

```ts
import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';

export class MetaPublisherSaaS implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher (SaaS)',
		name: 'metaPublisherSaaS',
		group: ['transform'],
		version: 1,
		description: 'Calls your hosted Meta Publisher API',
		defaults: { name: 'Meta Publisher (SaaS)' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'publisherApi', required: true }],
		properties: [
			{
				displayName: 'Input Source',
				name: 'inputSource',
				type: 'options',
				default: 'fields',
				options: [
					{ name: 'Fields', value: 'fields' },
					{ name: 'From JSON Property', value: 'json' },
				],
			},
			{
				displayName: 'JSON Property Path',
				name: 'jsonProp',
				type: 'string',
				default: '$json',
				displayOptions: { show: { inputSource: ['json'] } },
			},

			// Field mode (simple)
			{
				displayName: 'Platform',
				name: 'platform',
				type: 'options',
				default: 'instagram',
				options: [
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'Facebook Page', value: 'facebook' },
					{ name: 'Threads', value: 'threads' },
				],
				displayOptions: { show: { inputSource: ['fields'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'string',
				default: 'publishImage',
				description: 'e.g. publishImage, publishReel, publishFbPhoto, threadsPublishText',
				displayOptions: { show: { inputSource: ['fields'] } },
			},
			{
				displayName: 'Args (JSON)',
				name: 'args',
				type: 'json',
				default: {},
				description:
					'Operation args object (e.g. { igUserId, mediaUrl, caption, pollSec, maxWaitSec })',
				displayOptions: { show: { inputSource: ['fields'] } },
			},

			// Behavior
			{ displayName: 'Wait for Completion', name: 'wait', type: 'boolean', default: true },
			{
				displayName: 'Max Wait (sec)',
				name: 'maxWaitSec',
				type: 'number',
				default: 180,
				typeOptions: { minValue: 5, maxValue: 3600 },
				displayOptions: { show: { wait: [true] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		const get = (obj: any, path: string) =>
			path === '$json' ? obj : path.split('.').reduce((o, k) => o?.[k], obj);

		for (let i = 0; i < items.length; i++) {
			try {
				const creds = (await this.getCredentials('publisherApi')) as {
					baseUrl: string;
					apiKey: string;
				};
				const base = creds.baseUrl.replace(/\/+$/, '');
				const headers = { authorization: `Bearer ${creds.apiKey}` };

				// Build request body
				let body: any;
				const inputSource = this.getNodeParameter('inputSource', i) as 'fields' | 'json';
				if (inputSource === 'json') {
					const jsonProp = this.getNodeParameter('jsonProp', i) as string;
					const payload = get(items[i].json, jsonProp);
					if (!payload) throw new Error(`No payload at ${jsonProp}`);
					body = Array.isArray(payload) ? payload.map((p) => ({ ...p })) : { ...payload };
				} else {
					body = {
						platform: this.getNodeParameter('platform', i),
						operation: this.getNodeParameter('operation', i),
						args: this.getNodeParameter('args', i, {}),
					};
				}

				// Create job(s)
				const create = async (job: any) => {
					const idemp = cryptoRandom();
					const res = (await this.helpers.request({
						method: 'POST',
						url: `${base}/v1/jobs`,
						headers: { ...headers, 'Idempotency-Key': idemp },
						json: true,
						body: job,
					})) as { jobId: string; status: string };

					const wait = this.getNodeParameter('wait', i, true) as boolean;
					if (!wait) return { jobId: res.jobId, status: res.status };

					const maxWaitSec = this.getNodeParameter('maxWaitSec', i, 180) as number;
					const started = Date.now();
					while (true) {
						const jr = (await this.helpers.request({
							method: 'GET',
							url: `${base}/v1/jobs/${res.jobId}`,
							headers,
							json: true,
						})) as any;
						if (['succeeded', 'failed', 'expired'].includes(jr.status)) return jr;
						if ((Date.now() - started) / 1000 > maxWaitSec)
							return { jobId: res.jobId, status: 'timeout' };
						await new Promise((r) => setTimeout(r, 2000));
					}
				};

				const results = Array.isArray(body)
					? await Promise.all(body.map(create))
					: [await create(body)];
				for (const r of results) out.push({ json: r });
			} catch (err: any) {
				if (this.continueOnFail()) {
					out.push({ json: { error: err.message || String(err) }, pairedItem: i });
					continue;
				}
				throw err;
			}
		}
		return [out];
	}
}

function cryptoRandom() {
	return 'idemp_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

> That’s it: your node is now just a **client**. Real logic lives on your server.

---

# Server (SaaS) sketch

### Queue worker (Node/TS)

- Express/Fastify API → enqueue to **BullMQ / SQS / Cloud Tasks**.
- Worker performs **create → poll → publish** using the **same OPS code** we already wrote (moved server-side).
- Persist job status/results in Redis/Postgres.
- Respect **rate limits/backoff**; retry on 429/5xx with idempotency.

### Express routes (pseudo)

```ts
app.post('/v1/jobs', auth, async (req, res) => {
	const { platform, operation, args, accessToken, tokenRef, callbackUrl } = req.body;
	const jobId = await queue.add(
		'publish',
		{ platform, operation, args, accessToken, tokenRef, callbackUrl },
		{ jobId: req.headers['idempotency-key'] },
	);
	res.status(202).json({ jobId, status: 'queued' });
});

app.get('/v1/jobs/:id', auth, async (req, res) => {
	const job = await store.get(req.params.id);
	res.json(job ?? { jobId: req.params.id, status: 'unknown' });
});
```

### Auth & billing

- **API keys** per workspace; check plan/quotas on `POST /v1/jobs`.
- **Usage metering:** increment per successful publish; expose `/v1/me/usage`.
- Optional **HMAC** of body: `X-Signature: sha256=...` to prevent tampering.
- **Stripe** webhook to adjust plan limits in real time.

### Tokens

- **v1:** accept `accessToken` in request; never store it.
- **v2:** implement OAuth on your API; store tokens encrypted; node sends `tokenRef`.

---

# Pros/Cons

**API/SaaS**

- ✅ Real IP protection
- ✅ Centralized fixes, rate-limit shields, retries
- ✅ Easy metering & billing
- ⚠️ You must run & secure the service

**Closed node only (no API)**

- 🚫 Code is visible (TS→JS). Obfuscation isn’t protection.
- ⚠️ Hard to meter/enforce licenses reliably.

---

If you want, I can also provide a **Fastify + BullMQ** starter (server + worker) and a **Stripe usage-based billing** snippet to get you live fast.
