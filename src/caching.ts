function checkCache(cacheableRoute: boolean, request: Request): boolean {
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

function shouldCache(cacheableRoute: boolean, response: Response): boolean {
	if (!cacheableRoute) {
		return false;
	}

	const cacheControl = response.headers.get('Cache-Control');

	if (!cacheControl) {
		return false;
	}

	return true;
}

export async function handleCacheCheck(route: any, request: Request, cache: Cache, cacheKey: Request): Promise<Response | null> {
	const doCacheCheck = checkCache(route.cacheable, request);
	if (doCacheCheck) {
		const response = await cache.match(cacheKey);
		if (response) {
			return response;
		}
	}
	return null;
}

export async function handleCacheStore(
	route: any,
	corsResponse: Response,
	errorFlag: boolean,
	cache: Cache,
	cacheKey: Request,
	ctx: ExecutionContext,
) {
	const shouldCacheResponse = shouldCache(route.cacheable, corsResponse);
	if (shouldCacheResponse && !errorFlag) {
		const responseToCache = corsResponse.clone();
		ctx.waitUntil(cache.put(cacheKey, responseToCache));
	}
}
