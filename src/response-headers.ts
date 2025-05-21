import { Config } from './types';

export function handleCors(request: Request, config: Config): Response | null {
	const origin = request.headers.get('Origin');
	const method = request.method.toUpperCase();
	const cors = config.corsHeaders;

	if (method === 'OPTIONS') {
		if (origin && cors.allowedOrigins.includes(origin)) {
			return new Response(null, {
				status: 204,
				headers: {
					'Access-Control-Allow-Origin': origin,
					'Access-Control-Allow-Methods': cors.allowedMethods.join(', '),
					'Access-Control-Allow-Headers': cors.allowedHeaders.join(', '),
					'Access-Control-Expose-Headers': cors.exposeHeaders.join(', '),
					'Access-Control-Allow-Credentials': cors.allowCredentials ? 'true' : 'false',
					'Access-Control-Max-Age': cors.maxAge.toString(),
					Vary: cors.vary,
				},
			});
		}
		return new Response(JSON.stringify({ error: { message: 'CORS preflight not allowed' } }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	if (!cors.allowedMethods.includes(method)) {
		return new Response(JSON.stringify({ error: { message: 'Method Not Allowed' } }), {
			status: 405,
			headers: {
				Allow: cors.allowedMethods.join(', '),
				'Content-Type': 'application/json',
			},
		});
	}

	if (origin && !cors.allowedOrigins.includes(origin)) {
		return new Response(JSON.stringify({ error: { message: 'Forbidden - Origin Not Allowed' } }), {
			status: 403,
			headers: {
				'Content-Type': 'application/json',
			},
		});
	}

	return null;
}

export function addHeaders(request: Request, response: Response, config: Config): Response {
	const newResponse = new Response(response.body, response);

	const origin = request.headers.get('Origin');
	const cors = config.corsHeaders;
	if (origin && cors.allowedOrigins.includes(origin)) {
		newResponse.headers.set('Access-Control-Allow-Origin', origin);
		newResponse.headers.set('Access-Control-Allow-Credentials', cors.allowCredentials ? 'true' : 'false');
		newResponse.headers.set('Access-Control-Expose-Headers', cors.exposeHeaders.join(', '));
		newResponse.headers.set('Vary', cors.vary);
	}

	const sec = config.securityHeaders;
	newResponse.headers.set('Cache-Control', sec.cacheControl);
	newResponse.headers.set('Content-Security-Policy', sec.contentSecurityPolicy);
	if (!newResponse.headers.has('Content-Type')) {
		newResponse.headers.set('Content-Type', sec.contentType);
	}
	newResponse.headers.set('Strict-Transport-Security', sec.strictTransportSecurity);
	newResponse.headers.set('X-Content-Type-Options', sec.xContentTypeOptions);
	newResponse.headers.set('X-Frame-Options', sec.xFrameOptions);
	newResponse.headers.set('Permissions-Policy', sec.permissionsPolicy);
	newResponse.headers.set('Referrer-Policy', sec.referrerPolicy);

	return newResponse;
}
