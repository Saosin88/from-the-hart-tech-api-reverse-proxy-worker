import { getAllApiRoutes } from './routes';
import { Config } from './types';

export function renderApiIndexPage(config: Config): Response {
	const routes = getAllApiRoutes(config.environment);
	const docLinks = routes
		.map((route) => {
			const docPath = `${route.path}/documentation`;
			const label =
				route.path
					.replace(/^\//, '')
					.replace(/s$/, '')
					.replace(/^(.)/, (c) => c.toUpperCase()) + ' API Documentation';
			return `<li><a class="doc-link" href="${docPath}">${label}</a></li>`;
		})
		.join('\n');

	const html = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>From The Hart API Gateway</title>
	<link rel="icon" href="https://www.fromthehart.tech/favicon.ico">
	<style>
		body { background: #f8fafc; font-family: 'Segoe UI', 'Roboto', 'Arial', sans-serif; margin: 0; }
		.header { background: #1565c0; color: #fff; padding: 2rem 0 1rem 0; text-align: center; }
		.logo { height: 48px; vertical-align: middle; margin-bottom: 0.5rem; }
		.card { background: #fff; max-width: 480px; margin: 2rem auto; border-radius: 8px; box-shadow: 0 2px 12px rgba(21,101,192,0.08); padding: 2rem; }
		h1 { font-size: 2rem; margin: 0 0 0.5rem 0; }
		ul { list-style: none; padding: 0; }
		.doc-link { display: block; padding: 0.75rem 1rem; margin: 0.5rem 0; background: #e3f2fd; color: #1565c0; border-radius: 4px; text-decoration: none; font-weight: 500; transition: background 0.2s; }
		.doc-link:hover { background: #bbdefb; }
		.footer { text-align: center; color: #789; font-size: 0.95rem; margin: 2rem 0 1rem 0; }
	</style>
</head>
<body>
	<div class="header">
		<h1>From The Hart API Gateway</h1>
		<p style="margin:0;font-size:1.1rem;">API Gateway &amp; Documentation Index</p>
	</div>
	<div class="card">
		<h2 style="margin-top:0;">API Documentation</h2>
		<ul>
			${docLinks}
		</ul>
	</div>
	<div class="footer">&copy; ${new Date().getFullYear()} From The Hart &mdash; <a href="https://www.fromthehart.tech" style="color:#1565c0;text-decoration:none;">fromthehart.tech</a></div>
</body>
</html>`;
	return new Response(html, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
