export interface ApiRouteConfig {
	path: string;
	serviceEndpoint: string;
	endpointType: ApiEndpointType;
	cacheable: boolean;
	validateTurnstileToken: boolean;
	validateAccessToken: boolean;
}

interface ApiServiceConfig {
	serviceEndpoint: string;
	endpointType: ApiEndpointType;
	cacheable?: boolean;
	validateTurnstileToken?: boolean;
	validateAccessToken?: boolean;
	pathRules?: {
		[path: string]: {
			cacheable?: boolean;
			validateTurnstileToken?: boolean;
			validateAccessToken?: boolean;
		};
	};
}

export enum ApiEndpointType {
	AWS_LAMBDA_FUNCTION_URL = 'AWS_LAMBDA_FUNCTION_URL',
	GCP_CLOUD_RUN_SERVICE_URL = 'GCP_CLOUD_RUN_SERVICE_URL',
	OTHER = 'OTHER',
}

export type ApiEnvironment = 'local' | 'dev' | 'prod';

export const apiEndpointsMap = {
	local: {
		'/projects': {
			serviceEndpoint: 'https://7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
			// serviceEndpoint: 'http://localhost:8080',
			endpointType: ApiEndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: true,
			validateAccessToken: false,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-915273311819.africa-south1.run.app',
			// serviceEndpoint: 'http://localhost:8080',
			endpointType: ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			validateAccessToken: false,
			pathRules: {
				'/auth/login': { validateTurnstileToken: false },
				'/auth/register': { validateTurnstileToken: false },
				'/auth/forgot-password': { validateTurnstileToken: false },
				'/auth/resend-verification': { validateAccessToken: true },
			},
		},
	},
	dev: {
		'/projects': {
			serviceEndpoint: 'https://7bu6jnh7kljhlykmi6iiuwqoe40yupit.lambda-url.af-south-1.on.aws',
			endpointType: ApiEndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: false,
			validateAccessToken: false,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-915273311819.africa-south1.run.app',
			endpointType: ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			validateAccessToken: false,
			pathRules: {
				'/auth/login': { validateTurnstileToken: true },
				'/auth/register': { validateTurnstileToken: true },
				'/auth/forgot-password': { validateTurnstileToken: true },
				'/auth/resend-verification': { validateAccessToken: true },
			},
		},
	},
	prod: {
		'/projects': {
			serviceEndpoint: 'https://27zsxewc6uucq23tpr2erpygki0bwxya.lambda-url.af-south-1.on.aws',
			endpointType: ApiEndpointType.AWS_LAMBDA_FUNCTION_URL,
			cacheable: true,
			validateAccessToken: false,
		},
		'/auth': {
			serviceEndpoint: 'https://from-the-hart-auth-247813151171.africa-south1.run.app',
			endpointType: ApiEndpointType.GCP_CLOUD_RUN_SERVICE_URL,
			validateAccessToken: false,
			pathRules: {
				'/auth/login': { validateTurnstileToken: true },
				'/auth/register': { validateTurnstileToken: true },
				'/auth/forgot-password': { validateTurnstileToken: true },
				'/auth/resend-verification': { validateAccessToken: true },
			},
		},
	},
};

export function getAllApiRoutes(environment: string): ApiRouteConfig[] {
	if (!(environment in apiEndpointsMap)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(apiEndpointsMap).join(', ')}`);
	}
	const endpoints = apiEndpointsMap[environment as ApiEnvironment];
	return Object.entries(endpoints).map(([path, config]) => {
		const serviceConfig = config as ApiServiceConfig;
		const routeConfig: ApiRouteConfig = {
			path,
			serviceEndpoint: serviceConfig.serviceEndpoint,
			endpointType: serviceConfig.endpointType,
			cacheable: serviceConfig.cacheable ?? false,
			validateTurnstileToken: serviceConfig.validateTurnstileToken ?? false,
			validateAccessToken: serviceConfig.validateAccessToken ?? true,
		};
		return routeConfig;
	});
}

export function getApiServiceUrl(path: string, environment: string): string {
	const route = resolveApiRouteConfig(path, environment);
	return route.serviceEndpoint;
}

function getApiBaseConfig(path: string, environment: string): { endpointConfig: ApiServiceConfig; pathRule?: Record<string, any> } {
	const endpoints = apiEndpointsMap[environment as ApiEnvironment];
	const baseRoutePath = Object.keys(endpoints).find((routePath) => path.startsWith(routePath) && (routePath !== '/' || path === '/'));
	if (!baseRoutePath) return { endpointConfig: {} as ApiServiceConfig };
	const endpointConfig = endpoints[baseRoutePath as keyof typeof endpoints] as ApiServiceConfig;
	const pathRule = endpointConfig.pathRules?.[path];
	return { endpointConfig, pathRule };
}

function shouldValidateAccessToken(path: string, environment: string): boolean {
	const { endpointConfig, pathRule } = getApiBaseConfig(path, environment);
	if (!endpointConfig) return true;
	if (pathRule?.validateAccessToken !== undefined) return pathRule.validateAccessToken;
	return endpointConfig.validateAccessToken ?? true;
}

function shouldValidateTurnstileToken(path: string, environment: string): boolean {
	const { endpointConfig, pathRule } = getApiBaseConfig(path, environment);
	if (!endpointConfig) return false;
	if (pathRule?.validateTurnstileToken !== undefined) return pathRule.validateTurnstileToken;
	return endpointConfig.validateTurnstileToken ?? false;
}

function isRouteCacheable(path: string, environment: string): boolean {
	const { endpointConfig, pathRule } = getApiBaseConfig(path, environment);
	if (!endpointConfig) return false;
	if (pathRule?.cacheable !== undefined) return pathRule.cacheable;
	return endpointConfig.cacheable ?? false;
}

export function resolveApiRouteConfig(path: string, environment: string): ApiRouteConfig {
	if (!(environment in apiEndpointsMap)) {
		throw new Error(`Invalid environment: ${environment}. Available environments: ${Object.keys(apiEndpointsMap).join(', ')}`);
	}
	const endpoints = apiEndpointsMap[environment as ApiEnvironment];
	const baseRoutePath = Object.keys(endpoints).find((routePath) => path.startsWith(routePath) && (routePath !== '/' || path === '/'));
	if (!baseRoutePath) {
		throw new Error(`No route found for path: ${path}`);
	}
	const endpointConfig = endpoints[baseRoutePath as keyof typeof endpoints] as ApiServiceConfig;
	const route: ApiRouteConfig = {
		path: baseRoutePath,
		serviceEndpoint: endpointConfig.serviceEndpoint,
		endpointType: endpointConfig.endpointType,
		cacheable: isRouteCacheable(path, environment),
		validateTurnstileToken: shouldValidateTurnstileToken(path, environment),
		validateAccessToken: shouldValidateAccessToken(path, environment),
	};
	return route;
}
