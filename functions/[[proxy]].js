// Adapted from R2 example code at https://developers.cloudflare.com/r2/examples/cache-api/

export async function onRequest(context) {
  try {
    const maxage = context.env.MAX_AGE || 3600;
    const { request } = context;
    const url = new URL(request.url);

    // Construct the cache key from the cache URL
    const cacheKey = new Request(url.toString(), request);
    const cache = caches.default;

    // Check whether the value is already available in the cache
    // if not, you will need to fetch it from R2, and store it in the cache
    // for future access
    const cacheResponse = await cache.match(cacheKey);

    if (cacheResponse) {
      console.log(`Cache hit for: ${request.url}.`);
      return cacheResponse;
    }

    console.log(
      `Response for request url: ${request.url} not present in cache. Fetching and caching request.`
    );

    // If not in cache, get it from R2
    const objectKey = url.pathname.slice(1);
    const object = await context.env.PROXY_BUCKET.get(objectKey);
    if (object === null) {
      return new Response('Object Not Found', { status: 404 });
    }

    // Set the appropriate object headers
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('etag', object.httpEtag);

    // Cache API respects Cache-Control headers. Setting s-max-age to 10
    // will limit the response to be in cache for 10 seconds max
    // Any changes made to the response here will be reflected in the cached value
    headers.append('Cache-Control', `s-maxage=${maxage}`);

    const response = new Response(object.body, {
      headers,
    });

    // Store the fetched response as cacheKey
    // Use waitUntil so you can return the response without blocking on
    // writing to cache
    context.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (e) {
    return new Response('Error thrown ' + e.message, { status: 500 });
  }
}