import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class AuthGuard extends PassportAuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}

/** Requires a valid JWT whose payload has isAdmin === true. */
@Injectable()
export class AdminGuard extends PassportAuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    const validatedUser = super.handleRequest(err, user, info, context);
    if (!validatedUser?.isAdmin) {
      throw new ForbiddenException('Administrator role required');
    }
    return validatedUser;
  }
}

@Injectable()
export class OptionalAuthGuard extends PassportAuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Never reject — if no valid token is present, req.user will be undefined
  handleRequest(_err: any, user: any) {
    return user ?? null;
  }
}
