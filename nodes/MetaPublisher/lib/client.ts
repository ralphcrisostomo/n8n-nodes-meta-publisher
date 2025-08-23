import type { IExecuteFunctions } from 'n8n-workflow';

export const GRAPH_VERSION = 'v23.0';
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function isAbsolute(u: string) {
	return /^https?:\/\//i.test(u);
}

export async function apiRequest(
	thisArg: IExecuteFunctions,
	method: 'GET' | 'POST',
	endpoint: string,
	qs: Record<string, any> = {},
	body: Record<string, any> = {},
	itemIndex = 0,
): Promise<any> {
	const url = isAbsolute(endpoint) ? endpoint : `${GRAPH_BASE}${endpoint}`;
	const options: any = { method, url, qs, body, json: true };

	try {
		const cred: any = await (thisArg.getCredentials as any)('metaGraphApi');
		if (cred?.accessToken) {
			options.qs = { access_token: cred.accessToken, ...qs };
			console.log('-------------------------');
			console.log(JSON.stringify({ options }, null, 2));
			const res = await thisArg.helpers.request(options);
			console.log(JSON.stringify({ res }, null, 2));
			return res;
		}
	} catch {
		// no credential, keep going to plain request
	}

	return thisArg.helpers.request(options);
}
