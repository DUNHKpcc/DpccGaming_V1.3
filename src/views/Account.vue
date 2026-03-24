<template>
  <div class="account-page">
    <div class="content-wrapper">
      <div class="container mx-auto px-4 pt-5 pb-3 account-container">
        <div
          class="max-w-6xl mx-auto h-full"
          :class="{ 'account-main-guest': !isLoggedIn }"
        >
          <div v-if="!isLoggedIn" class="account-login-shell">
            <section class="glass-card account-login-state">
              <div class="account-login-brand">
                <div class="account-login-logo-wrap">
                  <img src="/logo_light.png" alt="DpccGaming" class="account-login-logo account-login-logo-dark" />
                  <img src="/logo.png" alt="DpccGaming" class="account-login-logo account-login-logo-light" />
                </div>
                <h2 class="text-2xl font-bold text-white">账户中心</h2>
                <p class="text-white/80">登录后可管理头像、查看游戏库、处理好友与通知</p>
              </div>

              <div class="account-login-actions">
                <button
                  @click="openLoginModal"
                  class="account-primary-btn account-login-primary-btn"
                >
                  立即登录
                </button>
                <button
                  @click="openRegisterModal"
                  class="account-login-secondary-btn"
                >
                  注册新账户
                </button>
              </div>

              <div class="account-login-highlights">
                <span>游戏库同步</span>
                <span>好友互动</span>
                <span>通知提醒</span>
              </div>
            </section>
          </div>

          <div v-else class="account-dashboard">
            <div class="left-stack">
              <section class="glass-card widget widget-profile p-6">
                <div class="text-center">
                  <div class="avatar-wrap mx-auto mb-4">
                    <img
                      :src="getAvatarUrl(currentUser?.avatar_url)"
                      alt="用户头像"
                      class="user-avatar-image"
                      @error="handleAvatarError"
                    />
                  </div>
                  <h3 class="text-xl font-bold text-white mb-2 profile-name-row">
                    <span>{{ currentUser.username }}</span>
                    <UserLevelBadge :user-id="currentUser?.id" />
                  </h3>
                  <p class="text-white/80 text-sm mb-4">{{ currentUser.email || '未设置邮箱' }}</p>
                  <input
                    ref="avatarInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onAvatarFileChange"
                  />
                  <input
                    ref="coverInputRef"
                    type="file"
                    accept="image/*"
                    class="hidden"
                    @change="onCoverFileChange"
                  />
                  <button
                    type="button"
                    @click="openAvatarPicker"
                    :disabled="avatarUploading"
                    class="upload-avatar-btn mb-3"
                  >
                    {{ avatarUploading ? '上传中...' : '上传头像' }}
                  </button>
                  <div class="bind-oauth-row mb-3">
                    <button
                      type="button"
                      title="绑定微信"
                      @click="startWechatBind"
                      :disabled="wechatBinding || wechatBound"
                      class="wechat-bind-btn"
                    >
                      <img src="/Ai/WeChat.png" alt="WeChat" class="wechat-bind-logo" />
                    </button>
                    <button
                      type="button"
                      title="绑定 Google"
                      @click="startGoogleBind"
                      :disabled="googleBinding || googleBound"
                      class="google-bind-btn"
                    >
                       <img src="/Ai/Google.png" alt="Google" class="wechat-bind-logo" />
                    </button>
                    <button
                      type="button"
                      title="绑定 GitHub"
                      class="google-bind-btn"
                    >
                      <i class="fa-brands fa-github oauth-font-icon"></i>
                    </button>
                  </div>
                  <p v-if="wechatBoundLabel" class="wechat-bind-hint mb-3">{{ wechatBoundLabel }}</p>
                  <p v-if="googleBoundLabel" class="wechat-bind-hint mb-3">{{ googleBoundLabel }}</p>
                  <button
                    @click="logout"
                    class="account-logout-btn text-sm font-medium">
                    {{ logoutConfirmPending ? '再次点击确认退出' : '退出登录' }}
                  </button>
                </div>
              </section>

              <section class="glass-card widget widget-library p-6">
                <div class="widget-title-row">
                  <h3 class="text-xl font-bold text-white">游戏库</h3>
                  <span class="text-xs text-white/80">{{ libraryGames.length }} 个</span>
                </div>

                <div class="library-scroll">
                  <div v-if="libraryLoading" class="text-sm text-white/80 py-3">加载中...</div>
                  <div v-else-if="!libraryGames.length" class="text-sm text-white/80 py-3">库里还没有游戏</div>
                  <div v-else class="space-y-2">
                    <div
                      v-for="game in libraryGames"
                      :key="`library-${game.game_id || game.id}`"
                      class="library-row"
                      role="button"
                      tabindex="0"
                      @click="openLibraryGame(game)"
                      @keyup.enter="openLibraryGame(game)"
                      @keyup.space.prevent="openLibraryGame(game)"
                    >
                      <div class="recent-game-media">
                        <video
                          v-if="hasPlayableVideo(game)"
                          :src="getGameVideoUrl(game)"
                          :poster="getGameCoverUrl(game) || '/GameImg.jpg'"
                          class="recent-game-media-el"
                          autoplay
                          muted
                          loop
                          playsinline
                          preload="metadata"
                        ></video>
                        <img
                          v-else-if="getGameCoverUrl(game)"
                          :src="getGameCoverUrl(game)"
                          :alt="game.title"
                          class="recent-game-media-el"
                        />
                        <div v-else class="recent-game-media-fallback">
                          <i class="fa fa-laptop account-icon-glyph"></i>
                        </div>
                      </div>
                      <div class="library-meta">
                        <strong>{{ game.title }}</strong>
                        <small>{{ categoryToZh(game.category || 'action') }} · {{ game.play_count || 0 }} 次</small>
                      </div>
                      <span class="library-time">{{ formatSavedDate(game.saved_at) }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section class="glass-card widget widget-notifications p-0">
              <NotificationsSection compact />
            </section>

            <div class="middle-panels">
              <section class="glass-card widget widget-friends p-6">
                <div class="widget-title-row">
                  <h3 class="text-xl font-bold text-white">好友</h3>
                  <div class="friend-widget-actions">
                    <span class="text-xs text-white/80">{{ friends.length }} 人</span>
                    <button
                      type="button"
                      class="friend-add-open-btn secondary"
                      @click="openGroupModal"
                    >
                      <i class="fa fa-users"></i>
                      <span>拉群</span>
                    </button>
                    <button
                      type="button"
                      class="friend-add-open-btn"
                      @click="openFriendModal"
                    >
                      <i class="fa fa-user-plus"></i>
                      <span>添加好友</span>
                    </button>
                  </div>
                </div>

                <div class="friends-scroll">
                  <div v-if="friendsLoading" class="text-sm text-white/80 py-3">加载中...</div>
                  <div v-else-if="!friends.length" class="text-sm text-white/80 py-3">暂无好友</div>
                  <div v-else class="friends-grid">
                    <div
                      v-for="friend in friends"
                      :key="friend.id"
                      class="friend-row"
                      :class="{ 'is-opening': isOpeningFriendChat(friend.id) }"
                      role="button"
                      tabindex="0"
                      @click="openFriendDiscussion(friend)"
                      @keyup.enter="openFriendDiscussion(friend)"
                      @keyup.space.prevent="openFriendDiscussion(friend)"
                    >
                      <img
                        v-if="friend.avatar_url"
                        :src="getAvatarUrl(friend.avatar_url)"
                        :alt="friend.username"
                        class="friend-avatar-img"
                        @error="handleAvatarError"
                      />
                      <div v-else class="friend-avatar">
                        {{ (friend.username || '?').charAt(0).toUpperCase() }}
                      </div>
                      <div class="friend-meta">
                        <div class="username-level-row">
                          <strong>{{ friend.username }}</strong>
                          <UserLevelBadge :user-id="friend.id" />
                        </div>
                        <small>{{ friend.email || '未设置邮箱' }}</small>
                      </div>
                      <div class="friend-chat-indicator" :title="isOpeningFriendChat(friend.id) ? '正在打开协作聊天' : '进入协作聊天'">
                        <i class="fa" :class="isOpeningFriendChat(friend.id) ? 'fa-spinner fa-spin' : 'fa-comments'"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <section class="glass-card widget widget-player-data p-0">
              <PlayerDataPanel
                :user="currentUser"
                :games="gameStore.games"
                :library-games="libraryGames"
                :cover-uploading="coverUploading"
                :profile-saving="profileSaving"
                @request-cover-upload="openCoverPicker"
                @auto-save-profile="onPlayerProfileAutoSave"
              />
            </section>

            <div
              v-if="friendModalVisible"
              class="friend-modal-mask"
              @click.self="closeFriendModal"
            >
              <div class="friend-modal">
                <div class="friend-modal-header">
                  <h3>添加好友</h3>
                  <button type="button" class="friend-modal-close" @click="closeFriendModal">
                    <i class="fa fa-times"></i>
                  </button>
                </div>

                <div class="friend-modal-body">
                  <section class="friend-modal-section">
                    <div class="friend-modal-title-row">
                      <h4>搜索用户名</h4>
                    </div>
                    <div class="friend-search-row">
                      <input
                        v-model.trim="friendSearchKeyword"
                        type="text"
                        placeholder="输入用户名"
                        @keyup.enter="searchFriendUsers"
                      />
                      <button
                        type="button"
                        class="friend-primary-btn"
                        :disabled="friendSearching"
                        @click="searchFriendUsers"
                      >
                        {{ friendSearching ? '搜索中...' : '搜索' }}
                      </button>
                    </div>

                    <div v-if="friendSearchResults.length" class="friend-search-results">
                      <div
                        v-for="user in friendSearchResults"
                        :key="`friend-search-${user.id}`"
                        class="friend-result-row"
                      >
                        <div class="friend-result-user">
                          <img
                            v-if="user.avatar_url"
                            :src="getAvatarUrl(user.avatar_url)"
                            :alt="user.username"
                            class="friend-avatar-img"
                            @error="handleAvatarError"
                          />
                          <div v-else class="friend-avatar">
                            {{ (user.username || '?').charAt(0).toUpperCase() }}
                          </div>
                          <div class="friend-meta">
                            <div class="username-level-row">
                              <strong>{{ user.username }}</strong>
                              <UserLevelBadge :user-id="user.id" />
                            </div>
                            <small>{{ user.email || '未设置邮箱' }}</small>
                          </div>
                        </div>
                        <div class="friend-result-actions">
                          <button
                            v-if="user.friend_status === 'none'"
                            type="button"
                            class="friend-primary-btn small"
                            :disabled="friendActionLoading[user.id]"
                            @click="sendFriendRequestByUser(user)"
                          >
                            {{ friendActionLoading[user.id] ? '发送中...' : '添加' }}
                          </button>
                          <button
                            v-else-if="user.friend_status === 'incoming_pending' && user.incoming_request_id"
                            type="button"
                            class="friend-primary-btn small"
                            :disabled="friendActionLoading[user.id]"
                            @click="respondFriendRequest(user.incoming_request_id, 'accept')"
                          >
                            同意
                          </button>
                          <span v-else-if="user.friend_status === 'accepted'" class="friend-state-text">已是好友</span>
                          <span v-else-if="user.friend_status === 'outgoing_pending'" class="friend-state-text">已发送</span>
                          <span v-else class="friend-state-text">不可添加</span>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section class="friend-modal-section">
                    <div class="friend-modal-title-row">
                      <h4>邀请链接</h4>
                    </div>
                    <div class="friend-invite-generate">
                      <select v-model.number="inviteExpireMinutes">
                        <option :value="30">30 分钟</option>
                        <option :value="60">1 小时</option>
                        <option :value="360">6 小时</option>
                        <option :value="1440">24 小时</option>
                      </select>
                      <button
                        type="button"
                        class="friend-primary-btn"
                        :disabled="inviteGenerating"
                        @click="generateFriendInvite"
                      >
                        {{ inviteGenerating ? '生成中...' : '生成链接' }}
                      </button>
                    </div>
                    <div v-if="generatedInviteLink" class="friend-invite-output">
                      <input :value="generatedInviteLink" type="text" readonly />
                      <button type="button" class="friend-primary-btn" @click="copyInviteLink">复制</button>
                    </div>

                    <div class="friend-redeem-row">
                      <input
                        v-model.trim="inviteCodeInput"
                        type="text"
                        placeholder="输入邀请码或邀请链接"
                        @keyup.enter="redeemFriendInvite"
                      />
                      <button
                        type="button"
                        class="friend-primary-btn"
                        :disabled="inviteRedeeming"
                        @click="redeemFriendInvite"
                      >
                        {{ inviteRedeeming ? '处理中...' : '加入好友' }}
                      </button>
                    </div>
                  </section>

                  <section class="friend-modal-section">
                    <div class="friend-modal-title-row">
                      <h4>待处理申请</h4>
                    </div>
                    <div v-if="friendRequestsLoading" class="friend-muted-text">加载中...</div>
                    <div v-else-if="!incomingRequests.length" class="friend-muted-text">暂无待处理申请</div>
                    <div v-else class="friend-request-list">
                      <div
                        v-for="request in incomingRequests"
                        :key="`incoming-${request.id}`"
                        class="friend-request-row"
                      >
                        <div class="friend-result-user">
                          <img
                            v-if="request.requester_avatar_url"
                            :src="getAvatarUrl(request.requester_avatar_url)"
                            :alt="request.requester_name"
                            class="friend-avatar-img"
                            @error="handleAvatarError"
                          />
                          <div v-else class="friend-avatar">
                            {{ (request.requester_name || '?').charAt(0).toUpperCase() }}
                          </div>
                          <div class="friend-meta">
                            <div class="username-level-row">
                              <strong>{{ request.requester_name }}</strong>
                              <UserLevelBadge :user-id="request.requester_id" />
                            </div>
                            <small>{{ formatSavedDate(request.created_at) }}</small>
                          </div>
                        </div>
                        <div class="friend-request-actions">
                          <button type="button" class="friend-primary-btn small" @click="respondFriendRequest(request.id, 'accept')">同意</button>
                          <button type="button" class="friend-secondary-btn small" @click="respondFriendRequest(request.id, 'reject')">拒绝</button>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>

            <div
              v-if="groupModalVisible"
              class="friend-modal-mask"
              @click.self="closeGroupModal"
            >
              <div class="friend-modal group-modal">
                <div class="friend-modal-header">
                  <h3>创建多人群聊</h3>
                  <button type="button" class="friend-modal-close" @click="closeGroupModal">
                    <i class="fa fa-times"></i>
                  </button>
                </div>

                <div class="friend-modal-body group-modal-body">
                  <section class="friend-modal-section">
                    <div class="friend-modal-title-row">
                      <h4>群聊信息</h4>
                      <span class="friend-muted-text">{{ selectedGroupFriendIds.length + 1 }} / 4 人</span>
                    </div>
                    <div class="group-modal-field">
                      <span>群聊名称</span>
                      <input
                        v-model.trim="groupTitle"
                        type="text"
                        maxlength="40"
                        placeholder="可选，留空会自动生成"
                      />
                    </div>
                    <div class="friend-muted-text">
                      创建后会自动把已选好友加入群聊，并跳转到 discussion 页面。
                    </div>
                    <div class="group-modal-actions">
                      <button
                        type="button"
                        class="friend-secondary-btn"
                        @click="closeGroupModal"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        class="friend-primary-btn"
                        :disabled="groupCreating || !selectedGroupFriendIds.length"
                        @click="createGroupDiscussion"
                      >
                        {{ groupCreating ? '创建中...' : '立即拉群' }}
                      </button>
                    </div>
                  </section>

                  <section class="friend-modal-section">
                    <div class="friend-modal-title-row">
                      <h4>选择好友</h4>
                      <span class="friend-muted-text">可多选</span>
                    </div>
                    <div v-if="friendsLoading" class="friend-muted-text">好友列表加载中...</div>
                    <div v-else-if="!friends.length" class="friend-muted-text">暂无好友，先添加好友后再拉群</div>
                    <div v-else class="group-friend-picker-list">
                      <label
                        v-for="friend in friends"
                        :key="`group-friend-${friend.id}`"
                        class="group-friend-picker-item"
                        :class="{ active: selectedGroupFriendIds.includes(friend.id) }"
                      >
                        <input
                          type="checkbox"
                          :checked="selectedGroupFriendIds.includes(friend.id)"
                          @change="toggleGroupFriend(friend.id)"
                        />
                        <img
                          v-if="friend.avatar_url"
                          :src="getAvatarUrl(friend.avatar_url)"
                          :alt="friend.username"
                          class="friend-avatar-img"
                          @error="handleAvatarError"
                        />
                        <div v-else class="friend-avatar">
                          {{ (friend.username || '?').charAt(0).toUpperCase() }}
                        </div>
                        <div class="friend-meta">
                          <div class="username-level-row">
                            <strong>{{ friend.username }}</strong>
                            <UserLevelBadge :user-id="friend.id" />
                          </div>
                          <small>{{ friend.email || '未设置邮箱' }}</small>
                        </div>
                      </label>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useGameStore } from '../stores/game'
