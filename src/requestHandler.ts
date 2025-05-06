import { checkCache, shouldCache } from './caching';
import { addCorsHeaders, handleCors } from './cors';
import { getRouteForPath, EndpointType } from './routes';
import { Config } from './types';
import { signRequest } from './aws-auth';
import { getGoogleIdToken } from './gcp-auth';

export async function handleRequest(request: Request, config: Config, ctx: ExecutionContext): Promise<Response> {
	if (request.method === 'OPTIONS') {
		return handleCors(request, config);
	}

	const url = new URL(request.url);
	const path = url.pathname;
	const query = url.search;

	let route;
	try {
		route = getRouteForPath(path, config.environment);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown routing error';
		// console.error(`Routing error: ${errorMessage}`);
		return addCorsHeaders(request, new Response(`Not Found: ${errorMessage}`, { status: 404 }), config);
	}

	const serviceEndpoint = route.serviceEndpoint;
	const apiUrl = serviceEndpoint + path + query;

	const cacheKey = new Request(apiUrl, { method: request.method });
	const cache = caches.default;
	const doCacheCheck = checkCache(route.cacheable, request);

	let response;
	if (doCacheCheck) {
		response = await cache.match(cacheKey);
		if (response) {
			return addCorsHeaders(request, response, config);
		}
	}

	let apiRequest = new Request(apiUrl, request);

	if (route.endpointType === EndpointType.AWS_LAMBDA_FUNCTION_URL) {
		apiRequest = await signRequest(apiRequest, config.awsAccessKeyId, config.awsSecretAccessKey);
	} else if (route.endpointType === EndpointType.GCP_CLOUD_RUN_SERVICE_URL) {
		const googleToken = await getGoogleIdToken(config.googleServiceAccountemail, config.googleServiceAccountKey, apiRequest.url, cache);
		apiRequest.headers.set('X-Serverless-Authorization', `Bearer ${googleToken}`);
	}

	let errorFlag = false;
	try {
		response = await fetch(apiRequest);

		if (!response.ok) {
			// console.error(`API Gateway error: ${response.status} ${response.statusText}`);
			errorFlag = true;
		}
	} catch (error) {
		// console.error('Fetch error:', error);
		return new Response('API Gateway unavailable', { status: 503 });
	}

	const corsResponse = addCorsHeaders(request, response, config);

	const shouldCacheResponse = shouldCache(route.cacheable, corsResponse);

	if (shouldCacheResponse && !errorFlag) {
		const responseToCache = corsResponse.clone();
		ctx.waitUntil(cache.put(cacheKey, responseToCache));
		return corsResponse;
	} else {
		return corsResponse;
	}
}
