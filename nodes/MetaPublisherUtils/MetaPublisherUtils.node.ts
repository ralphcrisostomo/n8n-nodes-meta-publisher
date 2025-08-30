import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';
import {
	EXAMPLE_ALT_TEXT,
	EXAMPLE_CAPTION,
	EXAMPLE_DESCRIPTION,
	EXAMPLE_IMAGE_URL,
	EXAMPLE_TEXT,
	EXAMPLE_TITLE,
	EXAMPLE_VIDEO_URL,
	PUBLISH_CAROUSEL,
	PUBLISH_FB_PHOTO,
	PUBLISH_FB_REEL,
	PUBLISH_FB_STORY_PHOTO,
	PUBLISH_FB_STORY_VIDEO,
	PUBLISH_FB_VIDEO,
	PUBLISH_IMAGE,
	PUBLISH_REEL,
	PUBLISH_STORY,
	PUBLISH_VIDEO,
	THREADS_PUBLISH_CAROUSEL,
	THREADS_PUBLISH_IMAGE,
	THREADS_PUBLISH_TEXT,
	THREADS_PUBLISH_VIDEO,
} from '../MetaPublisher/lib/constant';

// ─── UI Hints ──────────────────────────────────────────────────────────────
const IG_FEED_IMAGE_RATIO_HINT =
	'Allowed aspect ratios: 4:5 (0.8) to 1.91:1. Recommended: 1080×1350 (portrait), 1080×1080 (square), 1080×608 (landscape).';
const IG_STORY_RATIO_HINT = 'Stories are 9:16 (~0.5625). Recommended: 1080×1920.';
const IG_REEL_RATIO_HINT =
	'Reels are 9:16 recommended (1080×1920). Other ratios may be letterboxed.';

