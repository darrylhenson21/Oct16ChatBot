import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { config } from './lib/config'

const publicPaths = [
  '/unlock', 
  '/embed',              // ← Added: Allow embed pages
  '/widget.js',          // ← Added: Allow widget script
  '/api/auth/unlock', 
  '/api/health', 
  '/api/bots',           // ← Added: Allow bot API calls (includes chat)
  '/api/leads', 
  '/api/cron/digest'
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next()
  }

  // Allow public paths
  if (publicPaths.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // Check for session cookie
  const token = request.cookies.get(config.session.cookieName)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/unlock', request.url))
  }

  try {
    // Verify JWT
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
```

## Key Changes:

1. ✅ Added `/embed` - allows `/embed/[botId]` pages
2. ✅ Added `/widget.js` - allows the widget script to load
3. ✅ Added `/api/bots` - allows `/api/bots/[id]/chat` to work
4. ❌ Removed `/embed.js` - you don't have this file

---

## Test After Saving:

1. **Restart your dev server** (middleware changes require restart)
2. **Test the embed URL directly**:
```
   http://localhost:3000/embed/b44c37e9-301d-4cef-a659-2c7a0dde568e?title=Test