import { useModalStore } from '../stores/modal'
import { useNotificationStore } from '../stores/notification'
import NotificationsSection from '../components/NotificationsSection.vue'
import PlayerDataPanel from '../components/PlayerDataPanel.vue'
import UserLevelBadge from '../components/UserLevelBadge.vue'
import { categoryToZh } from '../utils/category'
import { getAvatarUrl, handleAvatarError } from '../utils/avatar'
import { API_BASE_URL, apiCall } from '../utils/api'
import { resolveMediaUrl } from '../utils/media'

const authStore = useAuthStore()
const gameStore = useGameStore()
const modalStore = useModalStore()
const notificationStore = useNotificationStore()
const route = useRoute()
const router = useRouter()

const currentUser = computed(() => authStore.currentUser)
const isLoggedIn = computed(() => authStore.isLoggedIn)

const libraryGames = ref([])
const libraryLoading = ref(false)
const friends = ref([])
const friendsLoading = ref(false)
const avatarInputRef = ref(null)
const coverInputRef = ref(null)
const avatarUploading = ref(false)
const coverUploading = ref(false)
const profileSaving = ref(false)
const wechatBinding = ref(false)
const wechatBound = ref(false)
const wechatBoundLabel = ref('')
const googleBinding = ref(false)
const googleBound = ref(false)
const googleBoundLabel = ref('')
const friendModalVisible = ref(false)
const groupModalVisible = ref(false)
const groupTitle = ref('')
const selectedGroupFriendIds = ref([])
const friendSearchKeyword = ref('')
const friendSearching = ref(false)
const friendSearchResults = ref([])
const friendActionLoading = ref({})
const inviteExpireMinutes = ref(60)
const inviteGenerating = ref(false)
const generatedInviteLink = ref('')
const inviteCodeInput = ref('')
const inviteRedeeming = ref(false)
const friendRequestsLoading = ref(false)
const incomingRequests = ref([])
const outgoingRequests = ref([])
const friendChatOpening = ref({})
const groupCreating = ref(false)
const logoutConfirmPending = ref(false)
const logoutConfirmTimer = ref(null)
const profileDraftState = ref({
  bio: '',
  preferred_language: '',
  preferred_engine: ''
})
const profilePendingPayload = ref(null)
const LOGOUT_CONFIRM_WINDOW_MS = 4500

