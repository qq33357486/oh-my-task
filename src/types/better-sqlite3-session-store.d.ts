declare module 'better-sqlite3-session-store' {
  import session from 'express-session';
  
  interface BetterSqlite3StoreOptions {
    client: import('better-sqlite3').Database;
    table?: string;
    expired?: {
      clear: boolean;
      intervalMs?: number;
    };
  }
  
  // 函数调用返回 Store 类
  function BetterSqlite3StoreConnect(session: typeof import('express-session')): {
    new (options: BetterSqlite3StoreOptions): session.Store;
  };
  
  export default BetterSqlite3StoreConnect;
}
