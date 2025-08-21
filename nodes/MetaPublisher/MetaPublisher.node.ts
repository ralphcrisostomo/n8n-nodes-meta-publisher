import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
} from 'n8n-workflow';

export class MetaPublisher implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Meta Publisher x',
		name: 'metaPublisher',
		group: ['transform'],
		version: 1,
		description: 'Publish to Instagram, Facebook Pages, and Threads',
		defaults: { name: 'Meta Publisher' },
		inputs: ['main'] as NodeConnectionType[],
		outputs: ['main'] as NodeConnectionType[],
		credentials: [
			{ name: 'accessToken', required: true },
		],
		properties: [
			{
				displayName: 'Workflow JSONx',
				name: 'workflow',
				type: 'string',
				typeOptions: {
					rows: 10,
				},
				default: '',
				required: true,
				description: 'The ComfyUI workflow in JSON format',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		return [[{json: { x: 11}}]];
	}
}