const loadPlayerGames = async () => {
  if (!isLoggedIn.value) {
    return
  }

  try {
    await gameStore.loadGames()
  } catch (error) {
    console.error('加载用户游戏失败:', error)
  }
}

const loadFriends = async () => {
  if (!isLoggedIn.value) {
    friends.value = []
    return
  }

  friendsLoading.value = true
  try {
    const data = await apiCall('/discussion/friends')
    friends.value = Array.isArray(data?.friends) ? data.friends : []
  } catch (error) {
    console.error('加载好友失败:', error)
    friends.value = []
  } finally {
    friendsLoading.value = false
  }
}

const loadFriendRequests = async () => {
  if (!isLoggedIn.value) {
    incomingRequests.value = []
    outgoingRequests.value = []
    return
  }

  friendRequestsLoading.value = true
  try {
    const data = await apiCall('/discussion/friends/requests')
    incomingRequests.value = Array.isArray(data?.incoming) ? data.incoming : []
    outgoingRequests.value = Array.isArray(data?.outgoing) ? data.outgoing : []
  } catch (error) {
    console.error('加载好友申请失败:', error)
    incomingRequests.value = []
    outgoingRequests.value = []
  } finally {
    friendRequestsLoading.value = false
  }
}

const refreshFriendData = async () => {
  await Promise.all([
    loadFriends(),
    loadFriendRequests()
  ])
}

