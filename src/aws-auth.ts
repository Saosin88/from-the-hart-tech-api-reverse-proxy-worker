import { Config } from './types';

async function sha256(message: string | ArrayBuffer): Promise<ArrayBuffer> {
	const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
	return await crypto.subtle.digest('SHA-256', msgBuffer);
}

function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
	const keyImport = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
	return await crypto.subtle.sign('HMAC', keyImport, new TextEncoder().encode(message));
}

function encodePath(path: string): string {
	return path
		.split('/')
		.map((segment) => {
			if (!segment) return '';
			return encodeURIComponent(segment).replace(/%2F/g, '/');
		})
		.join('/');
}

function extractRegionFromUrl(url: URL): string {
	let region = 'af-south-1';

	const hostname = url.hostname;

	if (hostname.includes('.lambda-url.')) {
		const parts = hostname.split('.lambda-url.');
		if (parts.length > 1) {
			const regionPart = parts[1].split('.')[0];
			if (regionPart) {
				region = regionPart;
			}
		}
	}

	return region;
}

function createCanonicalRequest(method: string, url: URL, headers: Headers, signedHeaderNames: string[], payloadHash: string): string {
	const canonicalUri = url.pathname ? encodePath(url.pathname) : '/';

	const searchParams = Array.from(url.searchParams.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

	const canonicalQueryString = searchParams
		.map(([key, value]) => {
			return `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`;
		})
		.join('&');

	const canonicalHeadersArray = signedHeaderNames.map((headerName) => {
		const headerValue = headers.get(headerName) || '';
		return `${headerName.toLowerCase()}:${headerValue.trim().replace(/\s+/g, ' ')}`;
	});

	const canonicalHeaders = canonicalHeadersArray.join('\n') + '\n';

	const signedHeaders = signedHeaderNames
		.map((h) => h.toLowerCase())
		.sort()
		.join(';');

	return [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');
}

async function getRequestBodyBuffer(request: Request): Promise<ArrayBuffer | null> {
	if (!request.body) return null;

	const clone = request.clone();
	const bodyBuffer = await clone.arrayBuffer();
	return bodyBuffer.byteLength > 0 ? bodyBuffer : null;
}

export async function addAwsSignatureToRequest(request: Request, config: Config): Promise<Request> {
	const requestToSign = request.clone();
	const url = new URL(requestToSign.url);
	const method = requestToSign.method;

	const effectiveRegion = extractRegionFromUrl(url);

	const headers = new Headers(requestToSign.headers);

	const now = new Date();
	const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
	const dateStamp = amzDate.substring(0, 8);

	headers.set('x-amz-date', amzDate);
	headers.set('host', url.hostname);

	let bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // Empty string hash
	const bodyBuffer = await getRequestBodyBuffer(requestToSign);

	if (bodyBuffer) {
		bodyHash = toHex(await sha256(bodyBuffer));
	}

	headers.set('x-amz-content-sha256', bodyHash);

	const signedHeaders = ['host', 'x-amz-content-sha256', 'x-amz-date'];

	if (headers.has('content-type')) {
		signedHeaders.push('content-type');
	}

	const canonicalRequest = createCanonicalRequest(method, url, headers, signedHeaders, bodyHash);

	const algorithm = 'AWS4-HMAC-SHA256';
	const credentialScope = `${dateStamp}/${effectiveRegion}/lambda/aws4_request`;
	const stringToSign = [algorithm, amzDate, credentialScope, toHex(await sha256(canonicalRequest))].join('\n');

	let signingKey = await hmacSha256(new TextEncoder().encode(`AWS4${config.awsSecretAccessKey}`), dateStamp);

	signingKey = await hmacSha256(signingKey, effectiveRegion);
	signingKey = await hmacSha256(signingKey, 'lambda');
	signingKey = await hmacSha256(signingKey, 'aws4_request');

	const signature = toHex(await hmacSha256(signingKey, stringToSign));

	const signedHeadersString = signedHeaders
		.map((h) => h.toLowerCase())
		.sort()
		.join(';');

	const authHeader =
		`${algorithm} ` +
		`Credential=${config.awsAccessKeyId}/${dateStamp}/${effectiveRegion}/lambda/aws4_request, ` +
		`SignedHeaders=${signedHeadersString}, ` +
		`Signature=${signature}`;

	headers.set('Authorization', authHeader);

	return new Request(requestToSign, {
		headers,
	});
}
