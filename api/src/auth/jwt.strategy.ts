import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_USERNAME_CLAIM,
  ADMINISTRATORS_GROUP,
  JwtPayload,
} from './auth.constants';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const userPoolId = configService.get<string>('USER_POOL_ID');
    const region = configService.get<string>('AWS_REGION', 'ap-southeast-2');
    const cognitoEndpoint = configService.get<string>('COGNITO_ENDPOINT');

    // In local dev the emulator is at COGNITO_ENDPOINT; in production use the real AWS endpoint.
    const cognitoBaseUrl = cognitoEndpoint
      ? `${cognitoEndpoint}/${userPoolId}`
      : `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      // Accept the token from either the Authorization header (normal API calls)
      // or a `?token=` query parameter (used by the share viewer iframe).
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      // Cognito local emulator hardcodes iss as localhost:9229 regardless of mapped port.
      // Skip issuer validation in local dev; in production the issuer is stable.
      ...(cognitoEndpoint ? {} : { issuer: cognitoBaseUrl }),
      audience: configService.get<string>('USER_POOL_CLIENT_ID'),
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: `${cognitoBaseUrl}/.well-known/jwks.json`,
      }),
    });
  }

  validate(payload: Record<string, unknown>): JwtPayload {
    const username = payload[DEFAULT_USERNAME_CLAIM] as string;
    if (!username) {
      throw new UnauthorizedException('Invalid token: missing email claim');
    }
    const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];
    return { username, isAdmin: groups.includes(ADMINISTRATORS_GROUP) };
  }
}
