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

async function handleRequest(request: Request, config: Config): Promise<Response> {
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
	const apiRequest = new Request(apiUrl, {
		method: request.method,
		headers: request.headers,
		body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.clone().arrayBuffer(),
	});

	// Add the authorization header
	apiRequest.headers.set(config.authHeader, config.authValue);

	const someCustomKey = apiUrl + request.method + request.headers.get('Authorization');
	console.log('Custom Cache Key:', someCustomKey);
	console.log('API URL:', apiUrl);
	console.log('Request Method:', request.method);
	console.log('Request Headers:', request.headers);
	console.log('Request Body:', request.body);
	console.log('Request URL:', request.url);
	console.log('Request Path:', path);
	console.log('Request Query:', query);
	// Send request to API Gateway with CF cache directives
	let response = await fetch(apiRequest, {
		cf: {
			// Enable caching for GET requests
			cacheEverything: false,
			// Honor origin cache headers, with defaults
			respectOriginHeaders: true,
			cacheKey: someCustomKey,
		},
	} as RequestInit);

	// Clone the response and add CORS headers
	response = addCorsHeaders(request, response, config);
	console.log('Response Status:', response.status);
	console.log('Response Headers:', response.headers);
	console.log('Response Body:', response.body);

	return response;
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

	if (origin && (config.corsAllowedOrigins.includes(origin) || config.corsAllowedOrigins.includes('*'))) {
		const newResponse = new Response(response.body, response);
		newResponse.headers.set('Access-Control-Allow-Origin', origin);
		newResponse.headers.set('Access-Control-Allow-Credentials', config.corsAllowCredentials ? 'true' : 'false');
		config.corsExposeHeaders.forEach((header) => {
			newResponse.headers.append('Access-Control-Expose-Headers', header);
		});
		return newResponse;
	}

	return response;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const config = createConfig(env);
		return handleRequest(request, config);
	},
} satisfies ExportedHandler<Env>;
