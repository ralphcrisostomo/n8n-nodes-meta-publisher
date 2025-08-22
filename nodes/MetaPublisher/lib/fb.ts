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
	const res = await apiRequest(ctx, 'POST', `/${encodeURIComponent(pageId)}/photos`, {}, body, i);
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
	const res = await apiRequest(ctx, 'POST', `/${encodeURIComponent(pageId)}/videos`, {}, body, i);
	const vid = (res?.video_id || res?.id) as string | undefined;
	if (!vid) throw new Error('FB video create failed: ' + JSON.stringify(res));
	return vid;
}

export async function fbGetVideoStatus(
	ctx: IExecuteFunctions,
	videoId: string,
): Promise<FbVideoStatus> {
	return apiRequest(
		ctx,
		'GET',
		`/${encodeURIComponent(videoId)}`,
		{ fields: 'status,processing_progress' },
		{},
	);
}
