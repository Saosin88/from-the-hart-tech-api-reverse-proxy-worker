import { getApiServiceUrl } from './routes';
import { getGoogleIdToken } from './gcp-auth';
import { getBearerToken } from './utils';

export async function handleAccessTokenValidation(request: Request, config: any, cache: Cache): Promise<Response | null> {
	const token = getBearerToken(request);
	if (!token) {
		return unauthorizedResponse();
	}

	const tokenHash = await sha256Hex(token);
	const cacheUrl = `https://cache/verify-access-token?tokenHash=${tokenHash}`;
	const cacheKey = new Request(cacheUrl, { method: 'GET' });

	let resp = await cache.match(cacheKey);
	if (!resp) {
		const serviceUrl = getApiServiceUrl('/auth', config.environment);
		const verifyUrl = serviceUrl + '/auth/verify-access-token';
		const googleToken = await getGoogleIdToken(config.googleServiceAccountemail, config.googleServiceAccountKey, verifyUrl, cache);

		const verifyReq = new Request(verifyUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Serverless-Authorization': `Bearer ${googleToken}`,
			},
			body: JSON.stringify({ accessToken: token }),
		});

		try {
			resp = await fetch(verifyReq);
			if (resp.ok) {
				const respToCache = resp.clone();
				await cache.put(cacheKey, respToCache);
			}
		} catch {
			return unauthorizedResponse();
		}
	} else {
		console.debug('Found cached key for user Access Token', cacheKey.url);
	}
	if (!resp.ok) return unauthorizedResponse();
	const data: { data?: { valid?: boolean } } = await resp.json();
	if (!data.data?.valid) return unauthorizedResponse();
	return null;
}

export function unauthorizedResponse(): Response {
	return new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
		status: 401,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function sha256Hex(input: string): Promise<string> {
	const enc = new TextEncoder();
	const data = enc.encode(input);
	const hash = await crypto.subtle.digest('SHA-256', data);
	const bytes = new Uint8Array(hash);
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
