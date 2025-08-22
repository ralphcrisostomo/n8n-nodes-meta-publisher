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
