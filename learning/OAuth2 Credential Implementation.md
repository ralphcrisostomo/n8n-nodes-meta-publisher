Awesome — let’s make an **n8n OAuth2 credential** that follows your Threads flow and can **auto-exchange** the short-lived token into a **long-lived token**, then **refresh** it when needed — all from inside the credential.

This credential:

- Uses **OAuth2** to get the initial (short-lived) token from Threads.
- If `Auto Exchange to Long-Lived` is enabled, it will:
  - Exchange to long-lived once, store it in the credential, and use it for all requests.
  - Refresh it automatically via `th_refresh_token` when near expiry.

- Still supports Meta Graph (FB/IG) if you want a single cred for both.

You can drop this into `packages/nodes-base/credentials/MetaThreadsOAuth2Api.credentials.ts` (or your custom package).

```ts
import type { ICredentialType, INodeProperties, IAuthenticateGeneric } from 'n8n-workflow';

/**
 * Meta / Threads OAuth2 credential for n8n
 *
 * Features:
 *  - Standard OAuth2 for Meta Graph or Threads
 *  - Optional "Auto Exchange to Long-Lived" for Threads:
 *      * Exchanges short-lived -> long-lived after OAuth
 *      * Stores/accesses the managed long-lived token
 *      * Auto-refreshes via th_refresh_token when expiring
 *
 * Notes:
 *  - Threads' long-lived flow does not use a classic refresh_token.
 *    We refresh by calling /refresh_access_token with the current long-lived access_token.
 *  - n8n stores credential properties securely; we persist the long-lived token in `managedAccessToken`.
 */

export class MetaThreadsOAuth2Api implements ICredentialType {
	name = 'metaThreadsOAuth2Api';
	displayName = 'Meta / Threads OAuth2';
	documentationUrl = 'https://developers.facebook.com/docs'; // umbrella doc
	extends = ['oAuth2Api'];

	// Properties are persisted in n8n’s encrypted store
	properties: INodeProperties[] = [
		{
			displayName: 'Service',
			name: 'service',
			type: 'options',
			default: 'threads',
			description: 'Pick the target API',
			options: [
				{ name: 'Threads', value: 'threads' },
				{ name: 'Facebook/Instagram (Graph API)', value: 'graph' },
			],
		},

		// OAuth2 endpoints — switched by service
		{
			displayName: 'Auth URL',
			name: 'authUrl',
			type: 'hidden',
			default:
				'={{ $parameter["service"] === "graph" ? "https://www.facebook.com/v20.0/dialog/oauth" : "https://www.threads.net/oauth/authorize" }}',
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default:
				'={{ $parameter["service"] === "graph" ? "https://graph.facebook.com/v20.0/oauth/access_token" : "https://graph.threads.net/oauth/access_token" }}',
		},
		{
			displayName: 'Token Type',
			name: 'tokenType',
			type: 'hidden',
			default: 'Bearer',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'header',
		},

		// Scopes (adjust as needed)
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'string',
			default:
				'public_profile,email,instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,pages_manage_posts',
			description: 'Comma- or space-separated scopes. Adjust for Threads vs Graph use cases.',
			displayOptions: {
				show: { service: ['graph'] },
			},
		},
		{
			displayName: 'Scope',
			name: 'scopeThreads',
			type: 'string',
			default: 'threads_basic', // sample placeholder; set your Threads scopes
			description: 'Comma- or space-separated scopes for Threads.',
			displayOptions: {
				show: { service: ['threads'] },
			},
		},

		// === Long-lived token management (Threads) ===
		{
			displayName: 'Auto Exchange to Long-Lived (Threads)',
			name: 'autoLongLived',
			type: 'boolean',
			default: true,
			description:
				'After OAuth, exchange short-lived access token to long-lived and use it automatically.',
			displayOptions: { show: { service: ['threads'] } },
		},
		{
			displayName: 'Client Secret (for Exchange/Refresh)',
			name: 'clientSecretForExchange',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'Required by Threads for long-lived exchange/refresh calls.',
			displayOptions: { show: { service: ['threads'], autoLongLived: [true] } },
		},
		{
			displayName: 'Managed Access Token (Long-Lived)',
			name: 'managedAccessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description:
				'Persisted long-lived token (auto-filled on first exchange). Will be used for requests.',
			displayOptions: { show: { service: ['threads'], autoLongLived: [true] } },
		},
		{
			displayName: 'Managed Token Expires At (ISO)',
			name: 'managedExpiresAt',
			type: 'string',
			default: '',
			description:
				'When the managed long-lived token expires (auto set). Used to auto-refresh before expiry.',
			displayOptions: { show: { service: ['threads'], autoLongLived: [true] } },
		},
		{
			displayName: 'Refresh Safety Window (minutes)',
			name: 'refreshWindowMinutes',
			type: 'number',
			default: 60 * 24, // 24 hours
			description: 'Auto-refresh the long-lived token if it expires within this window.',
			displayOptions: { show: { service: ['threads'], autoLongLived: [true] } },
		},

		// Optional: Fallback manual token for non-OAuth usage
		{
			displayName: 'Access Token (Fallback)',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'If present and OAuth is not configured, nodes can use this token directly.',
		},
	];

	/**
	 * n8n "generic" authenticate descriptor. Even though we extend oAuth2Api,
	 * setting this helps ensure the header is consistently applied when we
	 * switch to the managed long-lived token at runtime.
	 */
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization:
					'={{ "Bearer " + $credentials.managedAccessToken || $oauth2.access_token || $credentials.accessToken }}',
			},
		},
	};

	/**
	 * Connectivity test — works for both services.
	 * For Threads, this will be called after preAuthentication runs, so it will
	 * use the managed long-lived token if enabled.
	 */
	test = {
		request: {
			baseURL:
				'={{ $parameter["service"] === "graph" ? "https://graph.facebook.com/v20.0" : "https://graph.threads.net/v1.0" }}',
			url: '/me?fields=id,username,name',
		},
	};

	/**
	 * preAuthentication runs before any authenticated request (including test).
	 * We use it to:
	 *  - For Threads with autoLongLived:
	 *      * If we don’t have a managed long-lived token yet -> exchange short-lived to long-lived
	 *      * If managed token is near expiry -> refresh it
	 *  Values returned from this method are merged into the credential object in-memory
	 *  for the current request, and (in modern n8n versions) persisted when they change.
	 */
	async preAuthentication(this: any, helpers: any) {
		const service = this.getNodeParameter('service', '') as string;

		// Only apply the long-lived flow for Threads + autoLongLived
		if (service !== 'threads') return;

		const auto = this.getNodeParameter('autoLongLived', false) as boolean;
		if (!auto) return;

		const clientSecret = this.getNodeParameter('clientSecretForExchange', '') as string;
		if (!clientSecret) return;

		// Values currently stored in the credential
		const managedAccessToken = this.getCredentials('metaThreadsOAuth2Api')?.managedAccessToken as
			| string
			| undefined;
		const managedExpiresAt = this.getCredentials('metaThreadsOAuth2Api')?.managedExpiresAt as
			| string
			| undefined;

		// Short-lived token we just obtained via OAuth2 (present after connect)
		const oauthAccessToken = (this.getOAuth2Credentials() as any)?.access_token as
			| string
			| undefined;

		const THREADS_BASE = 'https://graph.threads.net';
		const EXCHANGE_URL = `${THREADS_BASE}/access_token`;
		const REFRESH_URL = `${THREADS_BASE}/refresh_access_token`;

		// Helper GET JSON
		const getJson = async (url: string) => {
			const res = await helpers.request({
				method: 'GET',
				url,
				json: true,
			});
			return res as { access_token: string; token_type?: string; expires_in?: number };
		};

		// Decide if we need to exchange or refresh
		const now = Date.now();
		const windowMs = (this.getNodeParameter('refreshWindowMinutes', 1440) as number) * 60 * 1000;

		// If we already have a managed token, refresh if near expiry
		if (managedAccessToken) {
			if (managedExpiresAt) {
				const exp = new Date(managedExpiresAt).getTime();
				if (Number.isFinite(exp) && exp - now <= windowMs) {
					// Refresh long-lived
					const url = `${REFRESH_URL}?grant_type=th_refresh_token&access_token=${encodeURIComponent(
						managedAccessToken,
					)}`;
					const refreshed = await getJson(url);
					if (refreshed?.access_token) {
						const expiresIn = (refreshed.expires_in ?? 0) * 1000;
						const newExpIso = expiresIn ? new Date(Date.now() + expiresIn).toISOString() : '';
						return {
							managedAccessToken: refreshed.access_token,
							managedExpiresAt: newExpIso,
						};
					}
				}
			}
			// Managed token exists and isn’t near expiry — nothing to change
			return;
		}

		// No managed token yet. If we have a short-lived token (fresh OAuth), exchange it
		if (oauthAccessToken) {
			const url = `${EXCHANGE_URL}?grant_type=th_exchange_token&client_secret=${encodeURIComponent(
				clientSecret,
			)}&access_token=${encodeURIComponent(oauthAccessToken)}`;

			const exchanged = await getJson(url);
			if (exchanged?.access_token) {
				const expiresIn = (exchanged.expires_in ?? 0) * 1000; // seconds -> ms
				const expIso = expiresIn ? new Date(Date.now() + expiresIn).toISOString() : '';
				return {
					managedAccessToken: exchanged.access_token,
					managedExpiresAt: expIso,
				};
			}
		}

		// If neither path worked, we silently continue with the short token (header uses oauth2 token).
		return;
	}
}
```

