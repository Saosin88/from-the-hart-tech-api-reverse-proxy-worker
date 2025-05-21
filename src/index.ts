import { createConfig } from './config';
import { handleRequest } from './request-handler';
import { Env } from './types';

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const config = createConfig(env);
		return handleRequest(request, env, config);
	},
} satisfies ExportedHandler<Env>;
