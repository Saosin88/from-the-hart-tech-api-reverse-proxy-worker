/**
 * AWS Signature Version 4 utility for authenticating requests to AWS services
 */

// SHA-256 hash function
async function sha256(message: string | ArrayBuffer): Promise<ArrayBuffer> {
	const msgBuffer = typeof message === 'string' ? new TextEncoder().encode(message) : message;
	return await crypto.subtle.digest('SHA-256', msgBuffer);
}

// Convert ArrayBuffer to hex string
function toHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// HMAC-SHA256 function
async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
	const keyImport = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: { name: 'SHA-256' } }, false, ['sign']);
	return await crypto.subtle.sign('HMAC', keyImport, new TextEncoder().encode(message));
}

// Properly encode URI path for AWS
function encodePath(path: string): string {
	// AWS expects path segments to be individually encoded
	return path
		.split('/')
		.map((segment) => {
			if (!segment) return '';
			return encodeURIComponent(segment).replace(/%2F/g, '/');
		})
		.join('/');
}

// Extract region from AWS hostname
function extractRegionFromUrl(url: URL): string {
	// Default region if we can't extract it
	let region = 'af-south-1';

	// Lambda URL format: <function-url-id>.lambda-url.<region>.on.aws
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

// Create canonical request
function createCanonicalRequest(method: string, url: URL, headers: Headers, signedHeaderNames: string[], payloadHash: string): string {
	// AWS requires specific URI encoding rules
	const canonicalUri = url.pathname ? encodePath(url.pathname) : '/';

	// Process and sort query parameters using AWS rules
	const searchParams = Array.from(url.searchParams.entries()).sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

	const canonicalQueryString = searchParams
		.map(([key, value]) => {
			return `${encodeURIComponent(key)}=${encodeURIComponent(value || '')}`;
		})
		.join('&');

	// Lowercase header names and trim values as per AWS requirements
	const canonicalHeadersArray = signedHeaderNames.map((headerName) => {
		const headerValue = headers.get(headerName) || '';
		return `${headerName.toLowerCase()}:${headerValue.trim().replace(/\s+/g, ' ')}`;
	});

	const canonicalHeaders = canonicalHeadersArray.join('\n') + '\n';

	// Generate signed headers string
	const signedHeaders = signedHeaderNames
		.map((h) => h.toLowerCase())
		.sort()
		.join(';');

	// Combine all parts into the canonical request
	return [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join('\n');
}

// Get the request body as an ArrayBuffer
async function getRequestBodyBuffer(request: Request): Promise<ArrayBuffer | null> {
	if (!request.body) return null;

	const clone = request.clone();
	const bodyBuffer = await clone.arrayBuffer();
	return bodyBuffer.byteLength > 0 ? bodyBuffer : null;
}

// Sign AWS request with Signature Version 4
export async function signRequest(
	request: Request,
	accessKey: string,
	secretKey: string,
	region?: string,
	service: string = 'lambda'
): Promise<Request> {
	// Clone the request to avoid modifying the original
	const requestToSign = request.clone();
	const url = new URL(requestToSign.url);
	const method = requestToSign.method;

	// If region is not provided, extract it from the URL
	const effectiveRegion = region || extractRegionFromUrl(url);

	// Create headers object to modify
	const headers = new Headers(requestToSign.headers);

	// Format date and time according to AWS requirements
	const now = new Date();
	const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, '');
	const dateStamp = amzDate.substring(0, 8);

	// Set required headers
	headers.set('x-amz-date', amzDate);
	headers.set('host', url.hostname);

	// Handle request body/payload hash
	let bodyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'; // Empty string hash
	const bodyBuffer = await getRequestBodyBuffer(requestToSign);

	if (bodyBuffer) {
		bodyHash = toHex(await sha256(bodyBuffer));
	}

	headers.set('x-amz-content-sha256', bodyHash);

	// List of headers to include in signature
	const signedHeaders = ['host', 'x-amz-content-sha256', 'x-amz-date'];

	// Add specific Lambda URL headers if present
	if (headers.has('content-type')) {
		signedHeaders.push('content-type');
	}

	// Create canonical request
	const canonicalRequest = createCanonicalRequest(method, url, headers, signedHeaders, bodyHash);

	// Create string to sign
	const algorithm = 'AWS4-HMAC-SHA256';
	const credentialScope = `${dateStamp}/${effectiveRegion}/${service}/aws4_request`;
	const stringToSign = [algorithm, amzDate, credentialScope, toHex(await sha256(canonicalRequest))].join('\n');

	// Calculate the signature
	let signingKey = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);

	signingKey = await hmacSha256(signingKey, effectiveRegion);
	signingKey = await hmacSha256(signingKey, service);
	signingKey = await hmacSha256(signingKey, 'aws4_request');

	const signature = toHex(await hmacSha256(signingKey, stringToSign));

	// Create authorization header
	const signedHeadersString = signedHeaders
		.map((h) => h.toLowerCase())
		.sort()
		.join(';');

	const authHeader =
		`${algorithm} ` +
		`Credential=${accessKey}/${dateStamp}/${effectiveRegion}/${service}/aws4_request, ` +
		`SignedHeaders=${signedHeadersString}, ` +
		`Signature=${signature}`;

	headers.set('Authorization', authHeader);

	// Create new request with signed headers
	return new Request(requestToSign, {
		headers,
	});
}
