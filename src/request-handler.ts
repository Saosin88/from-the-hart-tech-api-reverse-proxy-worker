import { addHeaders, handleCors } from './response-headers';
import { resolveApiRouteConfig, ApiEndpointType, getAllApiRoutes } from './routes';
import { Config } from './types';
import { addAwsSignatureToRequest } from './aws-auth';
import { addGoogleIdTokenToRequest } from './gcp-auth';
import { handleTurnstileValidation } from './cloudflare-turnstile';
import { handleAccessTokenValidation } from './verify-access-token';
import { renderApiIndexPage } from './html-index-page';
import { enforceRequestSizeLimit } from './size-limit';
import { enforceRateLimit } from './rate-limiter';

export async function handleRequest(request: Request, env: any, config: Config): Promise<Response> {
	const sizeLimitResponse = await enforceRequestSizeLimit(request, config);
	if (sizeLimitResponse) {
		return addHeaders(request, sizeLimitResponse, config);
	}

	const rateLimitResponse = await enforceRateLimit(request, env);
	if (rateLimitResponse) {
		return addHeaders(request, rateLimitResponse, config);
	}

	const corsResult = handleCors(request, config);
	if (corsResult) {
		return addHeaders(request, corsResult, config);
	}

	const url = new URL(request.url);
	const path = url.pathname;
	const query = url.search;

	if (path === '/') {
		return addHeaders(request, renderApiIndexPage(config), config);
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
		return addHeaders(
			request,
			new Response(JSON.stringify({ error: { message: `Not Found: ${errorMessage}` } }), {
				status: 404,
				headers: { 'Content-Type': 'application/json' },
			}),
			config,
		);
	}

	if (route.validateTurnstileToken) {
		const turnstileResponse = await handleTurnstileValidation(request, config);
		if (turnstileResponse) {
			return addHeaders(request, turnstileResponse, config);
		}
	}

	const cache = caches.default;

	if (route.validateAccessToken) {
		const accessTokenResponse = await handleAccessTokenValidation(request, config, cache);
		if (accessTokenResponse) {
			return addHeaders(request, accessTokenResponse, config);
		}
	}

	const serviceEndpoint = route.serviceEndpoint;
	const apiUrl = serviceEndpoint + path + query;

	let apiRequest = new Request(apiUrl, request);

	if (route.endpointType === ApiEndpointType.AWS_LAMBDA_FUNCTION_URL) {
		apiRequest = await addAwsSignatureToRequest(apiRequest, config);
	} else if (route.endpointType === ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL) {
		apiRequest = await addGoogleIdTokenToRequest(apiRequest, config, cache);
	}

	let response: Response;
	try {
		response = await fetch(apiRequest, { cf: { cacheEverything: true } });
		return addHeaders(request, response, config);
	} catch (error) {
		return addHeaders(
			request,
			new Response(JSON.stringify({ error: { message: 'API Gateway unavailable' } }), {
				status: 503,
				headers: { 'Content-Type': 'application/json' },
			}),
			config,
		);
	}
}
