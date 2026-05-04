const PAYMENT_PLANS = Object.freeze([
  {
    id: 'bronze',
    name: '青铜月卡',
    price: '29.90',
    dailyQuotaUsd: '5.00',
    subject: 'DPCC API 青铜月卡'
  },
  {
    id: 'gold',
    name: '黄金月卡',
    price: '69.90',
    dailyQuotaUsd: '15.00',
    subject: 'DPCC API 黄金月卡'
  },
  {
    id: 'platinum',
    name: '白金月卡',
    price: '199.90',
    dailyQuotaUsd: '50.00',
    subject: 'DPCC API 白金月卡'
  }
]);

const PAYMENT_DURATIONS = Object.freeze([
  { id: '1m', label: '1个月', months: 1 },
  { id: '3m', label: '3个月', months: 3 },
  { id: '12m', label: '12个月', months: 12 }
]);

const toCents = (amount) => Math.round(Number(amount) * 100);

const fromCents = (cents) => (Number(cents) / 100).toFixed(2);

const getPaymentPlan = (planId = '') => (
  PAYMENT_PLANS.find((plan) => plan.id === String(planId || '').trim()) || null
);

const getPaymentDuration = (durationId = '') => (
  PAYMENT_DURATIONS.find((duration) => duration.id === String(durationId || '').trim()) || null
);

const calculateOrderAmount = (plan, duration) => {
  if (!plan || !duration) return '0.00';
  return fromCents(toCents(plan.price) * duration.months);
};

const listPaymentPlans = () => PAYMENT_PLANS.map((plan) => ({ ...plan }));

const listPaymentDurations = () => PAYMENT_DURATIONS.map((duration) => ({ ...duration }));

module.exports = {
  getPaymentPlan,
  getPaymentDuration,
  calculateOrderAmount,
  listPaymentPlans,
  listPaymentDurations
};
