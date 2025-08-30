import type { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

export class MetaPublisherBinaryUpload implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MetaPublisher Binary Upload (Preview)',
		name: 'metaPublisherBinaryUpload',
		icon: 'file:metaPublisher.svg', // optional: use your existing icon
		group: ['transform'],
		version: 1,
		description:
			'⚠️ Preview node – proposed feature to upload binary files to the cloud for Meta publishing. This node is currently a placeholder.',

		defaults: {
			name: 'MetaPublisher Binary Upload',
		},
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],

		// 👇 properties just show a notice, nothing else yet
		properties: [
			{
				displayName: 'Preview Notice',
				name: 'previewNotice',
				type: 'notice',
				default: '',
				description: '🚧 This node is a proposal. If you want binary upload support, please visit the GitHub repo and give it a star to show interest. 👉 [View on GitHub](https://github.com/ralphcrisostomo/n8n-nodes-meta-publisher)',
			},
		],
	};
}
