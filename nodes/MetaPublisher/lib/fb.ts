import type { IExecuteFunctions } from 'n8n-workflow';
import { apiRequest } from './client';
import { retry } from './utils';

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
	args: {
		pageAccessToken: any;
		pageId: string;
		mediaUrl: string;
		caption?: string;
		published: boolean;
	},
) {
	const { pageAccessToken, pageId, mediaUrl, caption, published } = args;
	const body: any = { url: mediaUrl, published };
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

export async function fbCreateStoryVideo(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; videoUrl: string },
) {
	const { pageAccessToken, pageId, videoUrl } = args;

	const { video_id, upload_url } = await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_stories`,
		{ ...pageAccessToken },
		{ upload_phase: 'start' },
		i,
	);
	if (!video_id && !upload_url)
		throw new Error('FB Story Video: no video_id or upload_url  returned from upload start');
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
	return video_id;
}

export async function fbCreateReel(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; videoUrl: string },
) {
	const { pageAccessToken, pageId, videoUrl } = args;

	const { video_id, upload_url } = await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_reels`,
		{ ...pageAccessToken },
		{ upload_phase: 'start' },
		i,
	);
	if (!video_id || !upload_url)
		throw new Error('FB Story Video: no video_id or upload_url  returned from upload start');

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
	return video_id;
}

export async function fbPublishStoryPhoto(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; photoId?: string },
) {
	const { pageAccessToken, pageId, photoId } = args;
	const body: any = {
		photo_id: photoId,
	};
	return await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/photo_stories`,
		{ ...pageAccessToken },
		body,
		i,
	);
}

export async function fbPublishStoryVideo(
	ctx: IExecuteFunctions,
	i: number,
	args: { pageAccessToken: any; pageId: string; videoId: string },
) {
	const { pageAccessToken, pageId, videoId } = args;
	const body: any = {
		video_id: videoId,
		upload_phase: 'finish',
	};
	return await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_stories`,
		{ ...pageAccessToken },
		body,
		i,
	);
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
	return await apiRequest(
		ctx,
		'POST',
		`/${encodeURIComponent(pageId)}/video_reels`,
		{ ...pageAccessToken },
		body,
		i,
	);
}

export async function fbGetPostPermalink(
	ctx: IExecuteFunctions,
	postId: string,
	pageAccessToken: any,
) {
	/**
	 *
	 * {
	 * "post_id": "1122...",
	 * "status": "published",
	 * "creation_time": "1756027535",
	 * "media_type": "photo",
	 * "url": "https://facebook.com/stories...",
	 * "media_id": "1122..."
	 * }
	 */
	return retry(
		async () => {
			const res = await apiRequest(
				ctx,
				'GET',
				`/${encodeURIComponent(postId)}`,
				{ access_token: pageAccessToken?.access_token },
				{},
			);
			return res?.url;
		},
		{ tries: 10, delayMs: 5000 },
	);
}

export async function fbGetVideoStatus(
	ctx: IExecuteFunctions,
	videoId: string,
	pageAccessToken: any,
): Promise<FbVideoStatus> {
	return retry(
		async () => {
			return apiRequest(
				ctx,
				'GET',
				`/${encodeURIComponent(videoId)}`,
				{ fields: 'status', access_token: pageAccessToken?.access_token },
				{},
			);
		},
		{ tries: 10, delayMs: 5000 },
	);
}

export async function fbGetPermalink(
	ctx: IExecuteFunctions,
	mediaId: string,
	pageAccessToken: any,
) {
	return retry(
		async () => {
			const res = await apiRequest(
				ctx,
				'GET',
				`/${encodeURIComponent(mediaId)}`,
				{ fields: 'permalink_url', access_token: pageAccessToken?.access_token },
				{},
			);
			const permalink = res?.permalink_url;
			return permalink.startsWith('/') ? `https://www.facebook.com${permalink}` : permalink;
		},
		{ tries: 10, delayMs: 5000 },
	);
}
