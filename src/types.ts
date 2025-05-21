export interface Env {
	AWS_ACCESS_KEY_ID: string;
	AWS_SECRET_ACCESS_KEY: string;
	GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
	GOOGLE_SERVICE_ACCOUNT_KEY: string;
	CLOUDFLARE_TURNSTILE_SECRET_KEY: string;
	ENVIRONMENT?: string;
}

export interface SecurityHeadersConfig {
	cacheControl: string;
	contentSecurityPolicy: string;
	contentType: string;
	strictTransportSecurity: string;
	xContentTypeOptions: string;
	xFrameOptions: string;
	permissionsPolicy: string;
	referrerPolicy: string;
}

export interface CorsHeadersConfig {
	allowedOrigins: string[];
	allowedMethods: string[];
	allowedHeaders: string[];
	exposeHeaders: string[];
	allowCredentials: boolean;
	maxAge: number;
	vary: string;
}

export interface Config {
	awsAccessKeyId: string;
	awsSecretAccessKey: string;
	googleServiceAccountemail: string;
	googleServiceAccountKey: string;
	cloudflareTurnstileSecretKey: string;
	environment: string;
	securityHeaders: SecurityHeadersConfig;
	corsHeaders: CorsHeadersConfig;
	maxBodySize: number;
}
