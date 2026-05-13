import { initDb } from './connection.js';
import { logger } from '../utils/logger.js';

// 初始化数据库
initDb();
logger.info('db', '数据库初始化脚本完成', '数据库初始化脚本已执行完成');
