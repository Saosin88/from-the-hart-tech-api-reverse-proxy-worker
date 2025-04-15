export interface Env {
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
	AWS_REGION: string;
	ENVIRONMENT?: string;
}

export interface Config {
	authHeader: string;
	authValue: string;
	corsAllowedOrigins: string[];
	corsAllowedMethods: string[];
	corsAllowedHeaders: string[];
	corsExposeHeaders: string[];
	corsAllowCredentials: boolean;
	corsMaxAge: number;
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	awsRegion: string;
	environment: string;
}

export interface CachingDecision {
	shouldCache: boolean;
	howLong: number;
}

export interface RouteConfigMap {
	[environment: string]: {
		[path: string]: string;
	};
}
