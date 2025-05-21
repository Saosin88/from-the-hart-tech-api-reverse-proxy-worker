export function getBearerToken(request: Request): string | undefined {
	const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return undefined;
	}
	const token = authHeader.substring('Bearer '.length).trim();
	return token || undefined;
}

export async function getRequestBodySize(request: Request): Promise<number> {
	const contentLength = request.headers.get('content-length');
	if (contentLength) {
		const size = parseInt(contentLength, 10);
		if (!isNaN(size)) return size;
	}
	const clone = request.clone();
	const buffer = await clone.arrayBuffer();
	return buffer.byteLength;
}