### How it works (in practice)

1. **Add credential** → choose **Threads** → enable **Auto Exchange to Long-Lived** → enter **Client Secret (for Exchange/Refresh)** → complete OAuth.
2. On first authenticated call (or Test), `preAuthentication`:
   - Exchanges the **short-lived** token → **long-lived**, saves it in the credential (`managedAccessToken`, `managedExpiresAt`).

3. On later calls, if `managedExpiresAt` is within your **Refresh Safety Window** (default 24h), it calls
   `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=...`
   and updates the stored token.
4. The **Authorization header** is always set to:
   - `Bearer <managedAccessToken>` (if present)
   - else `Bearer <oauth2.access_token>`
   - else `Bearer <Access Token (Fallback)>`

### Node usage

In your nodes, just use `this.helpers.requestWithAuthentication('metaThreadsOAuth2Api', { ... })`.
No extra code needed — the credential manages exchange/refresh transparently.

### Tips

- If you also use **Graph** (FB/IG), switch **Service** to “Graph” and the same credential will behave like a normal OAuth2 Meta credential (no long-lived management).
- If you prefer to **handle long-lived exchange in a workflow** instead of the credential, disable **Auto Exchange to Long-Lived** and call your existing CLI/HTTP nodes, then paste the token into **Access Token (Fallback)** or a custom field.

If you want, I can also supply a minimal **n8n Node** helper that reads from this credential and exposes a “Get Me” operation for Threads to validate end-to-end.
