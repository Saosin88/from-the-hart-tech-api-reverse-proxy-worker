import { checkCache, shouldCache } from './caching';
import { addCorsHeaders, handleCors } from './cors';
import { resolveApiRouteConfig, ApiEndpointType } from './routes';
import { Config } from './types';
import { signRequest } from './aws-auth';
import { getGoogleIdToken } from './gcp-auth';
import { validateTurnstileToken } from './cloudflare-turnstile';
import { verifyAccessToken } from './verify-access-token';

export async function handleRequest(request: Request, config: Config, ctx: ExecutionContext): Promise<Response> {
	const corsResult = handleCors(request, config);
	if (corsResult) {
		return corsResult;
	}

	const url = new URL(request.url);
	const path = url.pathname;
	const query = url.search;

	let route;
	try {
		route = resolveApiRouteConfig(path, config.environment);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown routing error';
		return addCorsHeaders(request, new Response(`Not Found: ${errorMessage}`, { status: 404 }), config);
	}

	if (route.validateTurnstileToken) {
		const turnstileToken = request.headers.get('x-cf-turnstile-token');

		if (!turnstileToken) {
			return addCorsHeaders(request, new Response('Turnstile token required', { status: 403 }), config);
		}
		const clientIP = request.headers.get('cf-connecting-ip') || '';
		const isValid = await validateTurnstileToken(turnstileToken, config.cloudflareTurnstileSecretKey, clientIP);
		if (!isValid) {
			return addCorsHeaders(request, new Response('Invalid Turnstile token', { status: 403 }), config);
		}
	}

	const serviceEndpoint = route.serviceEndpoint;
	const apiUrl = serviceEndpoint + path + query;

	const cacheKey = new Request(apiUrl, { method: request.method });
	const cache = caches.default;

	if (route.validateAccessToken) {
		const result = await verifyAccessToken(request, config.environment, cache);
		if (!result.valid) {
			return addCorsHeaders(request, new Response(result.message, { status: result.status }), config);
		}
	}

	const doCacheCheck = checkCache(route.cacheable, request);

	let response;
	if (doCacheCheck) {
		response = await cache.match(cacheKey);
		if (response) {
			return addCorsHeaders(request, response, config);
		}
	}

	let apiRequest = new Request(apiUrl, request);

	if (route.endpointType === ApiEndpointType.AWS_LAMBDA_FUNCTION_URL) {
		apiRequest = await signRequest(apiRequest, config.awsAccessKeyId, config.awsSecretAccessKey);
	} else if (route.endpointType === ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL) {
		const googleToken = await getGoogleIdToken(config.googleServiceAccountemail, config.googleServiceAccountKey, apiRequest.url, cache);
		apiRequest.headers.set('X-Serverless-Authorization', `Bearer ${googleToken}`);
	}

	let errorFlag = false;
	try {
		response = await fetch(apiRequest);

		if (!response.ok) {
			errorFlag = true;
		}
	} catch (error) {
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