const loadLibraryGames = async () => {
  if (!isLoggedIn.value) {
    libraryGames.value = []
    return
  }

  libraryLoading.value = true
  try {
    const data = await apiCall('/games/library/mine')
    libraryGames.value = Array.isArray(data?.games) ? data.games : []
  } catch (error) {
    console.error('加载游戏库失败:', error)
    libraryGames.value = []
  } finally {
    libraryLoading.value = false
  }
}

const loadWechatBindStatus = async () => {
  if (!isLoggedIn.value) {
    wechatBound.value = false
    wechatBoundLabel.value = ''
    return
  }

  try {
    const data = await apiCall('/auth/wechat/bind-status')
    wechatBound.value = Boolean(data?.bound)
    const nickname = String(data?.account?.provider_username || '').trim()
    const maskedId = String(data?.account?.provider_user_id_masked || '').trim()
    wechatBoundLabel.value = wechatBound.value
      ? (nickname ? `已绑定：${nickname}` : (maskedId ? `已绑定：${maskedId}` : '当前账号已绑定微信'))
      : ''
  } catch (error) {
    console.error('加载微信绑定状态失败:', error)
    wechatBound.value = false
    wechatBoundLabel.value = ''
  }
}

const loadGoogleBindStatus = async () => {
  if (!isLoggedIn.value) {
    googleBound.value = false
    googleBoundLabel.value = ''
    return
  }

  try {
    const data = await apiCall('/auth/google/bind-status')
    googleBound.value = Boolean(data?.bound)
    const nickname = String(data?.account?.provider_username || '').trim()
    const email = String(data?.account?.email || '').trim()
    const maskedId = String(data?.account?.provider_user_id_masked || '').trim()
    googleBoundLabel.value = googleBound.value
      ? (nickname ? `Google 已绑定：${nickname}` : (email || maskedId ? `Google 已绑定：${email || maskedId}` : '当前账号已绑定 Google'))
      : ''
  } catch (error) {
    console.error('加载 Google 绑定状态失败:', error)
    googleBound.value = false
    googleBoundLabel.value = ''
  }
}

