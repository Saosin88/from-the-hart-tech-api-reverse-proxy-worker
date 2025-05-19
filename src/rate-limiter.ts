import { getBearerToken } from './utils';

interface RateLimitEnv {
	RATE_LIMITER: {
		limit: (opts: { key: string }) => Promise<{ success: boolean; [key: string]: any }>;
	};
}

export async function checkRateLimit(request: Request, env: RateLimitEnv): Promise<{ success: boolean }> {
	const url = new URL(request.url);
	const path = url.pathname;
	const token = getBearerToken(request);
	let rateLimitKey: string;

	if (token) {
		rateLimitKey = `${path}|${token}`;
	} else {
		const ip = request.headers.get('cf-connecting-ip') || '';
		rateLimitKey = `${path}|${ip}`;
	}

	return await env.RATE_LIMITER.limit({ key: rateLimitKey });
}

export async function enforceRateLimit(request: Request, env: any): Promise<Response | undefined> {
	const { success } = await checkRateLimit(request, env);
	if (!success) {
		return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded' } }), {
			status: 429,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	return undefined;
}
