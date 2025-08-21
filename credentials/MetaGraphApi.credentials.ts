import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class MetaGraphApi implements ICredentialType {
	name = 'metaGraphApi';
	displayName = 'Meta Graph API (Access Token) API';
	documentationUrl = 'https://developers.facebook.com/';
	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Page/IG/Threads access token. If OAuth2 is also configured, OAuth2 takes precedence.',
		},
	];
}
