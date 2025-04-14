export interface Env {
	API_GATEWAY_ORIGIN: string;
	// Add any other environment variables you need
}

interface Config {
	apiGatewayOrigin: string;
	authHeader: string;
	authValue: string;
	corsAllowedOrigins: string[];
	corsAllowedMethods: string[];
	corsAllowedHeaders: string[];
	corsExposeHeaders: string[];
	corsAllowCredentials: boolean;
	corsMaxAge: number;
}

// Configuration for dev environment
function createConfig(env: Env): Config {
	return {
		apiGatewayOrigin: env.API_GATEWAY_ORIGIN,
		authHeader: 'X-From-The-Hart-API-Proxy-Token',
		authValue: 'WC1Gcm9tLVRoZS1IYXJ0LUNsb3VkRnJvbnQtVG9rZW4=',
		corsAllowedOrigins: ['http://localhost:3000', 'https://dev.fromthehart.tech', 'https://www.fromthehart.tech'],
		corsAllowedMethods: ['GET', 'OPTIONS'],
		corsAllowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'X-From-The-Hart-CloudFront-Token'],
		corsExposeHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
		corsAllowCredentials: true,
		corsMaxAge: 3600,
	};
}

async function handleRequest(request: Request, config: Config, ctx: ExecutionContext): Promise<Response> {
	// Handle CORS preflight
	if (request.method === 'OPTIONS') {
		return handleCors(request, config);
	}

	// Get path and query from request
	const url = new URL(request.url);
	const path = url.pathname;
	const query = url.search;

	// Create request for API Gateway - avoid backtick template literals
	const apiUrl = 'https://' + config.apiGatewayOrigin + path + query;

	const initialCacheCheck = evaluateCaching(request);
	const authState = request.headers.has('Authorization') ? request.headers.get('Authorization') : 'noauth';
	const cacheKey = new Request(`${apiUrl}?__auth=${authState}`, { method: request.method });
	const cache = caches.default;

	let response;
	if (initialCacheCheck.shouldCache) {
		response = await cache.match(cacheKey);
		if (response) {
			console.log('Cache hit for:', cacheKey);
			return response;
		}
	}

	console.log(`Response for request url: ${request.url} not present in cache. Fetching and caching request.`);
	let apiRequest;
	if (['GET', 'HEAD'].includes(request.method)) {
		apiRequest = new Request(apiUrl, {
			method: request.method,
			headers: request.headers,
		});
	} else {
		// For methods with body (POST, PUT, etc.)
		// Use the original request and just change the URL
		apiRequest = new Request(apiUrl, request);
	}

	// Add the authorization header (only once)
	apiRequest.headers.set(config.authHeader, config.authValue);

	let errorFlag = false;
	try {
		response = await fetch(apiRequest, {
			cf: {
				cacheEverything: false,
				respectOriginHeaders: true,
			},
		} as RequestInit);

		if (!response.ok) {
			console.error(`API Gateway error: ${response.status} ${response.statusText}`);
			errorFlag = true;
		}
	} catch (error) {
		console.error('Fetch error:', error);
		return new Response('API Gateway unavailable', { status: 503 });
	}

	// Clone the response and add CORS headers
	const corsResponse = addCorsHeaders(request, response, config);

	// Check if we should cache this response and for how long
	const cacheDecision = evaluateCaching(request, corsResponse);

	if (cacheDecision.shouldCache && !errorFlag) {
		console.log(`Caching response for ${cacheDecision.howLong} seconds`);

		// Create a clone for caching with the updated headers
		const responseToCache = corsResponse.clone();

		ctx.waitUntil(cache.put(cacheKey, responseToCache));

		// Return the corsResponse (not responseToCache which was modified)
		return corsResponse;
	} else {
		console.log('Response not cacheable: missing required cache directives or error occurred');
		return corsResponse;
	}
}

function evaluateCaching(request: Request, response?: Response): { shouldCache: boolean; howLong: number } {
	// Default response object
	const result = { shouldCache: false, howLong: 0 };

	// Only cache GET and HEAD requests
	if (!['GET', 'HEAD'].includes(request.method)) {
		return result;
	}

	// If no response is provided, we can't determine caching parameters
	if (!response) {
		return { shouldCache: true, howLong: 0 };
	}

	const cacheControl = response.headers.get('Cache-Control');

	// No Cache-Control header, don't cache
	if (!cacheControl) {
		return result;
	}

	// Check for s-maxage directive
	const sMaxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
	if (sMaxAgeMatch && sMaxAgeMatch[1]) {
		return {
			shouldCache: true,
			howLong: parseInt(sMaxAgeMatch[1], 10),
		};
	}

	// Fall back to max-age directive if s-maxage is not present
	const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
	if (maxAgeMatch && maxAgeMatch[1]) {
		return {
			shouldCache: true,
			howLong: parseInt(maxAgeMatch[1], 10),
		};
	}

	// Check for other CDN directives that indicate caching is desired
	const cdnDirectives = [/stale-while-revalidate/, /stale-if-error/, /immutable/, /public/];

	for (const pattern of cdnDirectives) {
		if (pattern.test(cacheControl)) {
			// Default TTL when directive doesn't specify a duration
			return { shouldCache: true, howLong: 300 }; // 5 minutes default
		}
	}

	return result;
}

function handleCors(request: Request, config: Config): Response {
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

function addCorsHeaders(request: Request, response: Response, config: Config): Response {
	const origin = request.headers.get('Origin');

	// Always create a new response with the original body
	const newResponse = new Response(response.body, response);

	if (origin && (config.corsAllowedOrigins.includes(origin) || config.corsAllowedOrigins.includes('*'))) {
		newResponse.headers.set('Access-Control-Allow-Origin', origin);
		newResponse.headers.set('Access-Control-Allow-Credentials', config.corsAllowCredentials ? 'true' : 'false');

		// Use set instead of append to avoid duplicate headers
		newResponse.headers.set('Access-Control-Expose-Headers', config.corsExposeHeaders.join(', '));
	}

	return newResponse;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const config = createConfig(env);
		return handleRequest(request, config, ctx);
	},
} satisfies ExportedHandler<Env>;
