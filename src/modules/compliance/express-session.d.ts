// src/types/express-session.d.ts
import 'express-session';

declare module 'express-session' {
  interface Session {
    officer?: {
      id: number;
      name: string;
    };
  }
}

// Add Flash middleware type definition
declare global {
  namespace Express {
    interface Request {
      flash?: (type: string, message?: string) => string[] | void;
    }
  }
}