export class MetaPublisherUtils implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher Utils',
		version: 2, // bump version

		description:
			'⚠️ Deprecated. Please switch to “Meta Publisher JSON Generator”. This node will be removed in a future release.',

		hints: [
			{
				type: 'warning',
				message:
					'This node is deprecated. Use “MetaPublisher JSON Generator” instead. Workflows still run, but you should migrate soon.',
				location: 'ndv',
			},
		],

		name: 'metaPublisherUtils',
		icon: { light: 'file:MetaPublisher.svg', dark: 'file:MetaPublisher.svg' },
		group: ['transform'],
		subtitle: '⚠️ Deprecated',
		defaults: { name: 'Meta Publisher Utils' },
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		properties: [
			{
				displayName: 'Deprecated Notice',
				name: 'deprecatedNotice',
				type: 'notice',
				default: '',
				description:
					'This node will be removed in a future release. Please migrate to “Meta Publisher JSON Generator”.',
			},
			/* ---------------- Resources (checkboxes) ---------------- */
			{
				displayName: 'Resources',
				name: 'resources',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'Facebook Page', value: 'facebook' },
					{ name: 'Threads', value: 'threads' },
				],
				description: 'Choose which platforms to generate jobs for',
			},

			/* ---------------- Instagram ops ---------------- */
			{
				displayName: 'Instagram Operations',
				name: 'igOps',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Publish Carousel', value: PUBLISH_CAROUSEL },

					{ name: 'Publish Image', value: PUBLISH_IMAGE },

					{ name: 'Publish Reel', value: PUBLISH_REEL },
					{ name: 'Publish Story', value: PUBLISH_STORY },
					{ name: 'Publish Video', value: PUBLISH_VIDEO },
				],
				displayOptions: { show: { resources: ['instagram'] } },
			},
			{
				displayName: 'IG User ID',
				name: 'igUserId',
				type: 'string',
				default: '',
				displayOptions: { show: { resources: ['instagram'] } },
			},
			{
				displayName: 'Auto Publish (IG)',
				name: 'igAutoPublish',
				type: 'boolean',
				default: true,
				displayOptions: { show: { resources: ['instagram'] } },
			},

			// Common IG fields
			{
				displayName: 'Image URL (Generic)',
				name: 'imageUrl',
				type: 'string',
				default: '',
				description:
					'Generic image URL used where a specific field is not provided (e.g., Threads/FB or IG Story fallback)',
			},
			{
				displayName: 'Video URL (Generic)',
				name: 'videoUrl',
				type: 'string',
				default: '',
				description:
					'Generic video URL used where a specific field is not provided (e.g., IG Story/FB/Threads fallback)',
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
			},

			// IG Feed: Image
			{
				displayName: 'Feed Image URL (4:5 to 1.91:1)',
				name: 'feedImageUrl',
				type: 'string',
				default: '',
				description: IG_FEED_IMAGE_RATIO_HINT,
				displayOptions: { show: { igOps: [PUBLISH_IMAGE], resources: ['instagram'] } },
			},
			// Story-specific
			{
				displayName: 'Story Image URL (9:16)',
				name: 'storyImageUrl',
				type: 'string',
				default: '',
				description: IG_STORY_RATIO_HINT,
				displayOptions: { show: { igOps: [PUBLISH_STORY], resources: ['instagram'] } },
			},
			{
				displayName: 'Story Video URL (9:16)',
				name: 'storyVideoUrl',
				type: 'string',
				default: '',
				description: IG_STORY_RATIO_HINT,
				displayOptions: { show: { igOps: [PUBLISH_STORY], resources: ['instagram'] } },
			},

			// IG video extras
			{
				displayName: 'Cover Image URL (IG Video)',
				name: 'coverUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { igOps: [PUBLISH_VIDEO] } },
			},

			// IG video extras
			{
				displayName: 'Cover Image URL (IG Video)',
				name: 'coverUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { igOps: [PUBLISH_VIDEO], resources: ['instagram'] } },
				description: 'Optional cover image for IG video. ' + IG_FEED_IMAGE_RATIO_HINT,
			},

			// IG reel extras
			{
				displayName: 'Reel Video URL (Override, 9:16 Recommended)',
				name: 'reelVideoUrl',
				type: 'string',
				default: '',
				description: IG_REEL_RATIO_HINT + ' If empty, falls back to Video URL (Generic).',
				displayOptions: { show: { igOps: [PUBLISH_REEL], resources: ['instagram'] } },
			},
			{
				displayName: 'Thumbnail Offset (Ms)',
				name: 'thumbOffsetMs',
				type: 'number',
				default: 0,
				displayOptions: { show: { igOps: [PUBLISH_REEL], resources: ['instagram'] } },
			},
			{
				displayName: 'Share to Feed',
				name: 'shareToFeed',
				type: 'boolean',
				default: true,
				displayOptions: { show: { igOps: [PUBLISH_REEL], resources: ['instagram'] } },
			},

			// IG carousel items
			{
				displayName: 'IG Carousel Items',
				name: 'igItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { igOps: [PUBLISH_CAROUSEL] } },
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
							{ displayName: 'URL', name: 'url', type: 'string', default: '' },
							{ displayName: 'Caption (Optional)', name: 'caption', type: 'string', default: '' },
						],
					},
				],
			},

			/* ---------------- Facebook ops ---------------- */
			{
				displayName: 'Facebook Operations',
				name: 'fbOps',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Publish Photo', value: PUBLISH_FB_PHOTO },
					{ name: 'Publish Reel', value: PUBLISH_FB_REEL },
					{ name: 'Publish Story Photo', value: PUBLISH_FB_STORY_PHOTO },
					{ name: 'Publish Story Video', value: PUBLISH_FB_STORY_VIDEO },
					{ name: 'Publish Video', value: PUBLISH_FB_VIDEO },
				],
				displayOptions: { show: { resources: ['facebook'] } },
			},
			{
				displayName: 'Page ID',
				name: 'pageId',
				type: 'string',
				default: '',
				displayOptions: { show: { resources: ['facebook'] } },
			},
			{
				displayName: 'FB Title (Video)',
				name: 'fbTitle',
				type: 'string',
				default: '',
				displayOptions: { show: { fbOps: [PUBLISH_FB_VIDEO] } },
			},
			{
				displayName: 'FB Description (Video | Reel)',
				name: 'fbDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { fbOps: [PUBLISH_FB_VIDEO, PUBLISH_FB_REEL] } },
			},

			/* ---------------- Threads ops ---------------- */
			{
				displayName: 'Threads Operations',
				name: 'thOps',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Publish Text', value: THREADS_PUBLISH_TEXT },
					{ name: 'Publish Image', value: THREADS_PUBLISH_IMAGE },
					{ name: 'Publish Video', value: THREADS_PUBLISH_VIDEO },
					{ name: 'Publish Carousel', value: THREADS_PUBLISH_CAROUSEL },
				],
				displayOptions: { show: { resources: ['threads'] } },
			},
			{
				displayName: 'Threads User ID',
				name: 'thUserId',
				type: 'string',
				default: '',
				displayOptions: { show: { resources: ['threads'] } },
			},
			{
				displayName: 'Threads Text',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						thOps: [
							THREADS_PUBLISH_TEXT,
							THREADS_PUBLISH_IMAGE,
							THREADS_PUBLISH_VIDEO,
							THREADS_PUBLISH_CAROUSEL,
						],
					},
				},
			},
			{
				displayName: 'Alt Text (Image/video)',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: { show: { thOps: [THREADS_PUBLISH_IMAGE, THREADS_PUBLISH_VIDEO] } },
			},
			{
				displayName: 'Threads Carousel Items',
				name: 'thItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { thOps: [THREADS_PUBLISH_CAROUSEL] } },
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
							{ displayName: 'URL', name: 'url', type: 'string', default: '' },
							{ displayName: 'Alt Text', name: 'altText', type: 'string', default: '' },
							{ displayName: 'Caption (Optional)', name: 'caption', type: 'string', default: '' },
						],
					},
				],
			},

			/* ---------------- Behavior ---------------- */
			{
				displayName: 'Skip Missing (Don’t Throw; Skip Incomplete Jobs)',
				name: 'skipMissing',
				type: 'boolean',
				default: true,
			},
			{
				displayName: 'Include Example Set (if Fields Missing)',
				name: 'includeExamples',
				type: 'boolean',
				default: false,
				description:
					'Whether to include example values to demonstrate the payload shape when you do not have real URLs or IDs yet',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			const jobs: any[] = [];
			const resources = (this.getNodeParameter('resources', i, []) as string[]) || [];
			const skipMissing = this.getNodeParameter('skipMissing', i, true) as boolean;
			const includeExamples = this.getNodeParameter('includeExamples', i, false) as boolean;

			// Common inputs
			const imageUrl = this.getNodeParameter('imageUrl', i, '') as string;
			const videoUrl = this.getNodeParameter('videoUrl', i, '') as string;
			const caption = this.getNodeParameter('caption', i, '') as string;

			/* ---------------- Instagram ---------------- */
			if (resources.includes('instagram')) {
				const igOps = (this.getNodeParameter('igOps', i, []) as string[]) || [];
				const igUserId = this.getNodeParameter('igUserId', i, '') as string;
				const igAutoPublish = this.getNodeParameter('igAutoPublish', i, true) as boolean;

				const storyImageUrl = this.getNodeParameter('storyImageUrl', i, '') as string;
				const storyVideoUrl = this.getNodeParameter('storyVideoUrl', i, '') as string;
				const coverUrl = this.getNodeParameter('coverUrl', i, '') as string;
				const reelVideoUrl = (this.getNodeParameter('reelVideoUrl', i, '') as string) || videoUrl;
				const thumbOffsetMs = this.getNodeParameter('thumbOffsetMs', i, 0) as number;
				const shareToFeed = this.getNodeParameter('shareToFeed', i, true) as boolean;
				const igItemsCol = (this.getNodeParameter('igItems', i, {}) as any).item ?? [];

				const needId = (need: boolean) => (need ? !!igUserId : true);
				const push = (o: any, required: boolean, msg: string) => {
					if (required && !needId(true)) {
						if (skipMissing) return;
						new NodeOperationError(this.getNode(), msg, { itemIndex: i });
					}
					jobs.push(o);
				};

				if (igOps.includes(PUBLISH_STORY)) {
					// Story (video)
					if (storyVideoUrl || videoUrl || includeExamples) {
						push(
							{
								resource: 'instagram',
								operation: PUBLISH_STORY,
								igUserId,
								mediaUrl: includeExamples
									? storyVideoUrl || videoUrl || EXAMPLE_VIDEO_URL
									: storyVideoUrl || videoUrl,
								caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
								storyKind: 'video',
								autoPublish: igAutoPublish,
							},
							true,
							'IG: igUserId is required for publishStory (video)',
						);
					}
					// Story (image)
					if (storyImageUrl || imageUrl || includeExamples) {
						push(
							{
								resource: 'instagram',
								operation: PUBLISH_STORY,
								igUserId,
								mediaUrl: includeExamples
									? storyImageUrl || imageUrl || EXAMPLE_IMAGE_URL
									: storyImageUrl || imageUrl,
								caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
								storyKind: 'image',
								autoPublish: igAutoPublish,
							},
							true,
							'IG: igUserId is required for publishStory (image)',
						);
					}
				}

				const feedImageUrl = this.getNodeParameter('feedImageUrl', i, '') as string;

				if (igOps.includes(PUBLISH_IMAGE) && (feedImageUrl || imageUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: PUBLISH_IMAGE,
							igUserId,
							mediaUrl: includeExamples
								? feedImageUrl || imageUrl || EXAMPLE_IMAGE_URL
								: feedImageUrl || imageUrl,
							caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishImage',
					);
				}

				if (igOps.includes(PUBLISH_VIDEO) && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: PUBLISH_VIDEO,
							igUserId,
							mediaUrl: videoUrl || EXAMPLE_VIDEO_URL,
							caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
							coverUrl: includeExamples ? coverUrl || EXAMPLE_IMAGE_URL : coverUrl,
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishVideo',
					);
				}

				if (igOps.includes(PUBLISH_REEL) && (reelVideoUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: PUBLISH_REEL,
							igUserId,
							videoUrl: includeExamples ? reelVideoUrl || EXAMPLE_VIDEO_URL : reelVideoUrl,
							caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
							thumbOffsetMs,
							shareToFeed,
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishReel',
					);
				}

				if (igOps.includes(PUBLISH_CAROUSEL)) {
					const items = igItemsCol.length
						? igItemsCol
						: includeExamples
							? [
									{ type: 'image', url: EXAMPLE_IMAGE_URL, caption: EXAMPLE_CAPTION },
									{ type: 'video', url: EXAMPLE_VIDEO_URL, caption: EXAMPLE_CAPTION },
								]
							: [];
					if (items.length >= 2) {
						push(
							{
								resource: 'instagram',
								operation: PUBLISH_CAROUSEL,
								igUserId,
								items,
								caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
								autoPublish: igAutoPublish,
							},
							true,
							'IG: igUserId is required for publishCarousel',
						);
					} else if (!skipMissing && igOps.includes(PUBLISH_CAROUSEL)) {
						const msg = 'IG: Carousel requires at least 2 items';
						new NodeOperationError(this.getNode(), msg, { itemIndex: i });
					}
				}
			}

			/* ---------------- Facebook ---------------- */
			if (resources.includes('facebook')) {
				const fbOps = (this.getNodeParameter('fbOps', i, []) as string[]) || [];
				const pageId = this.getNodeParameter('pageId', i, '') as string;
				const fbTitle = this.getNodeParameter('fbTitle', i, '') as string;
				const fbDescription = this.getNodeParameter('fbDescription', i, '') as string;

				const push = (o: any, reqId: boolean, msg: string) => {
					if (reqId && !pageId) {
						if (skipMissing) return;
						new NodeOperationError(this.getNode(), msg, { itemIndex: i });
					}
					jobs.push(o);
				};

				if (fbOps.includes(PUBLISH_FB_PHOTO) && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: PUBLISH_FB_PHOTO,
							pageId,
							imageUrl: imageUrl || EXAMPLE_IMAGE_URL,
							caption: includeExamples ? caption || EXAMPLE_CAPTION : caption,
						},
						true,
						'FB: pageId is required for publishFbPhoto',
					);
				}

				if (fbOps.includes(PUBLISH_FB_VIDEO) && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: PUBLISH_FB_VIDEO,
							pageId,
							videoUrl: videoUrl || EXAMPLE_VIDEO_URL,
							title: includeExamples ? fbTitle || EXAMPLE_TITLE : fbTitle,
							description: includeExamples ? fbDescription || EXAMPLE_DESCRIPTION : fbDescription,
						},
						true,
						'FB: pageId is required for publishFbVideo',
					);
				}

				if (fbOps.includes(PUBLISH_FB_STORY_PHOTO) && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: PUBLISH_FB_STORY_PHOTO,
							pageId,
							imageUrl: imageUrl || EXAMPLE_IMAGE_URL,
						},
						true,
						'FB: pageId is required for publishFbStoryPhoto',
					);
				}

				if (fbOps.includes(PUBLISH_FB_STORY_VIDEO) && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: PUBLISH_FB_STORY_VIDEO,
							pageId,
							videoUrl: videoUrl || EXAMPLE_VIDEO_URL,
						},
						true,
						'FB: pageId is required for publishFbStoryVideo',
					);
				}

				if (fbOps.includes(PUBLISH_FB_REEL) && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: PUBLISH_FB_REEL,
							pageId,
							videoUrl: videoUrl || EXAMPLE_VIDEO_URL,
							description: fbDescription || 'FB Reel Description',
						},
						true,
						'FB: pageId is required for publishFbReel',
					);
				}
			}

			/* ---------------- Threads ---------------- */
			if (resources.includes('threads')) {
				const thOps = (this.getNodeParameter('thOps', i, []) as string[]) || [];
				const thUserId = this.getNodeParameter('thUserId', i, '') as string;
				const text = this.getNodeParameter('text', i, '') as string;
				const altText = this.getNodeParameter('altText', i, '') as string;
				const thItemsCol = (this.getNodeParameter('thItems', i, {}) as any).item ?? [];

				const push = (o: any, reqId: boolean, msg: string) => {
					if (reqId && !thUserId) {
						if (skipMissing) return;
						new NodeOperationError(this.getNode(), msg, { itemIndex: i });
					}
					jobs.push(o);
				};

				if (thOps.includes(THREADS_PUBLISH_TEXT) && (text || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: THREADS_PUBLISH_TEXT,
							thUserId,
							text: text || EXAMPLE_TEXT,
						},
						true,
						'Threads: thUserId is required for threadsPublishText',
					);
				}

				if (thOps.includes(THREADS_PUBLISH_IMAGE) && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: THREADS_PUBLISH_IMAGE,
							thUserId,
							imageUrl: imageUrl || EXAMPLE_IMAGE_URL,
							text: text || EXAMPLE_CAPTION,
							altText: altText || EXAMPLE_ALT_TEXT,
						},
						true,
						'Threads: thUserId is required for threadsPublishImage',
					);
				}

				if (thOps.includes(THREADS_PUBLISH_VIDEO) && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: THREADS_PUBLISH_VIDEO,
							thUserId,
							videoUrl: videoUrl || EXAMPLE_VIDEO_URL,
							text: text || EXAMPLE_CAPTION,
							altText: altText || EXAMPLE_ALT_TEXT,
						},
						true,
						'Threads: thUserId is required for threadsPublishVideo',
					);
				}

				if (thOps.includes(THREADS_PUBLISH_CAROUSEL)) {
					const items = thItemsCol.length
						? thItemsCol
						: includeExamples
							? [
									{
										type: 'image',
										url: EXAMPLE_IMAGE_URL,
										altText: EXAMPLE_ALT_TEXT,
										caption: EXAMPLE_CAPTION,
									},
									{
										type: 'video',
										url: EXAMPLE_VIDEO_URL,
										altText: EXAMPLE_ALT_TEXT,
										caption: EXAMPLE_CAPTION,
									},
								]
							: [];
					if (items.length >= 2) {
						push(
							{
								resource: 'threads',
								operation: THREADS_PUBLISH_CAROUSEL,
								thUserId,
								items,
								text: text || EXAMPLE_CAPTION,
							},
							true,
							'Threads: thUserId is required for threadsPublishCarousel',
						);
					} else if (!skipMissing && thOps.includes(THREADS_PUBLISH_CAROUSEL)) {
						const msg = 'Threads: Carousel requires at least 2 items';
						new NodeOperationError(this.getNode(), msg, { itemIndex: i });
					}
				}
			}

			// Output: one item, with the array in json.data (safe shape for n8n)
			out.push({ json: { data: jobs, count: jobs.length } });
		}

		return [out];
	}
}
