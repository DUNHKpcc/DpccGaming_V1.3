<template>
  <section class="payment-page">
    <div class="payment-shell">
      <header class="payment-header">
        <div class="payment-brand">
          <img src="/favicon.png" alt="DPCC API" class="payment-logo" />
          <div>
            <h1>DPCC API</h1>
            <p class="payment-kicker">月卡充值中心</p>
          </div>
        </div>

        <div class="payment-header-actions">
          <div class="payment-secure-pill">
            <i class="fa-solid fa-lock secure-icon" aria-hidden="true"></i>
            <span class="status-dot"></span>
            HTTPS + 服务端签名
          </div>
        </div>
      </header>

      <main class="payment-workspace">
        <section class="plan-area" aria-labelledby="payment-title">
          <div class="section-heading">
            <div>
              <h2 id="payment-title">选择支付款项</h2>
              <p>金额、到账额度和订单号由服务端创建并签名，前端只负责确认和跳转。</p>
            </div>
            <span class="lock-pill">订单已锁价 05:00</span>
          </div>

          <div class="plan-grid">
            <button
              v-for="plan in plans"
              :key="plan.id"
              type="button"
              class="plan-card"
              :class="{ selected: plan.id === selectedPlanId }"
              :aria-pressed="plan.id === selectedPlanId"
              @click="selectPlan(plan.id)"
            >
              <span v-if="plan.recommended" class="recommend-badge">推荐款项</span>
              <span class="plan-name">{{ plan.name }}</span>
              <strong>{{ plan.priceText }}</strong>
              <span class="daily-quota">{{ plan.dailyQuota }}</span>
              <span class="plan-divider"></span>
              <span class="plan-feature" v-for="feature in plan.features" :key="feature">
                {{ feature }}
              </span>
            </button>
          </div>

          <div class="payment-config">
            <section class="config-panel" aria-labelledby="duration-title">
              <h3 id="duration-title">开通周期</h3>
              <div class="duration-options">
                <button
                  v-for="duration in durations"
                  :key="duration.id"
                  type="button"
                  :class="{ active: duration.id === selectedDurationId }"
                  @click="selectedDurationId = duration.id"
                >
                  {{ duration.label }}
                </button>
              </div>
            </section>

            <section class="config-panel" aria-labelledby="method-title">
              <h3 id="method-title">支付方式</h3>
              <div class="payment-method-icons">
                <button
                  type="button"
                  class="method-tile active"
                  aria-pressed="true"
                  aria-label="支付宝支付"
                  title="支付宝支付"
                >
                  <i class="fa-brands fa-alipay alipay-icon" aria-hidden="true"></i>
                  <span class="method-label">支付宝</span>
                </button>
              </div>
            </section>
          </div>

          <section class="security-flow" aria-labelledby="flow-title">
            <div class="flow-heading">
              <h3 id="flow-title">交易安全链路</h3>
              <span>不可修改金额</span>
            </div>
            <div class="flow-steps">
              <div v-for="step in securitySteps" :key="step.title" class="flow-step">
                <strong>{{ step.title }}</strong>
                <span>{{ step.description }}</span>
              </div>
            </div>
          </section>
        </section>

        <aside class="order-panel" aria-labelledby="order-title">
          <div class="order-head">
            <h2 id="order-title">订单确认</h2>
            <span>已校验</span>
          </div>

          <section class="amount-box">
            <span>支付宝应付金额</span>
            <strong>{{ orderAmountText }}</strong>
            <p>{{ selectedPlan.name }} · {{ selectedDuration.label }} · {{ selectedPlan.dailyQuota }}</p>
          </section>

          <section class="order-details">
            <h3>支付款项</h3>
            <dl>
              <div>
                <dt>商品</dt>
                <dd>{{ selectedPlan.name }}</dd>
              </div>
              <div>
                <dt>周期</dt>
                <dd>{{ selectedDuration.label }}</dd>
              </div>
              <div>
                <dt>订单</dt>
                <dd>{{ orderId }}</dd>
              </div>
              <div>
                <dt>收款方</dt>
                <dd>DPCC API 官方支付宝</dd>
              </div>
            </dl>
          </section>

          <section class="security-checklist">
            <h3>安全检查</h3>
            <p v-for="item in checklist" :key="item">{{ item }}</p>
          </section>

          <button
            type="button"
            class="pay-button"
            :disabled="isCreatingOrder || !selectedPlan.id || !selectedDuration.id"
            @click="redirectToAlipay"
          >
            {{ isCreatingOrder ? '正在创建订单...' : `跳转支付宝支付 ${orderAmountText}` }}
          </button>
          <p v-if="paymentError" class="payment-error">{{ paymentError }}</p>
        </aside>
      </main>
    </div>
  </section>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { apiCall } from '../utils/api'

