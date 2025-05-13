import { Config, Env } from './types';

export function createConfig(env: Env): Config {
	// Default to 'local' if no environment is specified
	const environment = env.ENVIRONMENT || 'prod';

	return {
		corsAllowedOrigins: ['http://localhost:3000', 'https://dev.fromthehart.tech', 'https://www.fromthehart.tech'],
		corsAllowedMethods: ['GET', 'POST', 'OPTIONS'],
		corsAllowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'x-cf-turnstile-token'],
		corsExposeHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
		corsAllowCredentials: true,
		corsMaxAge: 3600,
		awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
		awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
		googleServiceAccountemail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		googleServiceAccountKey: env.GOOGLE_SERVICE_ACCOUNT_KEY,
		cloudflareTurnstileSecretKey: env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
		environment: environment,
	};
}
