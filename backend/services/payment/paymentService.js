const { getPool } = require('../../config/database');
const paymentConfig = require('../../config/payment');
const repository = require('../../repositories/paymentRepository');
const {
  getPaymentPlan,
  getPaymentDuration,
  calculateOrderAmount,
  listPaymentPlans,
  listPaymentDurations
} = require('./plans');
const {
  buildAlipayPagePayForm,
  verifyAlipayNotifyParams
} = require('./alipay');

const toMysqlDateTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes()),
    ':',
    pad(date.getSeconds())
  ].join('');
};

const addMonths = (date, months) => {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + Number(months || 0));
  return next;
};

const createOrderNo = () => {
  const datePart = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DPCC${datePart}${randomPart}`;
};

const ensureAlipayCreateConfig = () => {
  const missing = [];
  if (!paymentConfig.alipay.appId) missing.push('ALIPAY_APP_ID');
  if (!paymentConfig.alipay.privateKey) missing.push('ALIPAY_PRIVATE_KEY');
  if (!paymentConfig.alipay.gatewayUrl) missing.push('ALIPAY_GATEWAY_URL');
  if (missing.length > 0) {
    const error = new Error(`支付宝支付未配置：${missing.join(', ')}`);
    error.statusCode = 500;
    throw error;
  }
};

const getCatalog = () => ({
  plans: listPaymentPlans(),
  durations: listPaymentDurations()
});

const createAlipayOrder = async ({ userId, planId, durationId } = {}) => {
  const plan = getPaymentPlan(planId);
  const duration = getPaymentDuration(durationId);
  if (!plan || !duration) {
    const error = new Error('支付款项无效');
    error.statusCode = 400;
    throw error;
  }
  ensureAlipayCreateConfig();

  const pool = getPool();
  await repository.ensurePaymentTables(pool);

  const amount = calculateOrderAmount(plan, duration);
  const order = {
    orderNo: createOrderNo(),
    userId,
    planId: plan.id,
    durationId: duration.id,
    amount,
    subject: plan.subject,
    body: duration.label
  };

  await repository.createPaymentOrder(pool, order);

  const formHtml = buildAlipayPagePayForm({
    config: paymentConfig.alipay,
    order
  });

  return {
    orderNo: order.orderNo,
    amount,
    formHtml
  };
};

const handlePaidOrder = async (pool, payload = {}) => {
  await repository.ensurePaymentTables(pool);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const order = await repository.getPaymentOrderByNoForUpdate(connection, payload.orderNo);
    if (!order) {
      const error = new Error('支付订单不存在');
      error.statusCode = 404;
      throw error;
    }

    if (Number(order.amount).toFixed(2) !== Number(payload.totalAmount).toFixed(2)) {
      const error = new Error('支付金额不匹配');
      error.statusCode = 400;
      throw error;
    }

    if (order.status === 'paid') {
      await connection.commit();
      return { status: 'paid', orderNo: order.order_no, alreadyPaid: true };
    }

    const plan = getPaymentPlan(order.plan_id);
    const duration = getPaymentDuration(order.duration_id);
    if (!plan || !duration) {
      const error = new Error('订单套餐配置不存在');
      error.statusCode = 500;
      throw error;
    }

    const paidAt = payload.paidAt || new Date();
    const [markResult] = await repository.markOrderPaid(connection, {
      orderNo: payload.orderNo,
      alipayTradeNo: payload.alipayTradeNo,
      paidAt: toMysqlDateTime(paidAt)
    });
    if (!markResult || markResult.affectedRows !== 1) {
      await connection.commit();
      return { status: 'paid', orderNo: order.order_no, alreadyPaid: true };
    }

    const existingMembership = await repository.getMembershipByUserId(connection, order.user_id);
    const currentExpiry = existingMembership?.expires_at
      ? new Date(existingMembership.expires_at)
      : null;
    const extensionBaseDate = currentExpiry && currentExpiry > paidAt ? currentExpiry : paidAt;
    const startsAt = existingMembership?.starts_at && currentExpiry && currentExpiry > paidAt
      ? new Date(existingMembership.starts_at)
      : paidAt;
    const expiresAt = addMonths(extensionBaseDate, duration.months);
    const membership = {
      userId: order.user_id,
      planId: order.plan_id,
      dailyQuotaUsd: plan.dailyQuotaUsd,
      startsAt: toMysqlDateTime(startsAt),
      expiresAt: toMysqlDateTime(expiresAt),
      orderNo: payload.orderNo
    };

    if (existingMembership) {
      await repository.updateMembership(connection, membership);
    } else {
      await repository.insertMembership(connection, membership);
    }

    await connection.commit();
    return { status: 'paid', orderNo: order.order_no, alreadyPaid: false };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const handleAlipayNotify = async (params = {}) => {
  if (!verifyAlipayNotifyParams(params, paymentConfig.alipay)) {
    const error = new Error('支付宝通知验签失败');
    error.statusCode = 400;
    throw error;
  }

  if (params.app_id !== paymentConfig.alipay.appId) {
    const error = new Error('支付宝 APP_ID 不匹配');
    error.statusCode = 400;
    throw error;
  }

  if (!['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(params.trade_status)) {
    return { status: 'ignored' };
  }

  return handlePaidOrder(getPool(), {
    orderNo: params.out_trade_no,
    alipayTradeNo: params.trade_no,
    totalAmount: params.total_amount,
    paidAt: new Date()
  });
};

module.exports = {
  getCatalog,
  createAlipayOrder,
  handleAlipayNotify,
  handlePaidOrder,
  toMysqlDateTime
};
