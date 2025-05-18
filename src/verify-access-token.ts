import { getApiServiceUrl } from './routes';
import { getGoogleIdToken } from './gcp-auth';

export async function handleAccessTokenValidation(request: Request, config: any, cache: Cache): Promise<boolean> {
	const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return false;
	}
	const token = authHeader.substring('Bearer '.length).trim();
	if (!token) {
		return false;
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
			return false;
		}
	} else {
		console.log('Cache hit for access token validation');
	}
	if (!resp.ok) return false;
	const data: { data?: { valid?: boolean } } = await resp.json();
	return !!data.data?.valid;
}
