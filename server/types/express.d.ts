import { User } from '../../common/user';

declare module 'express-serve-static-core' {
  interface Request {
    user: User;
    correlationId: string;
  }
}
