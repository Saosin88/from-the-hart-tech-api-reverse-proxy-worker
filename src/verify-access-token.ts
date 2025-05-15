import { getApiServiceUrl } from './routes';

export async function verifyAccessToken(
	request: Request,
	environment: string,
	cache: Cache,
): Promise<{ valid: boolean; status: number; message: string }> {
	const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return { valid: false, status: 401, message: 'Missing or invalid Authorization header' };
	}
	const token = authHeader.substring('Bearer '.length).trim();
	if (!token) {
		return { valid: false, status: 401, message: 'Missing bearer token' };
	}

	const cacheKey = new Request(`https://cache/verify-access-token?token=${encodeURIComponent(token)}&env=${environment}`, {
		method: 'GET',
	});
	const cached = await cache.match(cacheKey);
	if (cached) {
		try {
			const data = await cached.json();
			if (typeof data === 'object' && data !== null && 'valid' in data) {
				return (data as { valid: boolean }).valid === true
					? { valid: true, status: 200, message: 'Token valid (cached)' }
					: { valid: false, status: 401, message: 'Token invalid (cached)' };
			}
		} catch {}
	}

	const serviceUrl = getApiServiceUrl('/auth', environment);
	const verifyUrl = serviceUrl + '/auth/verify-access-token';
	const verifyReq = new Request(verifyUrl, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ accessToken: token }),
	});

	let resp: Response;
	try {
		resp = await fetch(verifyReq);
	} catch (e) {
		return { valid: false, status: 503, message: 'Auth service unavailable' };
	}

	if (resp.status === 200) {
		const cacheResp = new Response(JSON.stringify({ valid: true }), {
			status: 200,
			headers: { 'Cache-Control': 'max-age=900' },
		});
		await cache.put(cacheKey, cacheResp);
		return { valid: true, status: 200, message: 'Token valid' };
	} else if (resp.status === 400 || resp.status === 401) {
		const cacheResp = new Response(JSON.stringify({ valid: false }), {
			status: 401,
			headers: { 'Cache-Control': 'max-age=900' },
		});
		await cache.put(cacheKey, cacheResp);
		return { valid: false, status: 401, message: 'Token invalid' };
	} else {
		return { valid: false, status: resp.status, message: 'Token validation failed' };
	}
}