const openLoginModal = () => {
  modalStore.openModal('login')
}

const openRegisterModal = () => {
  modalStore.openModal('register')
}

const startWechatBind = async () => {
  if (!isLoggedIn.value) {
    openLoginModal()
    return
  }

  if (wechatBound.value) {
    notificationStore.info('已绑定微信', '当前账号已绑定微信，无需重复操作')
    return
  }

  wechatBinding.value = true
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const bindUrl = new URL(`${API_BASE_URL}/auth/wechat/bind/start`, window.location.origin)
  bindUrl.searchParams.set('returnTo', currentPath || '/account')
  window.location.href = bindUrl.toString()
}

const startGoogleBind = () => {
  if (!isLoggedIn.value) {
    openLoginModal()
    return
  }

  if (googleBound.value) {
    notificationStore.info('已绑定 Google', '当前账号已绑定 Google，无需重复操作')
    return
  }

  googleBinding.value = true
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`
  const bindUrl = new URL(`${API_BASE_URL}/auth/google/bind/start`, window.location.origin)
  bindUrl.searchParams.set('returnTo', currentPath || '/account')
  window.location.href = bindUrl.toString()
}

const openFriendModal = async () => {
  if (!isLoggedIn.value) {
    openLoginModal()
    return
  }
  friendModalVisible.value = true
  await loadFriendRequests()
}

const closeFriendModal = () => {
  friendModalVisible.value = false
  friendSearchKeyword.value = ''
  friendSearchResults.value = []
}

const openGroupModal = async () => {
  if (!isLoggedIn.value) {
    openLoginModal()
    return
  }
  groupModalVisible.value = true
  if (!friends.value.length) {
    await loadFriends()
  }
}

const closeGroupModal = () => {
  groupModalVisible.value = false
  groupTitle.value = ''
  selectedGroupFriendIds.value = []
}

const toggleGroupFriend = (friendId) => {
  const parsedId = Number.parseInt(friendId, 10)
  if (!parsedId) return
  if (selectedGroupFriendIds.value.includes(parsedId)) {
    selectedGroupFriendIds.value = selectedGroupFriendIds.value.filter((id) => id !== parsedId)
    return
  }
  if (selectedGroupFriendIds.value.length >= 3) {
    notificationStore.warning('人数已满', '当前最多可邀请 3 位好友一起拉群')
    return
  }
  selectedGroupFriendIds.value = [...selectedGroupFriendIds.value, parsedId]
}

const searchFriendUsers = async () => {
  const keyword = friendSearchKeyword.value.trim()
  if (!keyword) {
    friendSearchResults.value = []
    return
  }

  friendSearching.value = true
  try {
    const data = await apiCall(`/discussion/friends/search?q=${encodeURIComponent(keyword)}`)
    friendSearchResults.value = Array.isArray(data?.users) ? data.users : []
  } catch (error) {
    console.error('搜索用户失败:', error)
    friendSearchResults.value = []
    notificationStore.error('搜索失败', error.message || '请稍后重试')
  } finally {
    friendSearching.value = false
  }
}

const sendFriendRequestByUser = async (user) => {
  if (!user?.id) return
  const key = String(user.id)
  friendActionLoading.value[key] = true
  try {
    const data = await apiCall('/discussion/friends/request', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: user.id })
    })
    notificationStore.success('已发送好友申请', data?.message || `已向 ${user.username} 发送申请`)
    await refreshFriendData()
    await searchFriendUsers()
    window.dispatchEvent(new CustomEvent('friends:changed'))
  } catch (error) {
    notificationStore.warning('发送失败', error.message || '请稍后重试')
  } finally {
    friendActionLoading.value[key] = false
  }
}

const respondFriendRequest = async (requestId, action) => {
  const requestKey = Number.parseInt(requestId, 10)
  if (!requestKey) return
  try {
    await apiCall(`/discussion/friends/requests/${requestKey}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action })
    })
    notificationStore.success('处理成功', action === 'accept' ? '已同意好友申请' : '已拒绝好友申请')
    await refreshFriendData()
    await searchFriendUsers()
    window.dispatchEvent(new CustomEvent('friends:changed'))
  } catch (error) {
    notificationStore.error('处理失败', error.message || '请稍后重试')
  }
}

