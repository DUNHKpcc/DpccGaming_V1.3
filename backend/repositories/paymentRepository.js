let paymentTablesInitPromise = null;

const ensurePaymentTables = async (pool) => {
  if (!paymentTablesInitPromise) {
    paymentTablesInitPromise = Promise.all([
      pool.execute(`
        CREATE TABLE IF NOT EXISTS payment_orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_no VARCHAR(64) NOT NULL UNIQUE,
          user_id INT NOT NULL,
          provider VARCHAR(24) NOT NULL DEFAULT 'alipay',
          plan_id VARCHAR(32) NOT NULL,
          duration_id VARCHAR(32) NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(8) NOT NULL DEFAULT 'CNY',
          subject VARCHAR(128) NOT NULL,
          status ENUM('pending', 'paid', 'closed') NOT NULL DEFAULT 'pending',
          alipay_trade_no VARCHAR(96) DEFAULT NULL,
          paid_at DATETIME DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_payment_orders_user_id (user_id),
          INDEX idx_payment_orders_status (status),
          CONSTRAINT fk_payment_orders_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `),
      pool.execute(`
        CREATE TABLE IF NOT EXISTS user_api_memberships (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL UNIQUE,
          plan_id VARCHAR(32) NOT NULL,
          daily_quota_usd DECIMAL(10,2) NOT NULL,
          starts_at DATETIME NOT NULL,
          expires_at DATETIME NOT NULL,
          last_order_no VARCHAR(64) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_user_api_memberships_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `)
    ]).catch((error) => {
      paymentTablesInitPromise = null;
      throw error;
    });
  }

  await paymentTablesInitPromise;
};

const createPaymentOrder = async (pool, order = {}) => {
  await ensurePaymentTables(pool);
  await pool.execute(
    `
      INSERT INTO payment_orders
        (order_no, user_id, provider, plan_id, duration_id, amount, currency, subject, status)
      VALUES (?, ?, 'alipay', ?, ?, ?, 'CNY', ?, 'pending')
    `,
    [
      order.orderNo,
      order.userId,
      order.planId,
      order.durationId,
      order.amount,
      order.subject
    ]
  );
};

const getPaymentOrderByNo = async (executor, orderNo = '') => {
  const [rows] = await executor.execute(
    'SELECT * FROM payment_orders WHERE order_no = ? LIMIT 1',
    [orderNo]
  );
  return rows[0] || null;
};

const getPaymentOrderByNoForUpdate = async (executor, orderNo = '') => {
  const [rows] = await executor.execute(
    'SELECT * FROM payment_orders WHERE order_no = ? LIMIT 1 FOR UPDATE',
    [orderNo]
  );
  return rows[0] || null;
};

const getMembershipByUserId = async (executor, userId) => {
  const [rows] = await executor.execute(
    'SELECT * FROM user_api_memberships WHERE user_id = ? LIMIT 1',
    [userId]
  );
  return rows[0] || null;
};

const markOrderPaid = async (executor, order = {}) => executor.execute(
  `
    UPDATE payment_orders
    SET status = 'paid', alipay_trade_no = ?, paid_at = ?
    WHERE order_no = ? AND status = 'pending'
  `,
  [order.alipayTradeNo, order.paidAt, order.orderNo]
);

const insertMembership = async (executor, membership = {}) => executor.execute(
  `
    INSERT INTO user_api_memberships
      (user_id, plan_id, daily_quota_usd, starts_at, expires_at, last_order_no)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
  [
    membership.userId,
    membership.planId,
    membership.dailyQuotaUsd,
    membership.startsAt,
    membership.expiresAt,
    membership.orderNo
  ]
);

const updateMembership = async (executor, membership = {}) => executor.execute(
  `
    UPDATE user_api_memberships
    SET plan_id = ?, daily_quota_usd = ?, starts_at = ?, expires_at = ?, last_order_no = ?
    WHERE user_id = ?
  `,
  [
    membership.planId,
    membership.dailyQuotaUsd,
    membership.startsAt,
    membership.expiresAt,
    membership.orderNo,
    membership.userId
  ]
);

module.exports = {
  ensurePaymentTables,
  createPaymentOrder,
  getPaymentOrderByNo,
  getPaymentOrderByNoForUpdate,
  getMembershipByUserId,
  markOrderPaid,
  insertMembership,
  updateMembership
};