const planPresentation = {
  bronze: {
    features: ['适合轻量试用', '每日凌晨自动发放', '额度用完后按余额扣费']
  },
  gold: {
    recommended: true,
    features: ['多数用户选择', '支付后自动发放', '订单金额不可被前端改写']
  },
  platinum: {
    features: ['高频调用与团队共享', 'VIP 支付通道', '到账状态实时回写']
  }
}

const formatMoney = (amount) => `¥${Number(amount || 0).toFixed(2)}`
const formatQuota = (quota) => `每日 $${Number(quota || 0).toFixed(0)} 免费额度`

const plans = ref([])
const durations = ref([])
const paymentError = ref('')
const isCreatingOrder = ref(false)
const emptyPlan = { name: '加载中', price: 0, dailyQuota: '正在加载额度' }
const emptyDuration = { label: '加载中', months: 1 }

const securitySteps = [
  { title: '1 创建订单', description: '服务端生成订单号与签名' },
  { title: '2 跳转支付宝', description: '仅提交签名后的支付令牌' },
  { title: '3 到账回写', description: '异步通知校验后发放额度' }
]

const checklist = [
  '已锁定订单金额，前端不可改价',
  '仅跳转官方支付宝收银台',
  '回调验签后才发放额度',
  '请勿通过私聊二维码或转账付款'
]

const selectedPlanId = ref('gold')
const selectedDurationId = ref('1m')

const selectPlan = (planId) => {
  selectedPlanId.value = planId
}

const selectedPlan = computed(() => plans.value.find((plan) => plan.id === selectedPlanId.value) || plans.value[0] || emptyPlan)
const selectedDuration = computed(() => durations.value.find((duration) => duration.id === selectedDurationId.value) || durations.value[0] || emptyDuration)
const orderAmount = computed(() => Number(selectedPlan.value.price || 0) * Number(selectedDuration.value.months || 1))
const orderAmountText = computed(() => formatMoney(orderAmount.value))
const orderId = computed(() => `服务端创建后锁定`)

const loadPaymentCatalog = async () => {
  try {
    const catalog = await apiCall('/payments/catalog', {
      method: 'GET',
      suppressErrorLogging: true
    })
    plans.value = (catalog.plans || []).map((plan) => ({
      ...plan,
      ...planPresentation[plan.id],
      priceText: formatMoney(plan.price),
      dailyQuota: formatQuota(plan.dailyQuotaUsd),
      features: planPresentation[plan.id]?.features || []
    }))
    durations.value = catalog.durations || []
  } catch (error) {
    paymentError.value = error.message || '支付款项加载失败'
  }
}

const submitAlipayForm = (formHtml) => {
  const wrapper = document.createElement('div')
  wrapper.style.display = 'none'
  wrapper.innerHTML = formHtml
  const form = wrapper.querySelector('form')
  if (!form) {
    throw new Error('支付宝支付表单无效')
  }
  document.body.appendChild(wrapper)
  form.submit()
}

const redirectToAlipay = async () => {
  if (isCreatingOrder.value) return
  paymentError.value = ''
  isCreatingOrder.value = true

  try {
    const result = await apiCall('/payments/alipay/orders', {
      method: 'POST',
      body: JSON.stringify({
        planId: selectedPlanId.value,
        durationId: selectedDurationId.value
      })
    })
    submitAlipayForm(result.formHtml)
  } catch (error) {
    paymentError.value = error.message || '创建支付订单失败'
    isCreatingOrder.value = false
  }
}

onMounted(loadPaymentCatalog)
</script>

<style scoped>
.payment-page {
  min-height: calc(100vh - 4rem);
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 4rem 2.5rem 2.5rem;
}

:global([data-theme="light"]) .payment-page {
  --text-primary: #000000;
}

.payment-shell {
  width: min(1280px, 100%);
  margin: 0 auto;
}

