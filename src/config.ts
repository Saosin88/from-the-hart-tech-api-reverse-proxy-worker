import { Config, Env } from './types';

export function createConfig(env: Env): Config {
	const environment = env.ENVIRONMENT || 'prod';

	return {
		awsAccessKeyId: env.AWS_ACCESS_KEY_ID,
		awsSecretAccessKey: env.AWS_SECRET_ACCESS_KEY,
		googleServiceAccountemail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
		googleServiceAccountKey: env.GOOGLE_SERVICE_ACCOUNT_KEY,
		cloudflareTurnstileSecretKey: env.CLOUDFLARE_TURNSTILE_SECRET_KEY,
		environment: environment,
		securityHeaders: {
			cacheControl: 'no-store',
			contentSecurityPolicy: `frame-ancestors 'none'; default-src 'none'; script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'`,
			contentType: 'application/json',
			strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
			xContentTypeOptions: 'nosniff',
			xFrameOptions: 'DENY',
			permissionsPolicy:
				'accelerometer=(), autoplay=(), camera=(), cross-origin-isolated=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), xr-spatial-tracking=()',
			referrerPolicy: 'no-referrer',
		},
		corsHeaders: {
			allowedOrigins: environment === 'prod' ? ['https://www.fromthehart.tech'] : ['http://localhost:3000', 'https://dev.fromthehart.tech'],
			allowedMethods: ['GET', 'POST', 'OPTIONS'],
			allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'x-cf-turnstile-token'],
			exposeHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
			allowCredentials: true,
			maxAge: 3600,
			vary: 'Origin',
		},
		maxBodySize: 1, // 1MB
	};
}