const generateFriendInvite = async () => {
  inviteGenerating.value = true
  try {
    const data = await apiCall('/discussion/friends/invite-links', {
      method: 'POST',
      body: JSON.stringify({ expiresInMinutes: inviteExpireMinutes.value })
    })
    generatedInviteLink.value = data?.invite_link || data?.invite_code || ''
    notificationStore.success('邀请链接已生成', '可复制后发送给好友')
  } catch (error) {
    notificationStore.error('生成失败', error.message || '请稍后重试')
  } finally {
    inviteGenerating.value = false
  }
}

const copyInviteLink = async () => {
  if (!generatedInviteLink.value) return
  try {
    await navigator.clipboard.writeText(generatedInviteLink.value)
    notificationStore.success('复制成功', '邀请链接已复制到剪贴板')
  } catch (error) {
    notificationStore.warning('复制失败', '请手动复制邀请链接')
  }
}

const redeemFriendInvite = async () => {
  const code = inviteCodeInput.value.trim()
  if (!code) {
    notificationStore.warning('请输入邀请码', '可输入完整邀请链接或邀请码')
    return
  }

  inviteRedeeming.value = true
  try {
    const data = await apiCall('/discussion/friends/invite-links/redeem', {
      method: 'POST',
      body: JSON.stringify({ code })
    })
    inviteCodeInput.value = ''
    notificationStore.success('添加成功', data?.message || '已通过邀请链接添加好友')
    await refreshFriendData()
    await searchFriendUsers()
    window.dispatchEvent(new CustomEvent('friends:changed'))
  } catch (error) {
    notificationStore.error('兑换失败', error.message || '请确认链接有效后重试')
  } finally {
    inviteRedeeming.value = false
  }
}

