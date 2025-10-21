import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { config } from './lib/config'

const publicPaths = [
  '/unlock', 
  '/embed',
  '/widget.js',
  '/api/auth/unlock', 
  '/api/health', 
  '/api/bots',
  '/api/leads', 
  '/api/cron/digest'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(config.session.cookieName)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/unlock', request.url))
  }

  try {
    const secret = new TextEncoder().encode(config.session.secret)
    await jwtVerify(token, secret)
    
    return NextResponse.next()
  } catch (error) {
    return NextResponse.redirect(new URL('/unlock', request.url))
  }
}

export const config_middleware = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
