export const DEFAULT_USERNAME_CLAIM = 'email';
export const ADMINISTRATORS_GROUP = 'administrators';

export interface JwtPayload {
  username: string;
  sub: string;
  isAdmin: boolean;
  groups: string[];
}
