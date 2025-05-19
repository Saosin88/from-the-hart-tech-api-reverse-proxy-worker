import { createConfig } from './config';
import { handleRequest } from './request-handler';
import { Env } from './types';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const config = createConfig(env);
		return handleRequest(request, config, ctx);
	},
} satisfies ExportedHandler<Env>;
