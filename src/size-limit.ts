// Implements request size limit logic for API requests
import { Config } from './types';

export async function enforceRequestSizeLimit(request: Request, config: Config): Promise<Response | undefined> {
	try {
		const contentLength = request.headers.get('content-length');
		if (contentLength) {
			const size = parseInt(contentLength, 10);
			if (!isNaN(size) && size > config.maxBodySize) {
				return new Response(JSON.stringify({ error: { message: 'Payload too large' } }), {
					status: 413,
					headers: { 'Content-Type': 'application/json' },
				});
			}
		}
		const clone = request.clone();
		const buffer = await clone.arrayBuffer();
		if (buffer.byteLength > config.maxBodySize) {
			return new Response(JSON.stringify({ error: { message: 'Payload too large' } }), {
				status: 413,
				headers: { 'Content-Type': 'application/json' },
			});
		}
	} catch {
		return new Response(JSON.stringify({ error: { message: 'Unable to determine request size' } }), {
			status: 400,
			headers: { 'Content-Type': 'application/json' },
		});
	}
	return undefined;
}
