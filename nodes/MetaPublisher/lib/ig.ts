import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';
import type { IgStatusCode } from './types';
import { retry } from './utils';

export type IgStatus = { status_code?: IgStatusCode };

export type IgCreateArgs =
	| {
	kind: 'IMAGE';
	igUserId: string;
	url: string;
	caption?: string;
	userTags?: { userId: string; x: number; y: number }[];
}
	| {
	kind: 'VIDEO';
	igUserId: string;
	url: string;
	caption?: string;
	coverUrl?: string;
	userTags?: { userId: string; x: number; y: number }[];
}
	| {
	kind: 'REELS';
	igUserId: string;
	url: string;
	caption?: string;
	thumbOffsetMs?: number;
	shareToFeed?: boolean;
	userTags?: { userId: string; x: number; y: number }[];
}
	| {
	kind: 'STORY_IMAGE';
	igUserId: string;
	url: string;
	caption?: string;
}
	| {
	kind: 'STORY_VIDEO';
	igUserId: string;
	url: string;
	caption?: string;
}
	| {
	kind: 'CAROUSEL_PARENT';
	igUserId: string;
	children: string[];
	caption?: string;
}
	| {
	kind: 'CAROUSEL_CHILD_IMAGE';
	igUserId: string;
	url: string;
	caption?: string;
	userTags?: { userId: string; x: number; y: number }[];
}
	| {
	kind: 'CAROUSEL_CHILD_VIDEO';
	igUserId: string;
	url: string;
	caption?: string;
	userTags?: { userId: string; x: number; y: number }[];
};

export async function igCreateContainer(ctx: IExecuteFunctions, i: number, a: IgCreateArgs) {
	const base = async (body: Record<string, any>) => {
		const response = await apiRequest(
			ctx,
			'POST',
			`/${encodeURIComponent((a as any).igUserId)}/media`,
			{},
			body,
			i,
		);
		return response;
	};

	// Convert camelCase userTags to Instagram API user_tags format
	const applyUserTags = (body: any) => {
		// Only kinds that support userTags
		if (
			a.kind === 'IMAGE' ||
			a.kind === 'VIDEO' ||
			a.kind === 'REELS' ||
			a.kind === 'CAROUSEL_CHILD_IMAGE' ||
			a.kind === 'CAROUSEL_CHILD_VIDEO'
		) {
			if (a.userTags?.length) {
				body.user_tags = a.userTags.map((t) => ({
					user_id: t.userId,
					x: t.x,
					y: t.y,
				}));
			}
		}

		return body;
	};

	switch (a.kind) {
		case 'IMAGE':
			return (
				await base(
					applyUserTags({
						image_url: a.url,
						caption: a.caption,
					}),
				)
			)?.id as string;

		case 'VIDEO':
			return (
				await base(
					applyUserTags({
						video_url: a.url,
						media_type: 'REELS',
						caption: a.caption,
						cover_url: a.coverUrl,
					}),
				)
			)?.id as string;

		case 'REELS': {
			const body: any = {
				video_url: a.url,
				media_type: 'REELS',
				caption: a.caption,
			};
			if (typeof a.thumbOffsetMs === 'number') body.thumb_offset = Math.floor(a.thumbOffsetMs);
			if (typeof a.shareToFeed === 'boolean') body.share_to_feed = a.shareToFeed;
			return (await base(applyUserTags(body)))?.id as string;
		}

		case 'STORY_IMAGE':
			// stories do NOT support user_tags
			return (
				await base({
					image_url: a.url,
					caption: a.caption,
					media_type: 'STORIES',
				})
			)?.id as string;

		case 'STORY_VIDEO':
			// stories do NOT support user_tags
			return (
				await base({
					video_url: a.url,
					caption: a.caption,
					media_type: 'STORIES',
				})
			)?.id as string;

		case 'CAROUSEL_CHILD_IMAGE':
			return (
				await base(
					applyUserTags({
						image_url: a.url,
						caption: a.caption,
						is_carousel_item: true,
					}),
				)
			)?.id as string;

		case 'CAROUSEL_CHILD_VIDEO':
			return (
				await base(
					applyUserTags({
						video_url: a.url,
						media_type: 'REELS',
						caption: a.caption,
					}),
				)
			)?.id as string;

		case 'CAROUSEL_PARENT':
			// parent containers never accept user_tags
			return (
				await base({
					caption: a.caption,
					media_type: 'CAROUSEL',
					children: a.children,
				})
			)?.id as string;
	}
}

export function igGetStatus(this: IExecuteFunctions, creationId: string) {
	return retry(
		async () => {
			return apiRequest(
				this,
				'GET',
				`/${encodeURIComponent(creationId)}`,
				{ fields: 'status_code,status' },
				{},
			);
		},
		{ tries: 8, delayMs: 5000 },
	);
}

export async function igGetPermalink(this: IExecuteFunctions, mediaId: string) {
	return retry(
		async () => {
			const res = await apiRequest(
				this,
				'GET',
				`/${encodeURIComponent(mediaId)}`,
				{ fields: 'permalink' },
				{},
			);
			return res?.permalink;
		},
		{ tries: 8, delayMs: 5000 },
	);
}

export async function igPublish(
	this: IExecuteFunctions,
	i: number,
	igUserId: string,
	creationId: string,
) {
	return retry(
		async () => {
			const res = await apiRequest(
				this,
				'POST',
				`/${encodeURIComponent(igUserId)}/media_publish`,
				{},
				{ creation_id: creationId },
				i,
			);
			return res;
		},
		{ tries: 8, delayMs: 5000 },
	);
}
