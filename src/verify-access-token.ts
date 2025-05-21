import { getApiServiceUrl } from './routes';
import { getGoogleIdToken } from './gcp-auth';
import { getBearerToken } from './utils';

export async function handleAccessTokenValidation(request: Request, config: any, cache: Cache): Promise<Response | null> {
	const token = getBearerToken(request);
	if (!token) {
		return unauthorizedResponse();
	}

	const cacheUrl = `https://cache/verify-access-token?accessToken=${encodeURIComponent(token)}`;
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