.payment-header,
.payment-workspace,
.payment-header-actions,
.payment-brand,
.payment-config,
.section-heading,
.flow-heading,
.order-head,
.payment-method-icons,
.payment-secure-pill {
  display: flex;
}

.payment-header {
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.payment-brand,
.payment-header-actions {
  align-items: center;
}

.payment-brand {
  gap: 0.875rem;
}

.payment-logo {
  width: 3rem;
  height: 3rem;
  border-radius: 0.75rem;
  background: var(--bg-secondary);
  border: 1px solid var(--border-primary);
}

.payment-brand h1,
.payment-kicker,
.section-heading h2,
.config-panel h3,
.security-flow h3,
.order-panel h2,
.order-panel h3 {
  margin: 0;
}

.payment-brand h1 {
  font-size: clamp(1.5rem, 3vw, 2rem);
  font-weight: 900;
  line-height: 1.12;
}

.payment-kicker {
  margin-top: 0.2rem;
  color: var(--text-tertiary);
  font-size: 0.82rem;
  font-weight: 800;
  letter-spacing: 0;
}

.payment-header-actions {
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.payment-secure-pill {
  align-items: center;
  border: 1px solid var(--border-primary);
  background: var(--bg-secondary);
  border-radius: 999px;
}

.payment-secure-pill {
  gap: 0.5rem;
  padding: 0.65rem 0.9rem;
  color: var(--text-secondary);
  font-size: 0.82rem;
  font-weight: 800;
}

.secure-icon {
  color: #4aed33;
  font-size: 0.8rem;
  line-height: 1;
}

.status-dot {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: #4aed33;
}

.duration-options button,
.plan-card,
.method-tile,
.pay-button {
  cursor: pointer;
}

.duration-options button {
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-tertiary);
  font-weight: 800;
}

.duration-options button.active {
  background: var(--text-primary);
  color: var(--bg-primary);
}

.payment-workspace {
  align-items: stretch;
  gap: 1.5rem;
}

.plan-area {
  flex: 1 1 auto;
  min-width: 0;
}

.section-heading {
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.section-heading h2 {
  font-size: clamp(1.8rem, 3vw, 2.35rem);
  line-height: 1.08;
}

.section-heading p {
  color: var(--text-tertiary);
  line-height: 1.55;
}

.section-heading p {
  max-width: 42rem;
  margin: 0.5rem 0 0;
  font-weight: 700;
}

.lock-pill {
  flex: 0 0 auto;
  border: 1px solid var(--border-secondary);
  border-radius: 999px;
  padding: 0.55rem 0.8rem;
  color: var(--text-secondary);
  font-size: 0.78rem;
  font-weight: 800;
}

.plan-grid,
.duration-options,
.flow-steps {
  display: grid;
}

.plan-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-height: 18.25rem;
  padding: 1.875rem 1.5rem 1.5rem;
  border: 1px solid var(--border-primary);
  border-radius: 0.5rem;
  background: var(--bg-secondary);
  color: var(--text-primary);
  text-align: left;
  transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.plan-card.selected {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: var(--bg-primary);
  box-shadow: inset 0 0 0 1px var(--text-primary);
}

.plan-card.selected .daily-quota,
.plan-card.selected .plan-feature {
  color: var(--bg-primary);
}

.plan-card.selected .plan-divider {
  background: var(--bg-primary);
}

.plan-card.selected .recommend-badge {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.recommend-badge {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  max-width: calc(100% - 3rem);
  border-radius: 999px;
  background: var(--text-primary);
  color: var(--bg-primary);
  padding: 0.35rem 0.65rem;
  font-size: 0.72rem;
  font-weight: 900;
  white-space: nowrap;
}

.plan-name {
  min-height: 1.7rem;
  font-size: 1.2rem;
  font-weight: 900;
}

.plan-card strong {
  margin-top: 0.7rem;
  font-size: clamp(2.1rem, 4vw, 2.75rem);
  line-height: 1;
}

.daily-quota {
  margin-top: 0.9rem;
  color: var(--text-secondary);
  font-weight: 900;
}

.plan-divider {
  width: 100%;
  height: 1px;
  margin: 1rem 0;
  background: var(--border-primary);
}

.plan-feature {
  color: var(--text-tertiary);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.65;
}

.payment-config {
  gap: 1rem;
  margin-bottom: 1rem;
}

.config-panel,
.security-flow,
.order-panel {
  border: 1px solid var(--border-primary);
  border-radius: 0.5rem;
  background: var(--bg-secondary);
}

.config-panel {
  flex: 1 1 0;
  padding: 1.125rem;
}

.config-panel h3,
.security-flow h3,
.order-panel h3 {
  font-size: 1rem;
}

.duration-options {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.625rem;
  margin-top: 0.875rem;
}

.duration-options button {
  min-height: 3.4rem;
  border-radius: 0.5rem;
  border: 1px solid var(--border-primary);
  background: var(--bg-tertiary);
  font-size: 0.95rem;
}

.payment-method-icons {
  align-items: center;
  gap: 1.15rem;
  margin-top: 0.875rem;
}

.method-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 7.5rem;
  height: 3.5rem;
  border-radius: 0.375rem;
  border: 1px solid var(--border-primary);
  background: #ffffff;
  padding: 0 0.8rem;
}

.method-tile.active {
  border-color: var(--text-primary);
  box-shadow: inset 0 0 0 1px var(--text-primary);
}

.alipay-icon {
  font-size: 1.9rem;
  line-height: 1;
}

.alipay-icon {
  color: #1677ff;
}

.method-label {
  color: #111111;
  font-size: 0.82rem;
  font-weight: 900;
  line-height: 1;
  white-space: nowrap;
}

:global([data-theme="light"]) .payment-page .method-label {
  color: #000000;
}

.security-flow {
  padding: 1.125rem;
}

.flow-heading,
.order-head {
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.flow-heading span,
.order-head span {
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 900;
}

.flow-steps {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin-top: 0.875rem;
}

.flow-step {
  min-height: 4.6rem;
  border-radius: 0.5rem;
  background: var(--bg-tertiary);
  padding: 0.8rem;
}

.flow-step strong,
.flow-step span {
  display: block;
}

.flow-step span {
  margin-top: 0.35rem;
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 700;
  line-height: 1.45;
}

.order-panel {
  flex: 0 0 24.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem 1.5rem 0.8125rem;
}

.amount-box,
.security-checklist {
  background: var(--bg-tertiary);
  border-radius: 0.5rem;
  padding: 1.125rem;
}

.amount-box {
  border: 1px solid var(--text-primary);
}

.amount-box span,
.order-details dt {
  color: var(--text-tertiary);
}

.amount-box span {
  font-size: 0.8rem;
  font-weight: 900;
}

.amount-box strong {
  display: block;
  margin-top: 0.45rem;
  font-size: 3rem;
  line-height: 1;
}

.amount-box p,
.security-checklist p {
  margin: 0.65rem 0 0;
  color: var(--text-secondary);
  font-weight: 700;
  line-height: 1.5;
}

.order-details {
  border: 1px solid var(--border-primary);
  border-radius: 0.5rem;
  padding: 1rem;
}

.order-details dl {
  display: grid;
  gap: 0.55rem;
  margin: 0.85rem 0 0;
}

.order-details dl > div {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 0.75rem;
}

.order-details dt,
.order-details dd {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.45;
}

.order-details dd {
  color: var(--text-secondary);
  font-weight: 800;
  word-break: break-word;
}

.security-checklist h3 {
  margin-bottom: 0.65rem;
}

.security-checklist p {
  font-size: 0.84rem;
}

.pay-button {
  min-height: 3.65rem;
  border: 0;
  border-radius: 0.5rem;
  background: var(--text-primary);
  color: var(--bg-primary);
  font-size: 1rem;
  font-weight: 900;
}

.pay-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.payment-error {
  margin: -0.35rem 0 0;
  color: #ef4444;
  font-size: 0.82rem;
  font-weight: 800;
  line-height: 1.45;
}

@media (max-width: 1080px) {
  .payment-page {
    padding: 3rem 1.5rem 1.5rem;
  }

  .payment-workspace {
    flex-direction: column;
  }

  .order-panel {
    flex-basis: auto;
  }
}

@media (max-width: 760px) {
  .payment-page {
    padding: 2rem 1rem 1rem;
  }

  .payment-header,
  .section-heading,
  .payment-config {
    align-items: stretch;
    flex-direction: column;
  }

  .payment-header-actions {
    justify-content: flex-start;
  }

  .plan-grid,
  .flow-steps {
    grid-template-columns: 1fr;
  }

  .plan-card {
    min-height: 0;
  }
}
</style>
