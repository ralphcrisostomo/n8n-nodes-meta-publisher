import type { INodeType, INodeTypeDescription, NodeConnectionType } from 'n8n-workflow';

export class MetaPublisherBinaryUpload implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher Binary Upload (Preview)',
		name: 'metaPublisherBinaryUpload',
		icon: { light: 'file:MetaPublisher.svg', dark: 'file:MetaPublisher.svg' },
		group: ['transform'],
		version: 1,
		description:
			'Preview node – proposed feature to upload binary files to the cloud for Meta publishing. This node is currently a placeholder.',

		hints: [
			{
				type: 'warning',
				message:
					'🚧 This node is a proposal. If you want binary upload support, please visit the GitHub repo and give it a star to show interest. 👉 [View on GitHub](https://github.com/ralphcrisostomo/n8n-nodes-meta-publisher)',
				location: 'ndv',
			},
		],

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
				description:
					'🚧 This node is a proposal. If you want binary upload support, please visit the GitHub repo and give it a star to show interest. 👉 [View on GitHub](https://github.com/ralphcrisostomo/n8n-nodes-meta-publisher)',
			},
		],
	};
}
