import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

/**
 * Authenticate every /_premaccess/* request against Twenty's JWT.
 *
 * Twenty does not sign access tokens with the raw APP_SECRET. Instead it
 * derives a per-workspace secret:
 *
 *     sha256(APP_SECRET + workspaceId + 'ACCESS').hexdigest()
 *
 * — see packages/twenty-server/src/engine/core-modules/jwt/services/
 * jwt-wrapper.service.ts::generateAppSecret. We mirror that here: decode the
 * token (no verify) to read the workspaceId from the payload, derive the
 * same secret, then verify the signature against it. Stays in lockstep with
 * Twenty's own auth pipeline so a token accepted by /metadata is also
 * accepted by /_premaccess/*.
 *
 * Token source order:
 *   1. `Authorization: Bearer <jwt>` header (PremaccessApp.tsx fetch wrapper)
 *   2. `tokenPair` cookie set by Twenty's front (tokenPairState.ts)
 */
@Injectable()
export class PremaccessAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { premaccessAuth?: jwt.JwtPayload }
    >();
    const token = this.extractToken(req);

    if (token === null) {
      throw new UnauthorizedException('Premaccess: no auth token');
    }

    const appSecret = process.env.APP_SECRET;
    if (appSecret === undefined || appSecret === '') {
      throw new UnauthorizedException('Premaccess: APP_SECRET not configured');
    }

    let decoded: jwt.JwtPayload;
    try {
      decoded = jwt.decode(token, { json: true }) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedException('Premaccess: cannot decode token');
    }
    if (decoded === null || typeof decoded !== 'object') {
      throw new UnauthorizedException('Premaccess: invalid token payload');
    }

    const tokenType = (decoded.type as string) ?? 'ACCESS';
    const appSecretBody = (decoded.workspaceId as string) ?? (decoded.userId as string);
    if (appSecretBody === undefined) {
      throw new UnauthorizedException('Premaccess: token missing workspaceId/userId');
    }
    const derivedSecret = createHash('sha256')
      .update(`${appSecret}${appSecretBody}${tokenType}`)
      .digest('hex');

    try {
      const verified = jwt.verify(token, derivedSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      req.premaccessAuth = verified;
      return true;
    } catch (e) {
      throw new UnauthorizedException(
        `Premaccess: invalid token — ${(e as Error).message}`,
      );
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
