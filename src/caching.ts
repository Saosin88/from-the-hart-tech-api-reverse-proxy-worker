import { CachingDecision } from './types';

export function evaluateCaching(request: Request, response?: Response): CachingDecision {
	const result = { shouldCache: false, howLong: 0 };

	if (!['GET', 'HEAD'].includes(request.method)) {
		return result;
	}

	if (!response) {
		return { shouldCache: true, howLong: 0 };
	}

	const cacheControl = response.headers.get('Cache-Control');

	if (!cacheControl) {
		return result;
	}

	const sMaxAgeMatch = cacheControl.match(/s-maxage=(\d+)/);
	if (sMaxAgeMatch && sMaxAgeMatch[1]) {
		return {
			shouldCache: true,
			howLong: parseInt(sMaxAgeMatch[1], 10),
		};
	}

	const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
	if (maxAgeMatch && maxAgeMatch[1]) {
		return {
			shouldCache: true,
			howLong: parseInt(maxAgeMatch[1], 10),
		};
	}

	const cdnDirectives = [/stale-while-revalidate/, /stale-if-error/, /immutable/, /public/];

	for (const pattern of cdnDirectives) {
		if (pattern.test(cacheControl)) {
			return { shouldCache: true, howLong: 300 };
		}
	}

	return result;
}
