import { NextResponse } from 'next/server';

// La présence d'un cookie d'accès n'indique pas si une session est valide.
// AuthProvider restaure le JWT depuis le stockage puis vérifie /users/me/ ;
// AppShell bloque les pages privées, et Django applique les droits des API.
export function middleware() {
  return NextResponse.next();
}
export const config = { matcher: ['/dashboard/:path*', '/drivers/:path*'] };
