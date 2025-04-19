export interface RouteConfig {
	path: string;
	serviceEndpoint: string;
	endpointType: EndpointType;
	cacheable: boolean;
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
			cacheable: false,
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
			cacheable: false,
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
			cacheable: false,
		},
	},
};

export function getRoutes(environment: string): RouteConfig[] {
	// Check if the environment is valid, throw an error if not
	if (!(environment in serviceEndpoints)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(serviceEndpoints).join(', ')}`);
	}

	const endpoints = serviceEndpoints[environment as Environment];

	return Object.entries(endpoints).map(([path, { serviceEndpoint, endpointType, cacheable }]) => ({
		path,
		serviceEndpoint,
		endpointType,
		cacheable,
	}));
}

export function getServiceEndpoint(path: string, environment: string): string {
	const route = getRouteForPath(path, environment);
	return route.serviceEndpoint;
}

export function getRouteForPath(path: string, environment: string): RouteConfig {
	const routes = getRoutes(environment);

	// Find the first route that matches the path (paths that start with the route path)
	const route = routes.find(
		(route) =>
			path.startsWith(route.path) &&
			// For the default route, only match if it's exactly '/' to avoid matching everything
			(route.path !== '/' || path === '/')
	);

	// If no route matches, throw an error instead of using a default
	if (!route) {
		throw new Error(`No route found for path: ${path}`);
	}

	return route;
}
