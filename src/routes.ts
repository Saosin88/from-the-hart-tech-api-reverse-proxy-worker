export interface RouteConfig {
	path: string;
	serviceEndpoint: string;
	endpointType: EndpointType;
	cacheable: boolean;
	validateTurnstileToken: boolean;
}

// Internal interface used for configuration and not exposed to consumers
interface ServiceEndpointConfig {
	serviceEndpoint: string;
	endpointType: EndpointType;
	cacheable?: boolean;
	validateTurnstileToken?: boolean;
	pathRules?: {
		[path: string]: {
			validateTurnstileToken: boolean;
		};
	};
}

export enum EndpointType {
	AWS_LAMBDA_FUNCTION_URL = 'AWS_LAMBDA_FUNCTION_URL',
	GCP_CLOUD_RUN_SERVICE_URL = 'GCP_CLOUD_RUN_SERVICE_URL',
	OTHER = 'OTHER',
}

// Define environment-specific endpoints
export type Environment = 'local' | 'dev' | 'prod';

// Define environment-specific endpoints
export const serviceEndpoints = {
	local: {
		'/projects': {
			serviceEndpoint: 'https://7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
			endpointType: EndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: true,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-915273311819.africa-south1.run.app',
			endpointType: EndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			pathRules: {
				'/auth/login': { validateTurnstileToken: true },
				'/auth/register': { validateTurnstileToken: true },
				'/auth/forgot-password': { validateTurnstileToken: true },
			},
		},
	},
	dev: {
		'/projects': {
			serviceEndpoint: 'https://7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
			endpointType: EndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: true,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-915273311819.africa-south1.run.app',
			endpointType: EndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			pathRules: {
				'/auth/login': { validateTurnstileToken: true },
				'/auth/register': { validateTurnstileToken: true },
				'/auth/forgot-password': { validateTurnstileToken: true },
			},
		},
	},
	prod: {
		'/projects': {
			serviceEndpoint: 'https://27zsxewc6uucq23tpr2erpygki0bwxya.lambda-url.af-south-1.on.aws',
			endpointType: EndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: true,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-247813151171.africa-south1.run.app',
			endpointType: EndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			pathRules: {
				'/auth/login': { validateTurnstileToken: true },
				'/auth/register': { validateTurnstileToken: true },
				'/auth/forgot-password': { validateTurnstileToken: true },
			},
		},
	},
};

export function getRoutes(environment: string): RouteConfig[] {
	// Check if the environment is valid, throw an error if not
	if (!(environment in serviceEndpoints)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(serviceEndpoints).join(', ')}`);
	}

	const endpoints = serviceEndpoints[environment as Environment];

	return Object.entries(endpoints).map(([path, config]) => {
		const serviceConfig = config as ServiceEndpointConfig;

		const routeConfig: RouteConfig = {
			path,
			serviceEndpoint: serviceConfig.serviceEndpoint,
			endpointType: serviceConfig.endpointType,
			cacheable: serviceConfig.cacheable ?? false,
			validateTurnstileToken: serviceConfig.validateTurnstileToken ?? false,
		};

		return routeConfig;
	});
}

export function getServiceEndpoint(path: string, environment: string): string {
	const route = getRouteForPath(path, environment);
	return route.serviceEndpoint;
}

export function getRouteForPath(path: string, environment: string): RouteConfig {
	// Get the raw endpoints configuration
	if (!(environment in serviceEndpoints)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(serviceEndpoints).join(', ')}`);
	}

	const endpoints = serviceEndpoints[environment as Environment];

	// Find the matching base route
	const baseRoutePath = Object.keys(endpoints).find(
		(routePath) =>
			path.startsWith(routePath) &&
			// For the default route, only match if it's exactly '/' to avoid matching everything
			(routePath !== '/' || path === '/'),
	);

	if (!baseRoutePath) {
		throw new Error(`No route found for path: ${path}`);
	}

	const endpointConfig = endpoints[baseRoutePath as keyof typeof endpoints] as ServiceEndpointConfig;

	// Create a RouteConfig without pathRules
	const route: RouteConfig = {
		path: baseRoutePath,
		serviceEndpoint: endpointConfig.serviceEndpoint,
		endpointType: endpointConfig.endpointType,
		cacheable: endpointConfig.cacheable ?? false,
		validateTurnstileToken: endpointConfig.validateTurnstileToken ?? false,
	};

	// Apply path-specific rules if they exist
	if (endpointConfig.pathRules && endpointConfig.pathRules[path]) {
		route.validateTurnstileToken = endpointConfig.pathRules[path].validateTurnstileToken;
	}

	console.log('Route:', JSON.stringify(route));

	return route;
}
