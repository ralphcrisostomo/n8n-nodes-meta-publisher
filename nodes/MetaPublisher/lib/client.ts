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

	// Try OAuth2 first
	// try {
	// 	return await thisArg.helpers.requestWithAuthentication.call(thisArg, 'oAuth2Api', options);
	// } catch (e: any) {
	// 	if (!String(e?.message || '').includes('is not configured')) throw e;
	// }

	// Fallback to raw access token credential
	try {
		const cred: any = await (thisArg.getCredentials as any)('metaGraphApi');
		if (cred?.accessToken) {
			options.qs = { ...qs, access_token: cred.accessToken };
			return await thisArg.helpers.request(options);
		}
	} catch {
		// no credential, keep going to plain request
	}

	return thisArg.helpers.request(options);
}
