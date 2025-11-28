const mysql = require('mysql2/promise');

// 导入应用配置
const appConfig = require('./app');

// 数据库连接配置 - 宝塔面板环境
const dbConfig = {
  host: appConfig.database.host,
  user: appConfig.database.user,
  password: appConfig.database.password,
  database: appConfig.database.database,
  charset: 'utf8mb4'
};

// 数据库连接池
let pool;

/**
 * 初始化数据库连接
 */
async function initDatabase() {
  try {
    pool = mysql.createPool(dbConfig);

    // 测试连接
    const connection = await pool.getConnection();
    console.log('✅ 数据库连接成功');
    connection.release();

    // 更新模块导出中的pool引用
    module.exports.pool = pool;

    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  }
}

/**
 * 获取数据库连接池
 */
function getPool() {
  if (!pool) {
    throw new Error('数据库连接池未初始化');
  }
  return pool;
}

/**
 * 执行SQL查询的辅助函数
 */
async function executeQuery(sql, params = []) {
  try {
    const pool = getPool();
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error('SQL查询执行失败:', error.message, 'SQL:', sql);
    throw error;
  }
}

/**
 * 开始事务
 */
async function beginTransaction() {
  const pool = getPool();
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  return connection;
}

/**
 * 提交事务
 */
async function commitTransaction(connection) {
  await connection.commit();
  connection.release();
}

/**
 * 回滚事务
 */
async function rollbackTransaction(connection) {
  await connection.rollback();
  connection.release();
}

module.exports = {
  initDatabase,
  getPool,
  executeQuery,
  beginTransaction,
  commitTransaction,
  rollbackTransaction,
  dbConfig,
  pool: null // 导出pool对象，供其他模块使用
};