import { Config } from './types';

export async function addAzureTokenToRequest(request: Request, config: Config, cache: Cache): Promise<Request> {
	const azureToken = await getAzureAccessToken(
		config.azureClientId,
		config.azureClientSecret,
		config.azureTenantId,
		config.azureAcaAudience,
		cache,
	);
	request.headers.set('Authorization', `Bearer ${azureToken}`);
	return request;
}

export async function getAzureAccessToken(
	clientId: string,
	clientSecret: string,
	tenantId: string,
	audience: string,
	cache: Cache,
): Promise<string> {
	const cacheUrl = `https://cache/azure-access-token?client_id=${encodeURIComponent(clientId)}`;
	const cacheKey = new Request(cacheUrl, { method: 'GET' });

	const cachedToken = await getCachedToken(cache, cacheKey);
	if (cachedToken) {
		return cachedToken;
	}

	const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

	try {
		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				client_id: clientId,
				client_secret: clientSecret,
				scope: `${audience}/.default`,
				grant_type: 'client_credentials',
			}),
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Token request failed: ${response.status} - ${errorText}`);
		}

		interface AzureTokenResponse {
			access_token?: string;
			token_type?: string;
			expires_in?: number;
			ext_expires_in?: number;
			error?: string;
			error_description?: string;
		}

		const data = (await response.json()) as AzureTokenResponse;

		if (!data.access_token) {
			throw new Error(`Failed to get Azure access token: ${data.error} - ${data.error_description}`);
		}

		await cacheToken(cache, cacheKey, data.access_token, data.expires_in || 3600);

		return data.access_token;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to get Azure access token: ${errorMessage}`);
	}
}

async function getCachedToken(cache: Cache, cacheKey: Request): Promise<string | null> {
	try {
		const cachedData = await cache.match(cacheKey);
		if (!cachedData) return null;

		const tokenData = (await cachedData.json()) as { token: string; expiresAt: number };
		const now = Math.floor(Date.now() / 1000);
		const fiveMinutesInSeconds = 5 * 60;

		return tokenData.expiresAt > now + fiveMinutesInSeconds ? tokenData.token : null;
	} catch (error) {
		console.error('Failed to parse cached Azure token:', error);
		return null;
	}
}

async function cacheToken(cache: Cache, cacheKey: Request, token: string, expiresIn: number): Promise<void> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + expiresIn;
		const tokenData = { token, expiresAt };

		const response = new Response(JSON.stringify(tokenData), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': `max-age=${expiresIn}`,
			},
		});

		await cache.put(cacheKey, response);
	} catch (error) {
		console.error('Failed to cache Azure token:', error);
	}
}
