export function getBearerToken(request: Request): string | undefined {
	const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return undefined;
	}
	const token = authHeader.substring('Bearer '.length).trim();
	return token || undefined;
}
