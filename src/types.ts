export interface Env {
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
	GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
	GOOGLE_SERVICE_ACCOUNT_KEY: string;
	ENVIRONMENT?: string;
}

export interface Config {
	corsAllowedOrigins: string[];
	corsAllowedMethods: string[];
	corsAllowedHeaders: string[];
	corsExposeHeaders: string[];
	corsAllowCredentials: boolean;
	corsMaxAge: number;
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	googleServiceAccountemail: string;
	googleServiceAccountKey: string;
	environment: string;
}
