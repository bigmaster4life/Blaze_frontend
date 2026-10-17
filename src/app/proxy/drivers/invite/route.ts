// app/api/proxy/drivers/invite/route.ts
import { NextResponse } from 'next/server';

const UPSTREAM = `${(
  process.env.NEXT_PUBLIC_API_BASE || 'https://be.blazepro.org/api'
).replace(/\/+$/, '')}/drivers/invite/`;

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
      cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json',
        Accept: accept,
        // Ces deux headers aident si ton back whiteliste l'origine
        Origin: 'https://blaze-frontend-indol.vercel.app',
        Referer: 'https://blaze-frontend-indol.vercel.app/',
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
    const timeout =
      e instanceof Error && ['TimeoutError', 'AbortError'].includes(e.name);
    return NextResponse.json(
      {
        detail: timeout
          ? 'Le serveur met trop de temps à répondre.'
          : 'Le serveur est momentanément indisponible.',
      },
      { status: timeout ? 504 : 502 }
    );
  }
}
