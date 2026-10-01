const JSON_HEADERS = { 'Content-Type': 'application/json' };

export async function onRequest(context) {
  const { request, env } = context;

  if (!env.BACKEND_URL || !env.PROXY_SHARED_SECRET) {
    return new Response(
      JSON.stringify({ detail: 'The service is not configured yet.', code: 'proxy_misconfigured' }),
      { status: 503, headers: JSON_HEADERS }
    );
  }

  const incoming = new URL(request.url);
  const target = new URL(env.BACKEND_URL);
  target.pathname = incoming.pathname.replace(/^\/api/, '') || '/';
  target.search = incoming.search;

  const proxied = new Request(target.toString(), request);
  proxied.headers.set('X-Proxy-Secret', env.PROXY_SHARED_SECRET);
  proxied.headers.set('X-Client-IP', request.headers.get('CF-Connecting-IP') || '');

  try {
    return await fetch(proxied);
  } catch {
    return new Response(
      JSON.stringify({ detail: 'The server is unreachable right now. Please try again.', code: 'upstream_unreachable' }),
      { status: 502, headers: JSON_HEADERS }
    );
  }
}