import { ISafeUser } from '@gitleague/types';
import { ISessionDocument } from '@gitleague/database';

declare global {
  namespace Express {
    interface Request {
      user?: ISafeUser | null;
      session?: ISessionDocument | null;
    }
  }
}
