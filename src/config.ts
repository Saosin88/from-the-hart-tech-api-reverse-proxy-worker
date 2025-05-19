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
			contentSecurityPolicy: `frame-ancestors 'none'; default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self';`,
			contentType: 'application/json',
			strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
			xContentTypeOptions: 'nosniff',
			xFrameOptions: 'DENY',
			permissionsPolicy:
				'accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), keyboard-map=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), screen-wake-lock=(), sync-xhr=(), usb=(), web-share=(), xr-spatial-tracking=()',
			referrerPolicy: 'no-referrer',
		},
		corsHeaders: {
			allowedOrigins: ['http://localhost:3000', 'https://dev.fromthehart.tech', 'https://www.fromthehart.tech'],
			allowedMethods: ['GET', 'POST', 'OPTIONS'],
			allowedHeaders: ['Authorization', 'Content-Type', 'X-Requested-With', 'Accept', 'Origin', 'x-cf-turnstile-token'],
			exposeHeaders: ['Content-Length', 'Content-Type', 'Cache-Control'],
			allowCredentials: true,
			maxAge: 3600,
			vary: 'Origin',
		},
	};
}
