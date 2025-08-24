import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';

export type FbPhotoResult = { id?: string; post_id?: string };
export type FbVideoStatus = { status?: { video_status?: string }; processing_progress?: number };

export async function fbGetPageAccessToken(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageId: string },
) {
	const { pageId } = args;
	return await apiRequest(
		ctx,
		'GET',
		`/${encodeURIComponent(pageId)}`,
		{ fields: 'access_token' },
		{},
		i,
	);
}

export async function fbPublishPhoto(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; mediaUrl: string; caption?: string },
) {
	const { pageAccessToken, pageId, mediaUrl, caption } = args;
	const body: any = { url: mediaUrl };
	if (caption) body.caption = caption;
	const res = await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/photos`,
		{ ...pageAccessToken },
		body,
		i,
	);
	if (!res?.id) throw new Error('FB photo publish failed: ' + JSON.stringify(res));
	return res as FbPhotoResult;
}

export async function fbCreateVideo(
	ctx: IExecuteFunctions,
	i: number,
	args: {
		pageAccessToken: any;
		pageId: string;
		videoUrl: string;
		title?: string;
		description?: string;
	},
) {
	const { pageAccessToken, pageId, videoUrl, title, description } = args;
	const body: any = { file_url: videoUrl };
	if (title) body.title = title;
	if (description) body.description = description;
	const res = await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/videos`,
		{ ...pageAccessToken },
		body,
		i,
	);
	const vid = (res?.video_id || res?.id) as string | undefined;
	if (!vid) throw new Error('FB video create failed: ' + JSON.stringify(res));
	return vid;
}

export async function fbCreateReel(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; videoUrl: string },
) {
	const { pageAccessToken, pageId, videoUrl } = args;

	const start = await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_reels`,
		{ ...pageAccessToken },
		{ upload_phase: 'start' },
		i,
	);
	const videoId = start?.video_id as string | undefined;
	const upload_url = start?.upload_url as string | undefined;
	if (!videoId) throw new Error('FB Reels: no video_id returned from upload start');
	if (!upload_url) throw new Error('FB Reels: no upload_url returned from upload start');

	const options: any = {
		method: 'POST',
		url: upload_url,
		// TODO: Refactor apiRequest to include header!
		headers: {
			Authorization: `OAuth ${pageAccessToken?.access_token}`,
			file_url: videoUrl,
		},
		json: true,
	};
	console.log('-------------------------');
	console.log(JSON.stringify({ options }, null, 2));
	const res = await ctx.helpers.request(options);
	console.log(JSON.stringify({ res }, null, 2));
	return videoId;
}

export async function fbPublishReel(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; videoId: string; description?: string },
) {
	const { pageAccessToken, pageId, videoId, description } = args;
	const body: any = {
		video_id: videoId,
		upload_phase: 'finish',
		video_state: 'PUBLISHED',
		description,
	};
	await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_reels`,
		{ ...pageAccessToken },
		body,
		i,
	);
}

export async function fbGetVideoStatus(
	ctx: IExecuteFunctions,
	videoId: string,
	pageAccessToken: any,
): Promise<FbVideoStatus> {
	return apiRequest(
		ctx,
		'GET',
		`/${encodeURIComponent(videoId)}`,
		{ fields: 'status', access_token: pageAccessToken?.access_token },
		{},
	);
}

export async function fbGetPermalink(
	ctx: IExecuteFunctions,
	mediaId: string,
	pageAccessToken: any,
) {
	const res = await apiRequest(
		ctx,
		'GET',
		`/${encodeURIComponent(mediaId)}`,
		{ fields: 'permalink_url', access_token: pageAccessToken?.access_token },
		{},
	);
	if (!res?.id) throw new Error('FB get permalink failed: ' + JSON.stringify(res));
	const permalink = res?.permalink_url;
	return permalink.startsWith('/') ? `https://www.facebook.com${permalink}` : permalink;
}
