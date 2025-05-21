async function validateTurnstileToken(token: string, secretKey: string, clientIP: string): Promise<boolean> {
	const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		body: JSON.stringify({
			secret: secretKey,
			response: token,
			remoteip: clientIP,
		}),
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
	});

	interface TurnstileResponse {
		success: boolean;
		[key: string]: any;
	}

	const outcome = (await result.json()) as TurnstileResponse;
	return outcome.success === true;
}

export async function handleTurnstileValidation(request: Request, config: any): Promise<Response | null> {
	const turnstileToken = request.headers.get('x-cf-turnstile-token');
	if (!turnstileToken) {
		return new Response(JSON.stringify({ error: { message: 'Turnstile token required' } }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	const clientIP = request.headers.get('cf-connecting-ip') || '';
	const isValid = await validateTurnstileToken(turnstileToken, config.cloudflareTurnstileSecretKey, clientIP);
	if (!isValid) {
		return new Response(JSON.stringify({ error: { message: 'Invalid Turnstile token' } }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	return null;
}
