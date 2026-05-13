import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

/**
 * Authenticate every /_premaccess/* request against Twenty's JWT.
 *
 * Twenty signs access tokens with HS256(APP_SECRET) — same secret backing the
 * GraphQL/metadata endpoints. We verify the same way so a request reaching
 * the Premaccess controller is provably from an authenticated Twenty session,
 * not an anonymous probe.
 *
 * Token source order:
 *   1. `Authorization: Bearer <jwt>` header (preferred, used when the SPA
 *      explicitly forwards the access token)
 *   2. `tokenPair` cookie set by Twenty's front (Jotai cookieStorage atom in
 *      twenty-front/src/modules/auth/states/tokenPairState.ts)
 *
 * The decoded payload is attached to req.premaccessAuth for downstream
 * handlers that want workspaceId / userId without re-decoding.
 */
@Injectable()
export class PremaccessAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { premaccessAuth?: jwt.JwtPayload }>();
    const token = this.extractToken(req);

    if (token === null) {
      throw new UnauthorizedException('Premaccess: no auth token');
    }

    const secret = process.env.APP_SECRET;
    if (secret === undefined || secret === '') {
      throw new UnauthorizedException('Premaccess: APP_SECRET not configured');
    }

    try {
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      req.premaccessAuth = payload;
      return true;
    } catch (e) {
      throw new UnauthorizedException(`Premaccess: invalid token — ${(e as Error).message}`);
    }
  }

  private extractToken(req: Request): string | null {
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Bearer ')) {
      return header.slice(7).trim();
    }
    const cookieHeader = req.headers.cookie ?? '';
    const match = cookieHeader.match(/(?:^|;\s*)tokenPair=([^;]+)/);
    if (match === null) return null;
    try {
      const decoded = decodeURIComponent(match[1]);
      const parsed = JSON.parse(decoded) as {
        accessOrWorkspaceAgnosticToken?: { token?: string };
      };
      return parsed.accessOrWorkspaceAgnosticToken?.token ?? null;
    } catch {
      return null;
    }
  }
}
