import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';

const T_BASE = 'https://graph.threads.net/v1.0';

export type ThreadsStatus = {
	status?: 'IN_PROGRESS' | 'FINISHED' | 'PUBLISHED' | 'ERROR' | 'EXPIRED';
	error_message?: string;
};

function tPost(thisArg: IExecuteFunctions, i: number, path: string, qs: any = {}) {
	return apiRequest(thisArg, 'POST', `${T_BASE}${path}`, qs, {}, i);
}
function tGet(thisArg: IExecuteFunctions, path: string, qs: any = {}) {
	return apiRequest(thisArg, 'GET', `${T_BASE}${path}`, qs, {});
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

export async function thGetPermalink(ctx: IExecuteFunctions, mediaId: string) {
	const res = await tGet(ctx, `/${encodeURIComponent(mediaId)}/`, {
		fields: 'permalink',
	});
	return res?.permalink;
}
