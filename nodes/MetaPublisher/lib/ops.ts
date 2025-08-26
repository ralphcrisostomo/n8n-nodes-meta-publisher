import type { IExecuteFunctions } from 'n8n-workflow';
import { pollUntil } from './poll';
import type { PublishResult, CarouselItem } from './types';

import { igCreateContainer, igGetStatus, igPublish, igGetPermalink } from './ig';
import {
	fbPublishPhoto,
	fbCreateVideo,
	fbGetVideoStatus,
	fbGetPermalink,
	fbCreateReel,
	fbPublishReel,
	fbGetPageAccessToken,
	fbCreateStoryVideo,
	fbPublishStoryVideo,
	fbPublishStoryPhoto,
	fbGetPostPermalink,
} from './fb';
import {
	thCreateContainer,
	thCreateCarouselItem,
	thCreateCarouselParent,
	thGetStatus,
	thPublish,
	thGetPermalink,
} from './threads';
import { sleep } from './utils';

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
		// Note: Adding delay to avoid "Too Many Requests" error
		await sleep(10000);
		const pub = a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, id) : null;
		const permalink = pub && pub.id ? await igGetPermalink.call(ctx, pub.id) : null;
		return {
			id: 'instagram-image',
			platform: 'instagram',
			type: 'image',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		const permalink = pub && pub.id ? await igGetPermalink.call(ctx, pub.id) : null;
		return {
			id: 'instagram-video',
			platform: 'instagram',
			type: 'video',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		const permalink = pub && pub.id ? await igGetPermalink.call(ctx, pub.id) : null;
		return {
			id: 'instagram-reel',
			platform: 'instagram',
			type: 'reel',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		const permalink = pub && pub.id ? await igGetPermalink.call(ctx, pub.id) : null;
		return {
			id: `instagram-story-${a.kind}`,
			platform: 'instagram',
			type: 'story',
			creationId: id,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		// 1) Create child containers
		const childIds: string[] = [];
		for (const it of a.items) {
			const child = await igCreateContainer(
				ctx,
				i,
				it.type === 'image'
					? { kind: 'CAROUSEL_CHILD_IMAGE', igUserId: a.igUserId, url: it.url, caption: it.caption }
					: {
							kind: 'CAROUSEL_CHILD_VIDEO',
							igUserId: a.igUserId,
							url: it.url,
							caption: it.caption,
						},
			);
			childIds.push(child);
		}
		// 2) Wait for every child to be FINISHED (videos can take time)
		const childStatuses: Record<string, 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'UNKNOWN'> = {};
		for (const childId of childIds) {
			const st = await pollUntil({
				check: () => igGetStatus.call(ctx, childId),
				isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
				intervalMs: a.pollSec * 1000,
				maxMs: a.maxWaitSec * 1000,
			});
			const code = (st?.status_code ?? 'UNKNOWN') as
				| 'IN_PROGRESS'
				| 'FINISHED'
				| 'ERROR'
				| 'UNKNOWN';
			childStatuses[childId] = code;

			if (code !== 'FINISHED') {
				// Do NOT create the parent if any child failed/never finished
				throw new Error(`Carousel child not ready: ${childId} status=${code}`);
			}
		}
		// 3) Create parent container
		const parentId = await igCreateContainer(ctx, i, {
			kind: 'CAROUSEL_PARENT',
			igUserId: a.igUserId,
			children: childIds,
			caption: a.caption,
		});
		// 4) Poll parent then (optionally) publish
		const status = await pollUntil({
			check: () => igGetStatus.call(ctx, parentId),
			isDone: (r: any) => ['FINISHED', 'ERROR'].includes(r?.status_code ?? ''),
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const finished = status?.status_code === 'FINISHED';
		const pub =
			a.autoPublish && finished ? await igPublish.call(ctx, i, a.igUserId, parentId) : null;
		const permalink = pub && pub.id ? await igGetPermalink.call(ctx, pub.id) : null;
		return {
			id: 'instagram-carousel',
			platform: 'instagram',
			type: 'carousel',
			creationId: parentId,
			children: childIds,
			childStatuses,
			status: status?.status_code,
			published: !!pub,
			publishResult: pub,
			permalink,
		};
	},

	/* ===================== Facebook Pages ===================== */

	async publishFbPhoto(
		ctx: IExecuteFunctions,
		i: number,
		a: { pageId: string; imageUrl: string; caption?: string },
	): Promise<PublishResult> {
		const pageAccessToken = await fbGetPageAccessToken(ctx, i, {
			pageId: a.pageId,
		});
		const publishResult = await fbPublishPhoto(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			mediaUrl: a.imageUrl,
			caption: a.caption,
			published: true,
		});
		const permalink =
			publishResult && publishResult.post_id
				? await fbGetPostPermalink(ctx, publishResult.post_id, pageAccessToken)
				: null;
		return {
			id: 'facebook-image',
			platform: 'facebook',
			type: 'image',
			publishResult,
			published: true,
			permalink,
		};
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
		const pageAccessToken = await fbGetPageAccessToken(ctx, i, {
			pageId: a.pageId,
		});
		const videoId = await fbCreateVideo(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			videoUrl: a.videoUrl,
			title: a.title,
			description: a.description,
		});
		const status = await pollUntil({
			check: () => fbGetVideoStatus(ctx, videoId, pageAccessToken),
			isDone: (r: any) => {
				const s = (r?.status?.video_status || '').toLowerCase();
				return ['ready', 'error', 'live', 'published'].includes(s);
			},
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const permalink = videoId ? await fbGetPermalink(ctx, videoId, pageAccessToken) : null;
		return {
			id: 'facebook-video',
			platform: 'facebook',
			type: 'video',
			videoId,
			status: status?.status?.video_status,
			published: true,
			permalink,
		};
	},

	async publishFbStoryPhoto(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			pageId: string;
			imageUrl: string;
		},
	): Promise<PublishResult> {
		const pageAccessToken = await fbGetPageAccessToken(ctx, i, {
			pageId: a.pageId,
		});
		const prePublishResult = await fbPublishPhoto(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			mediaUrl: a.imageUrl,
			published: false,
		});
		const publishResult = await fbPublishStoryPhoto(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			photoId: prePublishResult.id,
		});
		const permalink =
			publishResult && publishResult.post_id
				? await fbGetPostPermalink(ctx, publishResult.post_id, pageAccessToken)
				: null;
		return {
			id: 'facebook-story-photo', // TODO: Decide if we want to use 'photo' or 'image'
			platform: 'facebook',
			type: 'story',
			published: true,
			publishResult,
			permalink,
		};
	},

	async publishStoryFbVideo(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			pageId: string;
			videoUrl: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		const pageAccessToken = await fbGetPageAccessToken(ctx, i, {
			pageId: a.pageId,
		});
		const videoId = await fbCreateStoryVideo(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			videoUrl: a.videoUrl,
		});
		const status = await pollUntil({
			check: () => fbGetVideoStatus(ctx, videoId, pageAccessToken),
			isDone: (r: any) => {
				const s = (r?.status?.video_status || '').toLowerCase();
				return ['ready', 'error', 'live', 'published', 'upload_complete'].includes(s);
			},
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const publishResult = await fbPublishStoryVideo(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			videoId: videoId,
		});

		const permalink =
			publishResult && publishResult.post_id
				? await fbGetPostPermalink(ctx, publishResult.post_id, pageAccessToken)
				: null;
		return {
			id: 'facebook-story-video',
			platform: 'facebook',
			type: 'story',
			videoId,
			status: status?.status?.video_status,
			published: true,
			publishResult,
			permalink,
		};
	},

	async publishFbReel(
		ctx: IExecuteFunctions,
		i: number,
		a: {
			pageId: string;
			videoUrl: string;
			description?: string;
			pollSec: number;
			maxWaitSec: number;
		},
	): Promise<PublishResult> {
		const pageAccessToken = await fbGetPageAccessToken(ctx, i, {
			pageId: a.pageId,
		});

		const videoId = await fbCreateReel(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			videoUrl: a.videoUrl,
		});
		const status = await pollUntil({
			check: () => fbGetVideoStatus(ctx, videoId, pageAccessToken),
			isDone: (r: any) => {
				const s = (r?.status?.video_status || '').toLowerCase();
				return ['ready', 'error', 'live', 'published', 'upload_complete'].includes(s);
			},
			intervalMs: a.pollSec * 1000,
			maxMs: a.maxWaitSec * 1000,
		});
		const publishResult = await fbPublishReel(ctx, i, {
			pageAccessToken,
			pageId: a.pageId,
			videoId: videoId,
			description: a.description,
		});
		// Note: We use videoId instead of publishResult.post_id to get permalink
		const permalink = await fbGetPermalink(ctx, videoId, pageAccessToken);

		return {
			id: 'facebook-reel',
			platform: 'facebook',
			type: 'reel',
			videoId,
			status: status?.status?.video_status,
			published: true,
			publishResult,
			permalink,
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
		const permalink = pub && pub.id ? await thGetPermalink(ctx, pub.id) : null;
		return {
			id: `threads-text`,
			platform: 'threads',
			type: 'text',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		const permalink = pub && pub.id ? await thGetPermalink(ctx, pub.id) : null;
		return {
			id: `threads-image`,
			platform: 'threads',
			type: 'image',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		const permalink = pub && pub.id ? await thGetPermalink(ctx, pub.id) : null;
		return {
			id: `threads-video`,
			platform: 'threads',
			type: 'video',
			creationId: id,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
			permalink,
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
		// 2) Wait for every child to be FINISHED (videos can take time)
		const childStatuses: Record<string, 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'UNKNOWN'> = {};
		for (const childId of childIds) {
			const st = await pollUntil({
				check: () => thGetStatus(ctx, childId),
				isDone: (r: any) => ['FINISHED', 'PUBLISHED', 'ERROR', 'EXPIRED'].includes(r?.status ?? ''),
				intervalMs: a.pollSec * 1000,
				maxMs: a.maxWaitSec * 1000,
			});
			const code = (st?.status ?? 'UNKNOWN') as 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'UNKNOWN';
			childStatuses[childId] = code;

			if (code !== 'FINISHED') {
				// Do NOT create the parent if any child failed/never finished
				throw new Error(`Carousel child not ready: ${childId} status=${code}`);
			}
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
		const permalink = pub && pub.id ? await thGetPermalink(ctx, pub.id) : null;
		return {
			id: `threads-carousel`,
			platform: 'threads',
			type: 'carousel',
			creationId: parentId,
			children: childIds,
			childStatuses,
			status: st?.status,
			published: !!pub,
			publishResult: pub,
			permalink,
		};
	},
} as const;
