export async function getGoogleIdToken(
	serviceAccountEmail: string,
	serviceAccountBase64PrivateKey: string,
	cloudRunServiceUrl: string,
	cache: Cache,
): Promise<string> {
	const cacheUrl = `https://cache/google-id-token?email=${encodeURIComponent(serviceAccountEmail)}&audience=${encodeURIComponent(cloudRunServiceUrl)}`;
	const cacheKey = new Request(cacheUrl, { method: 'GET' });
	const cachedToken = await getCachedToken(cache, cacheKey);
	if (cachedToken) {
		console.log('Cache hit for Google ID token');
		return cachedToken;
	}

	const tokenUrl = 'https://oauth2.googleapis.com/token';
	const now = Math.floor(Date.now() / 1000);
	const exp = now + 3600;

	const jwt = {
		iss: serviceAccountEmail,
		sub: serviceAccountEmail,
		aud: tokenUrl,
		target_audience: cloudRunServiceUrl,
		exp: exp,
		iat: now,
	};

	try {
		const binaryKey = Uint8Array.from(atob(serviceAccountBase64PrivateKey), (c) => c.charCodeAt(0));
		const algorithm = { name: 'RSASSA-PKCS1-v1_5', hash: { name: 'SHA-256' } };
		const privateKey = await crypto.subtle.importKey('pkcs8', binaryKey, algorithm, false, ['sign']);

		const jwtHeader = { alg: 'RS256', typ: 'JWT' };
		const encodedHeader = btoa(JSON.stringify(jwtHeader)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const encodedPayload = btoa(JSON.stringify(jwt)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
		const signatureInput = `${encodedHeader}.${encodedPayload}`;

		const signature = await crypto.subtle.sign(algorithm, privateKey, new TextEncoder().encode(signatureInput));
		const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');

		const signedJwt = `${signatureInput}.${encodedSignature}`;
		const response = await fetch(tokenUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`,
		});

		interface TokenResponse {
			access_token?: string;
			id_token?: string;
			expires_in?: number;
			token_type?: string;
			error?: string;
			error_description?: string;
		}

		const data = (await response.json()) as TokenResponse;
		if (!data.id_token) {
			throw new Error(`Failed to get ID token: ${JSON.stringify(data)}`);
		}

		await cacheToken(cache, cacheKey, data.id_token, data.expires_in || 3600);
		return data.id_token;
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		throw new Error(`Failed to get Google access token: ${errorMessage}`);
	}
}

async function getCachedToken(cache: Cache, cacheKey: Request): Promise<string | null> {
	try {
		const cachedData = await cache.match(cacheKey);
		if (!cachedData) return null;

		const tokenData = (await cachedData.json()) as { token: string; expiresAt: number };
		const now = Math.floor(Date.now() / 1000);
		const fiveMinutesInSeconds = 5 * 60;

		return tokenData.expiresAt > now + fiveMinutesInSeconds ? tokenData.token : null;
	} catch (error) {
		console.error('Failed to parse cached token:', error);
		return null;
	}
}

async function cacheToken(cache: Cache, cacheKey: Request, token: string, expiresIn: number): Promise<void> {
	try {
		const now = Math.floor(Date.now() / 1000);
		const expiresAt = now + expiresIn;
		const tokenData = { token, expiresAt };

		const response = new Response(JSON.stringify(tokenData), {
			headers: {
				'Content-Type': 'application/json',
				'Cache-Control': `max-age=${expiresIn}`,
			},
		});

		await cache.put(cacheKey, response);
	} catch (error) {
		console.error('Failed to cache token:', error);
	}
}