const clearLogoutConfirmState = () => {
  logoutConfirmPending.value = false
  if (logoutConfirmTimer.value) {
    window.clearTimeout(logoutConfirmTimer.value)
    logoutConfirmTimer.value = null
  }
}

const logout = () => {
  if (!logoutConfirmPending.value) {
    logoutConfirmPending.value = true
    if (logoutConfirmTimer.value) {
      window.clearTimeout(logoutConfirmTimer.value)
    }
    logoutConfirmTimer.value = window.setTimeout(() => {
      logoutConfirmPending.value = false
      logoutConfirmTimer.value = null
    }, LOGOUT_CONFIRM_WINDOW_MS)
    notificationStore.warning('确认退出登录', '再次点击“退出登录”将退出当前账号')
    return
  }

  clearLogoutConfirmState()
  authStore.logout()
}

const openAvatarPicker = () => {
  if (avatarUploading.value) return
  avatarInputRef.value?.click()
}

const openCoverPicker = () => {
  if (coverUploading.value) return
  coverInputRef.value?.click()
}

const onAvatarFileChange = async (event) => {
  const file = event.target.files && event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    notificationStore.warning('文件类型不支持', '请上传图片文件')
    event.target.value = ''
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    notificationStore.warning('文件过大', '头像文件大小不能超过 5MB')
    event.target.value = ''
    return
  }

  avatarUploading.value = true
  const result = await authStore.uploadAvatar(file)
  avatarUploading.value = false
  event.target.value = ''

  if (result.success) {
    notificationStore.success('头像已更新', result.message)
  } else {
    notificationStore.error('头像上传失败', result.message)
  }
}

const onCoverFileChange = async (event) => {
  const file = event.target.files && event.target.files[0]
  if (!file) return

  if (!file.type.startsWith('image/')) {
    notificationStore.warning('文件类型不支持', '请上传图片文件')
    event.target.value = ''
    return
  }

  if (file.size > 12 * 1024 * 1024) {
    notificationStore.warning('文件过大', '背景图文件大小不能超过 12MB')
    event.target.value = ''
    return
  }

  coverUploading.value = true
  const result = await authStore.uploadCover(file)
  coverUploading.value = false
  event.target.value = ''

  if (result.success) {
    notificationStore.success('背景图已更新', result.message)
  } else {
    notificationStore.error('背景图上传失败', result.message)
  }
}

const getProfilePayloadFromUser = (user = {}) => {
  const source = user || {}
  return {
    bio: String(source.bio || source.profile_bio || '').trim(),
    preferred_language: String(source.preferred_language || '').trim(),
    preferred_engine: String(source.preferred_engine || '').trim()
  }
}

const isSameProfilePayload = (left = {}, right = {}) => {
  return String(left.bio || '') === String(right.bio || '')
    && String(left.preferred_language || '') === String(right.preferred_language || '')
    && String(left.preferred_engine || '') === String(right.preferred_engine || '')
}

const saveProfileSettings = async (patch = {}, options = {}) => {
  const { silent = true } = options
  const normalizedPatch = {
    bio: patch?.bio !== undefined ? String(patch.bio || '').trim() : undefined,
    preferred_language: patch?.preferred_language !== undefined ? String(patch.preferred_language || '').trim() : undefined,
    preferred_engine: patch?.preferred_engine !== undefined ? String(patch.preferred_engine || '').trim() : undefined
  }

  const basePayload = {
    ...profileDraftState.value
  }
  const nextPayload = {
    ...basePayload,
    ...(normalizedPatch.bio !== undefined ? { bio: normalizedPatch.bio } : {}),
    ...(normalizedPatch.preferred_language !== undefined ? { preferred_language: normalizedPatch.preferred_language } : {}),
    ...(normalizedPatch.preferred_engine !== undefined ? { preferred_engine: normalizedPatch.preferred_engine } : {})
  }

  if (isSameProfilePayload(nextPayload, basePayload)) {
    return { success: true, skipped: true }
  }

  profileDraftState.value = nextPayload

  if (profileSaving.value) {
    profilePendingPayload.value = { ...nextPayload }
    return { success: true, queued: true }
  }

  profileSaving.value = true
  try {
    let payloadToSave = { ...nextPayload }

    while (payloadToSave) {
      const result = await authStore.updateProfile(payloadToSave)
      if (!result.success) {
        profileDraftState.value = getProfilePayloadFromUser(currentUser.value)
        notificationStore.error('资料保存失败', result.message)
        return result
      }

      if (!silent) {
        notificationStore.success('资料已更新', result.message)
      }

      const queuedPayload = profilePendingPayload.value
      profilePendingPayload.value = null
      if (queuedPayload && !isSameProfilePayload(queuedPayload, payloadToSave)) {
        payloadToSave = { ...queuedPayload }
        continue
      }

      return result
    }
  } finally {
    profileSaving.value = false
  }
}

