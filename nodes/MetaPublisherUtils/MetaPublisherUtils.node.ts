import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

export class MetaPublisherUtils implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher Utils',
		name: 'metaPublisherUtils',
		icon: { light: 'file:MetaPublisher.svg', dark: 'file:MetaPublisher.svg' },
		group: ['transform'],
		version: 1,
		subtitle:
			'={{ (() => { \
				const r = $parameter["resources"] || []; \
				const label = r.length ? r.join(", ") : "Select resources"; \
				const ig = $parameter["igOps"] || []; \
				const fb = $parameter["fbOps"] || []; \
				const th = $parameter["thOps"] || []; \
				const total = ig.length + fb.length + th.length; \
				if (!total) return label + " · No ops"; \
				if (r.length === 1) { \
					const map = { instagram: ig, facebook: fb, threads: th }; \
					const ops = (map[r[0]] || []).join(", "); \
					return label + " · " + (ops || "No ops"); \
				} \
				return label + " · " + total + " op" + (total > 1 ? "s" : ""); \
			})() }}',
		description: 'Generate JSON payload(s) for Meta Publisher node',
		defaults: { name: 'Meta Publisher Utils' },
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		properties: [
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
					{ name: 'Publish Carousel', value: 'publishCarousel' },

					{ name: 'Publish Image', value: 'publishImage' },

					{ name: 'Publish Reel', value: 'publishReel' },
					{ name: 'Publish Story', value: 'publishStory' },
					{ name: 'Publish Video', value: 'publishVideo' },
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
			{ displayName: 'Image URL', name: 'imageUrl', type: 'string', default: '' },
			{ displayName: 'Video URL', name: 'videoUrl', type: 'string', default: '' },
			{ displayName: 'Caption', name: 'caption', type: 'string', default: '' },

			// Story-specific (optional, if you want different media for story)
			{
				displayName: 'Story Image URL',
				name: 'storyImageUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { igOps: ['publishStory'] } },
			},
			{
				displayName: 'Story Video URL',
				name: 'storyVideoUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { igOps: ['publishStory'] } },
			},

			// IG video extras
			{
				displayName: 'Cover Image URL (IG Video)',
				name: 'coverUrl',
				type: 'string',
				default: '',
				displayOptions: { show: { igOps: ['publishVideo'] } },
			},

			// IG reel extras
			{
				displayName: 'Reel Video URL (Override)',
				name: 'reelVideoUrl',
				type: 'string',
				default: '',
				description: 'If empty, falls back to Video URL',
				displayOptions: { show: { igOps: ['publishReel'] } },
			},
			{
				displayName: 'Thumbnail Offset (Ms)',
				name: 'thumbOffsetMs',
				type: 'number',
				default: 0,
				displayOptions: { show: { igOps: ['publishReel'] } },
			},
			{
				displayName: 'Share to Feed',
				name: 'shareToFeed',
				type: 'boolean',
				default: true,
				displayOptions: { show: { igOps: ['publishReel'] } },
			},

			// IG carousel items
			{
				displayName: 'IG Carousel Items',
				name: 'igItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { igOps: ['publishCarousel'] } },
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
					{ name: 'Publish Photo', value: 'publishFbPhoto' },
					{ name: 'Publish Video', value: 'publishFbVideo' },
					{ name: 'Publish Reel', value: 'publishFbReel' },
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
				displayOptions: { show: { fbOps: ['publishFbVideo'] } },
			},
			{
				displayName: 'FB Description (Video | Reel)',
				name: 'fbDescription',
				type: 'string',
				default: '',
				displayOptions: { show: { fbOps: ['publishFbVideo', 'publishFbReel'] } },
			},

			/* ---------------- Threads ops ---------------- */
			{
				displayName: 'Threads Operations',
				name: 'thOps',
				type: 'multiOptions',
				default: [],
				options: [
					{ name: 'Publish Text', value: 'threadsPublishText' },
					{ name: 'Publish Image', value: 'threadsPublishImage' },
					{ name: 'Publish Video', value: 'threadsPublishVideo' },
					{ name: 'Publish Carousel', value: 'threadsPublishCarousel' },
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
							'threadsPublishText',
							'threadsPublishImage',
							'threadsPublishVideo',
							'threadsPublishCarousel',
						],
					},
				},
			},
			{
				displayName: 'Alt Text (Image/video)',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: { show: { thOps: ['threadsPublishImage', 'threadsPublishVideo'] } },
			},
			{
				displayName: 'Threads Carousel Items',
				name: 'thItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { thOps: ['threadsPublishCarousel'] } },
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

				if (igOps.includes('publishStory')) {
					// Story (video)
					if (storyVideoUrl || videoUrl || includeExamples) {
						push(
							{
								resource: 'instagram',
								operation: 'publishStory',
								igUserId,
								mediaUrl: storyVideoUrl || videoUrl || 'https://example.com/video.mp4',
								caption: caption || 'Story (video)',
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
								operation: 'publishStory',
								igUserId,
								mediaUrl: storyImageUrl || imageUrl || 'https://example.com/story.jpg',
								caption: caption || 'Story (image)',
								storyKind: 'image',
								autoPublish: igAutoPublish,
							},
							true,
							'IG: igUserId is required for publishStory (image)',
						);
					}
				}

				if (igOps.includes('publishImage') && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: 'publishImage',
							igUserId,
							mediaUrl: imageUrl || 'https://example.com/image.jpg',
							caption,
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishImage',
					);
				}

				if (igOps.includes('publishVideo') && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: 'publishVideo',
							igUserId,
							mediaUrl: videoUrl || 'https://example.com/video.mp4',
							caption,
							coverUrl: coverUrl || 'https://example.com/cover.jpg',
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishVideo',
					);
				}

				if (igOps.includes('publishReel') && (reelVideoUrl || includeExamples)) {
					push(
						{
							resource: 'instagram',
							operation: 'publishReel',
							igUserId,
							videoUrl: reelVideoUrl || 'https://example.com/reel.mp4',
							caption,
							thumbOffsetMs,
							shareToFeed,
							autoPublish: igAutoPublish,
						},
						true,
						'IG: igUserId is required for publishReel',
					);
				}

				if (igOps.includes('publishCarousel')) {
					const items = igItemsCol.length
						? igItemsCol
						: includeExamples
							? [
									{ type: 'image', url: 'https://example.com/img1.jpg', caption: 'Image Caption' },
									{ type: 'video', url: 'https://example.com/vid1.mp4', caption: 'Video Caption' },
								]
							: [];
					if (items.length >= 2) {
						push(
							{
								resource: 'instagram',
								operation: 'publishCarousel',
								igUserId,
								items,
								caption,
								autoPublish: igAutoPublish,
							},
							true,
							'IG: igUserId is required for publishCarousel',
						);
					} else if (!skipMissing && igOps.includes('publishCarousel')) {
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

				if (fbOps.includes('publishFbPhoto') && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: 'publishFbPhoto',
							pageId,
							imageUrl: imageUrl || 'https://example.com/photo.jpg',
							caption,
						},
						true,
						'FB: pageId is required for publishFbPhoto',
					);
				}

				if (fbOps.includes('publishFbVideo') && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: 'publishFbVideo',
							pageId,
							videoUrl: videoUrl || 'https://example.com/video.mp4',
							title: fbTitle || 'FB Video Title',
							description: fbDescription || 'FB Video Description',
						},
						true,
						'FB: pageId is required for publishFbVideo',
					);
				}

				if (fbOps.includes('publishFbReel') && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'facebook',
							operation: 'publishFbReel',
							pageId,
							videoUrl: videoUrl || 'https://example.com/video.mp4',
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

				if (thOps.includes('threadsPublishText') && (text || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: 'threadsPublishText',
							thUserId,
							text: text || 'This is a Threads text post',
						},
						true,
						'Threads: thUserId is required for threadsPublishText',
					);
				}

				if (thOps.includes('threadsPublishImage') && (imageUrl || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: 'threadsPublishImage',
							thUserId,
							imageUrl: imageUrl || 'https://example.com/thread-img.jpg',
							text: text || 'Threads image caption',
							altText: altText || 'Alt text for accessibility',
						},
						true,
						'Threads: thUserId is required for threadsPublishImage',
					);
				}

				if (thOps.includes('threadsPublishVideo') && (videoUrl || includeExamples)) {
					push(
						{
							resource: 'threads',
							operation: 'threadsPublishVideo',
							thUserId,
							videoUrl: videoUrl || 'https://example.com/thread-video.mp4',
							text: text || 'Threads video caption',
							altText: altText || 'Alt text for video',
						},
						true,
						'Threads: thUserId is required for threadsPublishVideo',
					);
				}

				if (thOps.includes('threadsPublishCarousel')) {
					const items = thItemsCol.length
						? thItemsCol
						: includeExamples
							? [
									{
										type: 'image',
										url: 'https://example.com/thread-img1.jpg',
										altText: 'Alt 1',
										caption: 'Image Caption',
									},
									{
										type: 'video',
										url: 'https://example.com/thread-vid1.mp4',
										altText: 'Alt 2',
										caption: 'Video Caption',
									},
								]
							: [];
					if (items.length >= 2) {
						push(
							{
								resource: 'threads',
								operation: 'threadsPublishCarousel',
								thUserId,
								items,
								text: text || 'Threads carousel caption',
							},
							true,
							'Threads: thUserId is required for threadsPublishCarousel',
						);
					} else if (!skipMissing && thOps.includes('threadsPublishCarousel')) {
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
