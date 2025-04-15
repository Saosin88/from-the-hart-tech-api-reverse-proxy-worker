export interface RouteConfig {
	path: string;
	serviceEndpoint: string;
}

// Define environment-specific endpoints
export type Environment = 'local' | 'dev' | 'prod';

// Define environment-specific endpoints
export const serviceEndpoints = {
	local: {
		'/projects': '7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
	},
	dev: {
		'/projects': '7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
	},
	prod: {
		'/projects': '27zsxewc6uucq23tpr2erpygki0bwxya.lambda-url.af-south-1.on.aws',
	},
};

export function getRoutes(environment: string): RouteConfig[] {
	// Check if the environment is valid, throw an error if not
	if (!(environment in serviceEndpoints)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(serviceEndpoints).join(', ')}`);
	}

	const endpoints = serviceEndpoints[environment as Environment];

	return Object.entries(endpoints).map(([path, serviceEndpoint]) => ({
		path,
		serviceEndpoint,
	}));
}

export function getServiceEndpoint(path: string, environment: string): string {
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

	return route.serviceEndpoint;
}