const onPlayerProfileAutoSave = async (patch = {}) => {
  await saveProfileSettings(patch, { silent: true })
}

const VIDEO_EXT_PATTERN = /\.(mp4|webm|ogg|m4v|mov)(\?.*)?$/i

const getGameCoverUrl = (game = {}) => {
  return resolveMediaUrl(game.thumbnail_url || game.thumbnail || '')
}

const getGameVideoUrl = (game = {}) => {
  return resolveMediaUrl(game.video_url || '')
}

const hasPlayableVideo = (game = {}) => {
  const rawUrl = String(game.video_url || '').trim()
  return VIDEO_EXT_PATTERN.test(rawUrl)
}

const formatSavedDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

const openLibraryGame = (game = {}) => {
  const gameId = game.game_id || game.id
  if (!gameId) return

  modalStore.enterFullscreen({
    ...game,
    id: game.id || gameId,
    game_id: gameId,
    launch_url: game.launch_url || game.game_url || ''
  })
}

const isOpeningFriendChat = (friendId) => {
  if (!friendId) return false
  return friendChatOpening.value[String(friendId)] === true
}

const createGroupDiscussion = async () => {
  if (!selectedGroupFriendIds.value.length) {
    notificationStore.warning('请先选择好友', '至少选择 1 位好友后才能创建群聊')
    return
  }

  groupCreating.value = true
  try {
    const data = await apiCall('/discussion/rooms', {
      method: 'POST',
      body: JSON.stringify({
        mode: 'room',
        visibility: 'private',
        title: groupTitle.value.trim(),
        memberIds: selectedGroupFriendIds.value
      })
    })
    const roomId = Number.parseInt(data?.room?.id, 10)
    if (!roomId) {
      throw new Error('未获取到可用群聊房间')
    }
    notificationStore.success('群聊已创建', '已把选中的好友加入新的多人群聊')
    closeGroupModal()
    router.push({ name: 'DiscussionMode', params: { id: String(roomId) } })
  } catch (error) {
    notificationStore.error('创建群聊失败', error.message || '请稍后重试')
  } finally {
    groupCreating.value = false
  }
}

const openFriendDiscussion = async (friend = {}) => {
  const friendId = Number.parseInt(friend?.id, 10)
  if (!friendId || !isLoggedIn.value) return

  const key = String(friendId)
  if (friendChatOpening.value[key]) return

  friendChatOpening.value[key] = true
  try {
    const data = await apiCall(`/discussion/friends/${friendId}/direct-room`, {
      method: 'POST'
    })
    const roomId = Number.parseInt(data?.room?.id, 10)
    if (!roomId) {
      throw new Error('未获取到可用聊天房间')
    }
    router.push({ name: 'DiscussionMode', params: { id: String(roomId) } })
  } catch (error) {
    notificationStore.error('打开协作聊天失败', error.message || '请稍后重试')
  } finally {
    friendChatOpening.value[key] = false
  }
}

onMounted(() => {
  const inviteFromQuery = String(route.query?.friendInvite || '').trim()
  if (inviteFromQuery) {
    inviteCodeInput.value = inviteFromQuery
    if (isLoggedIn.value) {
      friendModalVisible.value = true
    }
  }

  if (isLoggedIn.value) {
    loadPlayerGames()
    loadLibraryGames()
    loadFriends()
    loadFriendRequests()
    loadWechatBindStatus()
    loadGoogleBindStatus()
  }

  window.addEventListener('friends:changed', refreshFriendData)
})

onUnmounted(() => {
  window.removeEventListener('friends:changed', refreshFriendData)
  clearLogoutConfirmState()
})

watch(currentUser, (user) => {
  profileDraftState.value = getProfilePayloadFromUser(user)
}, { immediate: true })

watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn) {
    clearLogoutConfirmState()
    libraryGames.value = []
    libraryLoading.value = false
    closeGroupModal()
    wechatBinding.value = false
    wechatBound.value = false
    wechatBoundLabel.value = ''
    googleBinding.value = false
    googleBound.value = false
    googleBoundLabel.value = ''
    friends.value = []
    friendsLoading.value = false
    coverUploading.value = false
    profileSaving.value = false
    profileDraftState.value = getProfilePayloadFromUser(null)
    profilePendingPayload.value = null
    incomingRequests.value = []
    outgoingRequests.value = []
    friendModalVisible.value = false
    return
  }

  loadPlayerGames()
  loadLibraryGames()
  loadWechatBindStatus()
  loadGoogleBindStatus()
  loadFriends()
  loadFriendRequests()
  if (inviteCodeInput.value) {
    friendModalVisible.value = true
  }
})
</script>

<style scoped src="../styles/account.css"></style>
