import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

import { NodeOperationError } from 'n8n-workflow';

import { OPS } from './lib/ops';

export class MetaPublisher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher',
		name: 'metaPublisher',
		icon: { light: 'file:MetaPublisher.svg', dark: 'file:MetaPublisher.svg' },
		group: ['transform'],
		version: 1,
		subtitle:
			'={{ $parameter["inputSource"] === "json" ? "JSON: " + ($parameter["jsonProp"] || "$json") : ($parameter["operation"] || "Select operation") + " · " + (($parameter["resource"] || $parameter["platform"]) || "Select resource")}}',
		description: 'Publish to Instagram, Facebook Pages, and Threads',
		defaults: { name: 'Meta Publisher' },
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [{ name: 'metaGraphApi', required: true }],
		properties: [
			/* ----------------------- INPUT SOURCE ----------------------- */
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
					'Dot path inside the input item. Use "$JSON" to pass the whole item JSON, or "data" to pass $JSON.data, or e.g. "payload.post".',
				displayOptions: { show: { inputSource: ['json'] } },
			},

			/* ----------------------- PLATFORM & OPERATION ----------------------- */
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				default: 'instagram',
				noDataExpression: true,
				options: [
					{ name: 'Instagram', value: 'instagram' },
					{ name: 'Facebook Page', value: 'facebook' },
					{ name: 'Thread', value: 'threads' },
				],
				// Show resource selector only when using field-based config
				displayOptions: { show: { inputSource: ['fields'] } },
			},

			// Show only resource-specific operations (one "operation" property per resource)
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'publishImage',
				options: [
					{
						name: 'Publish Carousel (IG)',
						value: 'publishCarousel',
						action: 'Publish carousel on instagram',
					},
					{
						name: 'Publish Image (IG)',
						value: 'publishImage',
						action: 'Publish image on instagram',
					},
					{
						name: 'Publish Reel (IG)',
						value: 'publishReel',
						action: 'Publish reel on instagram',
					},
					{
						name: 'Publish Story (IG)',
						value: 'publishStory',
						action: 'Publish story on instagram',
					},
					{
						name: 'Publish Video (IG)',
						value: 'publishVideo',
						action: 'Publish video on instagram',
					},
				],
				displayOptions: { show: { inputSource: ['fields'], resource: ['instagram'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'publishFbPhoto',
				options: [
					{
						name: 'Publish Photo (FB Page)',
						value: 'publishFbPhoto',
						action: 'Publish photo photo facebook page',
					},
					{
						name: 'Publish Video (FB Page)',
						value: 'publishFbVideo',
						action: 'Publish video on facebook page',
					},
				],
				displayOptions: { show: { inputSource: ['fields'], resource: ['facebook'] } },
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				default: 'threadsPublishText',
				options: [
					{
						name: 'Publish Text (Threads)',
						value: 'threadsPublishText',
						action: 'Publish text on threads',
					},
					{
						name: 'Publish Image (Threads)',
						value: 'threadsPublishImage',
						action: 'Publish image on threads',
					},
					{
						name: 'Publish Video (Threads)',
						value: 'threadsPublishVideo',
						action: 'Publish video on threads',
					},
					{
						name: 'Publish Carousel (Threads)',
						value: 'threadsPublishCarousel',
						action: 'Publish carousel on threads',
					},
				],
				displayOptions: { show: { inputSource: ['fields'], resource: ['threads'] } },
			},

			/* ----------------------- SHARED POLLING ----------------------- */
			{
				displayName: 'Polling Interval (Sec)',
				name: 'pollSec',
				type: 'number',
				default: 2,
				typeOptions: { minValue: 1, maxValue: 60 },
				description: 'Check processing status every N seconds',
			},
			{
				displayName: 'Max Wait (Sec)',
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
				displayOptions: { show: { inputSource: ['fields'], resource: ['instagram'] } },
			},
			{
				displayName: 'Auto Publish (IG)',
				name: 'autoPublish',
				type: 'boolean',
				default: true,
				displayOptions: { show: { inputSource: ['fields'], resource: ['instagram'] } },
			},

			// IG Image
			{
				displayName: 'Image URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishImage'] },
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishImage'] },
				},
			},

			// IG Video
			{
				displayName: 'Video URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishVideo'] },
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishVideo'] },
				},
			},
			{
				displayName: 'Cover Image URL',
				name: 'coverUrl',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishVideo'] },
				},
			},

			// IG Reel
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishReel'] },
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishReel'] },
				},
			},
			{
				displayName: 'Thumbnail Offset (Ms)',
				name: 'thumbOffsetMs',
				type: 'number',
				default: 0,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishReel'] },
				},
			},
			{
				displayName: 'Share to Feed',
				name: 'shareToFeed',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishReel'] },
				},
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
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishStory'] },
				},
			},
			{
				displayName: 'Media URL',
				name: 'mediaUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishStory'] },
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['instagram'], operation: ['publishStory'] },
				},
			},

			// IG Carousel
			{
				displayName: 'Items',
				name: 'items',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['instagram'],
						operation: ['publishCarousel'],
					},
				},
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
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['instagram'],
						operation: ['publishCarousel'],
					},
				},
			},

			/* ----------------------- FACEBOOK FIELDS ----------------------- */
			{
				displayName: 'Page ID',
				name: 'pageId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { inputSource: ['fields'], resource: ['facebook'] } },
			},

			// FB Photo
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['facebook'], operation: ['publishFbPhoto'] },
				},
			},
			{
				displayName: 'Caption',
				name: 'caption',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['facebook'], operation: ['publishFbPhoto'] },
				},
			},

			// FB Video
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['facebook'], operation: ['publishFbVideo'] },
				},
			},
			{
				displayName: 'Title',
				name: 'title',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['facebook'], operation: ['publishFbVideo'] },
				},
			},
			{
				displayName: 'Description',
				name: 'description',
				type: 'string',
				default: '',
				displayOptions: {
					show: { inputSource: ['fields'], resource: ['facebook'], operation: ['publishFbVideo'] },
				},
			},

			/* ----------------------- THREADS FIELDS ----------------------- */
			{
				displayName: 'Threads User ID',
				name: 'thUserId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { inputSource: ['fields'], resource: ['threads'] } },
			},

			// Threads Text
			{
				displayName: 'Text',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishText'],
					},
				},
			},

			// Threads Image
			{
				displayName: 'Image URL',
				name: 'imageUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishImage'],
					},
				},
			},
			{
				displayName: 'Text (Optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishImage'],
					},
				},
			},
			{
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishImage'],
					},
				},
			},

			// Threads Video
			{
				displayName: 'Video URL',
				name: 'videoUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishVideo'],
					},
				},
			},
			{
				displayName: 'Text (Optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishVideo'],
					},
				},
			},
			{
				displayName: 'Alt Text',
				name: 'altText',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishVideo'],
					},
				},
			},

			// Threads Carousel
			{
				displayName: 'Items',
				name: 'thItems',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishCarousel'],
					},
				},
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
				displayName: 'Text (Optional)',
				name: 'text',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						inputSource: ['fields'],
						resource: ['threads'],
						operation: ['threadsPublishCarousel'],
					},
				},
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const items = this.getInputData();
		const out: INodeExecutionData[] = [];

		// helpers
		const getFromPath = (root: any, path: string) => {
			if (!path || path === '$json') return root;
			return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), root);
		};
		const asArray = <T>(x: T | T[]) => (Array.isArray(x) ? x : [x]);

		// convenience creator for NodeOperationError
		const opErr = (i: number, msgOrErr: string | Error) =>
			msgOrErr instanceof Error
				? new NodeOperationError(this.getNode(), msgOrErr, { itemIndex: i })
				: new NodeOperationError(this.getNode(), msgOrErr, { itemIndex: i });

		// routes any "job" object to OPS (same keys used in our earlier design)
		const runJob = async (i: number, job: any) => {
			const resource = job.resource as 'instagram' | 'facebook' | 'threads';
			const operation = job.operation as string;

			// polling defaults: allow job to override node-level values
			const pollSec = job.pollSec ?? (this.getNodeParameter('pollSec', i, 2) as number);
			const maxWaitSec = job.maxWaitSec ?? (this.getNodeParameter('maxWaitSec', i, 300) as number);

			switch (resource) {
				/* ================= IG ================= */
				case 'instagram': {
					const igUserId = job.igUserId ?? (this.getNodeParameter('igUserId', i) as string);
					const autoPublish =
						job.autoPublish ?? (this.getNodeParameter('autoPublish', i, true) as boolean);

					switch (operation) {
						case 'publishImage': {
							const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							return OPS.publishImage(this, i, {
								igUserId,
								mediaUrl,
								caption,
								pollSec,
								maxWaitSec,
								autoPublish,
							});
						}
						case 'publishVideo': {
							const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							const coverUrl = job.coverUrl ?? (this.getNodeParameter('coverUrl', i, '') as string);
							return OPS.publishVideo(this, i, {
								igUserId,
								mediaUrl,
								caption,
								coverUrl,
								pollSec,
								maxWaitSec,
								autoPublish,
							});
						}
						case 'publishReel': {
							const videoUrl = job.videoUrl ?? (this.getNodeParameter('videoUrl', i) as string);
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							const thumbOffsetMs =
								job.thumbOffsetMs ?? (this.getNodeParameter('thumbOffsetMs', i, 0) as number);
							const shareToFeed =
								job.shareToFeed ?? (this.getNodeParameter('shareToFeed', i, true) as boolean);
							return OPS.publishReel(this, i, {
								igUserId,
								videoUrl,
								caption,
								thumbOffsetMs,
								shareToFeed,
								pollSec,
								maxWaitSec,
								autoPublish,
							});
						}
						case 'publishStory': {
							const mediaUrl = job.mediaUrl ?? (this.getNodeParameter('mediaUrl', i) as string);
							const kind =
								job.storyKind ?? (this.getNodeParameter('storyKind', i) as 'image' | 'video');
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							return OPS.publishStory(this, i, {
								igUserId,
								mediaUrl,
								kind,
								caption,
								pollSec,
								maxWaitSec,
								autoPublish,
							});
						}
						case 'publishCarousel': {
							const itemsCol =
								job.items ?? (this.getNodeParameter('items', i, {}) as any).item ?? [];
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							return OPS.publishCarousel(this, i, {
								igUserId,
								items: itemsCol,
								caption,
								pollSec,
								maxWaitSec,
								autoPublish,
							});
						}
						default:
							throw opErr(i, `Unsupported IG operation in payload: ${operation}`);
					}
				}

				/* ================= FB ================= */
				case 'facebook': {
					const pageId = job.pageId ?? (this.getNodeParameter('pageId', i) as string);
					switch (operation) {
						case 'publishFbPhoto': {
							const imageUrl = job.imageUrl ?? (this.getNodeParameter('imageUrl', i) as string);
							const caption = job.caption ?? (this.getNodeParameter('caption', i, '') as string);
							return OPS.publishFbPhoto(this, i, { pageId, imageUrl, caption });
						}
						case 'publishFbVideo': {
							const videoUrl = job.videoUrl ?? (this.getNodeParameter('videoUrl', i) as string);
							const title = job.title ?? (this.getNodeParameter('title', i, '') as string);
							const description =
								job.description ?? (this.getNodeParameter('description', i, '') as string);
							return OPS.publishFbVideo(this, i, {
								pageId,
								videoUrl,
								title,
								description,
								pollSec,
								maxWaitSec,
							});
						}
						default:
							throw opErr(i, `Unsupported Facebook operation in payload: ${operation}`);
					}
				}

				/* ================= Threads ================= */
				case 'threads': {
					const userId =
						job.thUserId ?? job.userId ?? (this.getNodeParameter('thUserId', i) as string);
					switch (operation) {
						case 'threadsPublishText': {
							const text = job.text ?? (this.getNodeParameter('text', i, '') as string);
							return OPS.threadsPublishText(this, i, { userId, text, pollSec, maxWaitSec });
						}
						case 'threadsPublishImage': {
							const imageUrl = job.imageUrl ?? (this.getNodeParameter('imageUrl', i) as string);
							const text = job.text ?? (this.getNodeParameter('text', i, '') as string);
							const altText = job.altText ?? (this.getNodeParameter('altText', i, '') as string);
							return OPS.threadsPublishImage(this, i, {
								userId,
								imageUrl,
								text,
								altText,
								pollSec,
								maxWaitSec,
							});
						}
						case 'threadsPublishVideo': {
							const videoUrl = job.videoUrl ?? (this.getNodeParameter('videoUrl', i) as string);
							const text = job.text ?? (this.getNodeParameter('text', i, '') as string);
							const altText = job.altText ?? (this.getNodeParameter('altText', i, '') as string);
							return OPS.threadsPublishVideo(this, i, {
								userId,
								videoUrl,
								text,
								altText,
								pollSec,
								maxWaitSec,
							});
						}
						case 'threadsPublishCarousel': {
							const itemsCol =
								job.items ?? (this.getNodeParameter('thItems', i, {}) as any).item ?? [];
							const text = job.text ?? (this.getNodeParameter('text', i, '') as string);
							return OPS.threadsPublishCarousel(this, i, {
								userId,
								items: itemsCol,
								text,
								pollSec,
								maxWaitSec,
							});
						}
						default:
							throw opErr(i, `Unsupported Threads operation in payload: ${operation}`);
					}
				}

				default:
					throw opErr(i, `Unsupported resource in payload: ${resource}`);
			}
		};

		for (let i = 0; i < items.length; i++) {
			const inputSource = this.getNodeParameter('inputSource', i) as 'fields' | 'json';

			try {
				if (inputSource === 'json') {
					// read external job(s) from item JSON
					const jsonProp = this.getNodeParameter('jsonProp', i) as string;
					const payload = getFromPath(items[i].json, jsonProp === '$json' ? '' : jsonProp);
					if (payload == null) throw opErr(i, `No JSON found at path "${jsonProp}"`);

					const jobs = asArray(payload);
					for (const job of jobs) {
						if (!job || typeof job !== 'object') {
							if (this.continueOnFail()) {
								out.push({
									json: { error: 'Invalid job payload (not an object)', sourcePath: jsonProp },
									pairedItem: i,
								});
								continue;
							}
							throw opErr(i, 'Invalid job payload (not an object)');
						}
						const result = await runJob(i, job);
						out.push({ json: result });
					}
				} else {
					// regular field mode → build a "job" from node params and run once
					const resource = this.getNodeParameter('resource', i) as
						| 'instagram'
						| 'facebook'
						| 'threads';
					const operation = this.getNodeParameter('operation', i) as string;
					const job = { resource, operation }; // runJob will pull any missing fields from node params
					const result = await runJob(i, job);
					out.push({ json: result });
				}
			} catch (err: any) {
				if (this.continueOnFail()) {
					out.push({ json: { error: err?.message || String(err) }, pairedItem: i });
					continue;
				}
				// Re-throw as NodeOperationError to satisfy ESLint rule
				throw opErr(i, err instanceof Error ? err : new Error(String(err)));
			}
		}

		return [out];
	}
}
