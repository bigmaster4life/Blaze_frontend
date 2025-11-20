// app/api/proxy/drivers/invite/route.ts
import { NextResponse } from 'next/server';

const UPSTREAM = 'https://api-preprod.blazepro.org/api/drivers/invite/';

// Important pour Vercel : ne pas mettre en cache
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // On récupère tel quel ce que le navigateur envoie
    const auth = req.headers.get('authorization') || '';
    const accept = req.headers.get('accept') || 'application/json';
    const body = await req.text(); // on ne reparse pas, on forward tel quel

    // On proxy vers l'API préprod (server->server)
    const upstreamRes = await fetch(UPSTREAM, {
      method: 'POST',
      headers: {
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': accept,
        // Ces deux headers aident si ton back whiteliste l'origine
        'Origin': 'https://blaze-frontend-indol.vercel.app',
        'Referer': 'https://blaze-frontend-indol.vercel.app/',
      },
      body,
    });

    // On renvoie la réponse **telle quelle** au navigateur
    const text = await upstreamRes.text();
    return new NextResponse(text, {
      status: upstreamRes.status,
      headers: {
        'content-type': upstreamRes.headers.get('content-type') || 'text/plain',
        'cache-control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: 'Proxy error', error: msg }, { status: 502 });
  }
}