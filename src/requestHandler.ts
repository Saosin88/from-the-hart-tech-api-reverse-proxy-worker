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
		const isValid = await handleAccessTokenValidation(request, config, cache);
		if (!isValid) {
			return addCorsHeaders(
				request,
				new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' },
				}),
				config,
			);
		}
	}

	const serviceEndpoint = route.serviceEndpoint;
	const apiUrl = serviceEndpoint + path + query;

	let apiRequest = new Request(apiUrl, request);

	if (route.endpointType === ApiEndpointType.AWS_LAMBDA_FUNCTION_URL) {
		apiRequest = await signRequest(apiRequest, config.awsAccessKeyId, config.awsSecretAccessKey);
	} else if (route.endpointType === ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL) {
		const googleToken = await getGoogleIdToken(config.googleServiceAccountemail, config.googleServiceAccountKey, apiRequest.url, cache);
		apiRequest.headers.set('X-Serverless-Authorization', `Bearer ${googleToken}`);
	}

	let response: Response;
	try {
		response = await fetch(apiRequest, { cf: { cacheEverything: true } });
	} catch (error) {
		return new Response(JSON.stringify({ error: { message: 'API Gateway unavailable' } }), {
			status: 503,
			headers: { 'Content-Type': 'application/json' },
		});
	}

	const corsResponse = addCorsHeaders(request, response, config);

	return corsResponse;
}
