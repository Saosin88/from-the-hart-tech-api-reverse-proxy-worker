import { Config } from './types';

export function handleCors(request: Request, config: Config): Response {
	const origin = request.headers.get('Origin');

	if (origin && (config.corsAllowedOrigins.includes(origin) || config.corsAllowedOrigins.includes('*'))) {
		return new Response(null, {
			status: 204,
			headers: {
				'Access-Control-Allow-Origin': origin,
				'Access-Control-Allow-Methods': config.corsAllowedMethods.join(', '),
				'Access-Control-Allow-Headers': config.corsAllowedHeaders.join(', '),
				'Access-Control-Expose-Headers': config.corsExposeHeaders.join(', '),
				'Access-Control-Allow-Credentials': config.corsAllowCredentials ? 'true' : 'false',
				'Access-Control-Max-Age': config.corsMaxAge.toString(),
			},
		});
	}

	return new Response(null, { status: 403 });
}

export function addCorsHeaders(request: Request, response: Response, config: Config): Response {
	const origin = request.headers.get('Origin');

	const newResponse = new Response(response.body, response);

	if (origin && (config.corsAllowedOrigins.includes(origin) || config.corsAllowedOrigins.includes('*'))) {
		newResponse.headers.set('Access-Control-Allow-Origin', origin);
		newResponse.headers.set('Access-Control-Allow-Credentials', config.corsAllowCredentials ? 'true' : 'false');
		newResponse.headers.set('Access-Control-Expose-Headers', config.corsExposeHeaders.join(', '));
	}

	return newResponse;
}
