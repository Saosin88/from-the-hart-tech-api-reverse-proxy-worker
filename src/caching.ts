export function checkCache(cacheableRoute: boolean, request: Request): boolean {
	if (!cacheableRoute) {
		return false;
	}

	if (!request) {
		return false;
	}

	if (!['GET', 'HEAD'].includes(request.method)) {
		return false;
	}

	if (request.headers.has('Authorization')) {
		return false;
	}

	return true;
}

export function shouldCache(cacheableRoute: boolean, response: Response): boolean {
	if (!cacheableRoute) {
		return false;
	}

	const cacheControl = response.headers.get('Cache-Control');

	if (!cacheControl) {
		return false;
	}

	return true;
}
