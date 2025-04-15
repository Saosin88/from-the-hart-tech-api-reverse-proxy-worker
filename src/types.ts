export interface Env {
	API_GATEWAY_ORIGIN: string;
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
	AWS_REGION: string;
}

export interface Config {
	apiGatewayOrigin: string;
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
}

export interface CachingDecision {
	shouldCache: boolean;
	howLong: number;
}
