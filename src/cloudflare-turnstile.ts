export async function validateTurnstileToken(token: string, secretKey: string, clientIP: string): Promise<boolean> {
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
