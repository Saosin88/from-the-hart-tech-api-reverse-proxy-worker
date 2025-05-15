import { handleCacheCheck, handleCacheStore } from './caching';
import { addCorsHeaders, handleCors } from './cors';
import { resolveApiRouteConfig, ApiEndpointType, getAllApiRoutes } from './routes';
import { Config } from './types';
import { signRequest } from './aws-auth';
import { getGoogleIdToken } from './gcp-auth';
import { handleTurnstileValidation } from './cloudflare-turnstile';
import { handleAccessTokenValidation } from './verify-access-token';
import { renderApiIndexPage } from './htmlIndexPage';

export async function handleRequest(request: Request, config: Config, ctx: ExecutionContext): Promise<Response> {
	const corsResult = handleCors(request, config);
	if (corsResult) {
		return corsResult;
	}

	const url = new URL(request.url);
	const path = url.pathname;
	const query = url.search;

	if (path === '/') {
		return renderApiIndexPage(config);
	}

	const baseApiPaths = getAllApiRoutes(config.environment).map((r) => r.path);
	const normalizedPath = path.endsWith('/') && path.length > 1 ? path.slice(0, -1) : path;
	if (baseApiPaths.includes(normalizedPath) && normalizedPath !== '/') {
		const origin = url.origin;
		return Response.redirect(`${origin}${normalizedPath}/documentation`, 302);
	}

	let route;
	try {
		route = resolveApiRouteConfig(path, config.environment);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown routing error';
		return addCorsHeaders(request, new Response(`Not Found: ${errorMessage}`, { status: 404 }), config);
	}

	if (route.validateTurnstileToken) {
		const turnstileResponse = await handleTurnstileValidation(request, config);
		if (turnstileResponse) {
			return addCorsHeaders(request, turnstileResponse, config);
		}
	}

	const cache = caches.default;

	if (route.validateAccessToken) {
		const accessTokenResponse = await handleAccessTokenValidation(request, config, cache);
		if (accessTokenResponse) {
			return addCorsHeaders(request, accessTokenResponse, config);
		}
	}

	const serviceEndpoint = route.serviceEndpoint;
	const apiUrl = serviceEndpoint + path + query;

	const cacheKey = new Request(apiUrl, { method: request.method });

	const cacheResponse = await handleCacheCheck(route, request, cache, cacheKey);
	if (cacheResponse) {
		return addCorsHeaders(request, cacheResponse, config);
	}

	let apiRequest = new Request(apiUrl, request);

	if (route.endpointType === ApiEndpointType.AWS_LAMBDA_FUNCTION_URL) {
		apiRequest = await signRequest(apiRequest, config.awsAccessKeyId, config.awsSecretAccessKey);
	} else if (route.endpointType === ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL) {
		const googleToken = await getGoogleIdToken(config.googleServiceAccountemail, config.googleServiceAccountKey, apiRequest.url, cache);
		apiRequest.headers.set('X-Serverless-Authorization', `Bearer ${googleToken}`);
	}

	let response: Response;
	let errorFlag = false;
	try {
		console.log('API Request:', JSON.stringify(apiRequest));
		response = await fetch(apiRequest);

		if (!response.ok) {
			errorFlag = true;
		}
	} catch (error) {
		return new Response('API Gateway unavailable', { status: 503 });
	}

	const corsResponse = addCorsHeaders(request, response, config);

	await handleCacheStore(route, corsResponse, errorFlag, cache, cacheKey, ctx);
	return corsResponse;
}
