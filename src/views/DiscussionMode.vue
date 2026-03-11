<template>
  <div class="discussion-page">
    <header class="discussion-header">
      <div class="header-left">
        <p class="header-kicker">Team Discussion</p>
        <h1 class="header-title">团队讨论模式</h1>
      </div>

      <div class="header-center">
        <label class="field-label">当前游戏</label>
        <select
          v-model="selectedGameId"
          class="game-select"
          :disabled="isBootstrapping || !games.length"
          @change="handleGameSelectChange"
        >
          <option v-for="game in games" :key="game.game_id" :value="game.game_id">
            {{ game.title || game.name || game.game_id }}
          </option>
        </select>
      </div>

      <div class="header-right">
        <div class="status-chip">
          <i class="fa fa-users"></i>
          <span>{{ roomJoinedCount }}/{{ roomMaxMembers }} 人</span>
        </div>
        <div class="status-chip" v-if="activeRoom?.room_code">
          <i class="fa fa-hashtag"></i>
          <span>{{ activeRoom.room_code }}</span>
        </div>
        <button class="soft-btn" @click="reloadAll" :disabled="isBootstrapping">
          <i :class="isBootstrapping ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
          <span>刷新</span>
        </button>
      </div>
    </header>

    <div class="discussion-grid">
      <section class="panel chat-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">房间讨论</p>
            <h3 class="panel-title">
              {{ currentGame?.title || '未选择游戏' }}
            </h3>
          </div>
          <div class="panel-subtle">
            <span>{{ activeRoom?.status || 'waiting' }}</span>
            <span v-if="activeRoom?.mode">· {{ activeRoom.mode }}</span>
          </div>
        </div>

        <div class="chat-thread" ref="chatThreadRef">
          <div
            v-for="message in messages"
            :key="message.id"
            class="chat-message"
            :class="message.sender_type"
          >
            <div class="bubble">
              <div class="bubble-head">
                <strong>{{ messageSenderLabel(message) }}</strong>
                <small>{{ formatTime(message.created_at) }}</small>
              </div>
              <p>{{ message.content }}</p>
            </div>
          </div>
          <div v-if="!messages.length" class="chat-empty">
            <i class="fa fa-comments"></i>
            <p>房间暂无消息，先发一句开始讨论吧。</p>
          </div>
        </div>

        <div class="chat-composer">
          <textarea
            v-model="inputText"
            rows="3"
            class="chat-input"
            placeholder="输入你的讨论内容..."
            :disabled="sendingMessage || !activeRoom"
          ></textarea>
          <div class="composer-actions">
            <button
              class="soft-btn primary"
              :disabled="sendingMessage || !inputText.trim() || !activeRoom"
              @click="sendUserMessage"
            >
              <i :class="sendingMessage ? 'fa fa-spinner fa-spin' : 'fa fa-paper-plane'"></i>
              <span>发送</span>
            </button>
            <button
              class="soft-btn"
              :disabled="askingAi || !inputText.trim() || !activeRoom"
              @click="sendAiMessage"
            >
              <i :class="askingAi ? 'fa fa-spinner fa-spin' : 'fa fa-magic'"></i>
              <span>问 AI</span>
            </button>
          </div>
        </div>
      </section>

      <section class="panel code-panel">
        <div class="panel-header">
          <div>
            <p class="panel-label">游戏代码</p>
            <h3 class="panel-title">当前游戏源码</h3>
          </div>
          <div class="code-tools">
            <input
              v-model="codeSearch"
              type="text"
              class="code-search"
              placeholder="搜索文件..."
            />
            <button class="soft-btn" @click="reloadCodeFiles" :disabled="codeLoading || !selectedGameId">
              <i :class="codeLoading ? 'fa fa-spinner fa-spin' : 'fa fa-rotate-right'"></i>
              <span>源码刷新</span>
            </button>
          </div>
        </div>

        <div class="code-layout">
          <aside class="code-files">
            <button
              v-for="file in filteredFiles"
              :key="file.path"
              class="file-item"
              :class="{ active: selectedFilePath === file.path }"
              @click="selectedFilePath = file.path"
            >
              {{ file.path }}
            </button>
            <div v-if="!filteredFiles.length" class="file-empty">
              暂无可浏览源码
            </div>
          </aside>

          <div class="code-view-wrap">
            <div v-if="codeLoading" class="code-empty">
              <i class="fa fa-spinner fa-spin"></i>
              <p>正在加载源码...</p>
            </div>
            <div v-else-if="selectedFile" class="code-view-block">
              <div class="code-meta">
                <span>{{ selectedFile.path }}</span>
                <button class="soft-btn" @click="copyCode">
                  <i class="fa fa-copy"></i>
                  <span>复制</span>
                </button>
              </div>
              <pre class="code-view"><code class="hljs" v-html="highlightedCode"></code></pre>
            </div>
            <div v-else class="code-empty">
              <i class="fa fa-code"></i>
              <p>选择文件后即可查看代码。</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import json from 'highlight.js/lib/languages/json';
import { useGameStore } from '../stores/game';
import { useNotificationStore } from '../stores/notification';
import { apiCall } from '../utils/api';

hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('css', css);
hljs.registerLanguage('json', json);
hljs.registerLanguage('html', xml);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('vue', xml);

const route = useRoute();
const router = useRouter();
const gameStore = useGameStore();
const notificationStore = useNotificationStore();

const games = ref([]);
const currentGame = ref(null);
const selectedGameId = ref('');

const activeRoom = ref(null);
const messages = ref([]);
const pollingTimer = ref(null);

const codeFiles = ref([]);
const selectedFilePath = ref('');
const codeSearch = ref('');

const inputText = ref('');
const isBootstrapping = ref(false);
const sendingMessage = ref(false);
const askingAi = ref(false);
const codeLoading = ref(false);

const chatThreadRef = ref(null);
const hasAuthToken = () => Boolean(localStorage.getItem('token'));
const buildRoomStorageKey = (gameId) => `discussion_last_room_${gameId}`;
const getSavedRoomId = (gameId) => {
  if (!gameId) return null;
  const raw = localStorage.getItem(buildRoomStorageKey(gameId));
  const parsed = Number.parseInt(raw || '', 10);
  return Number.isNaN(parsed) ? null : parsed;
};
const saveRoomId = (gameId, roomId) => {
  if (!gameId || !roomId) return;
  localStorage.setItem(buildRoomStorageKey(gameId), String(roomId));
};
const clearSavedRoomId = (gameId) => {
  if (!gameId) return;
  localStorage.removeItem(buildRoomStorageKey(gameId));
};

const roomJoinedCount = computed(() => Number(activeRoom.value?.joined_count || 0));
const roomMaxMembers = computed(() => Number(activeRoom.value?.max_members || 4));

const filteredFiles = computed(() => {
  const keyword = codeSearch.value.trim().toLowerCase();
  if (!keyword) return codeFiles.value;
  return codeFiles.value.filter((file) => file.path.toLowerCase().includes(keyword));
});

const selectedFile = computed(
  () => codeFiles.value.find((file) => file.path === selectedFilePath.value) || null
);

const detectLanguage = (path = '') => {
  const ext = path.split('.').pop()?.toLowerCase();
  if (['ts', 'tsx'].includes(ext)) return 'typescript';
  if (['js', 'jsx', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (['vue'].includes(ext)) return 'vue';
  if (['css', 'scss', 'less'].includes(ext)) return 'css';
  if (['html', 'htm'].includes(ext)) return 'html';
  if (['json'].includes(ext)) return 'json';
  return 'text';
};

const highlightedCode = computed(() => {
  if (!selectedFile.value) return '';
  const language = selectedFile.value.language || detectLanguage(selectedFile.value.path);
  const content = selectedFile.value.content || '';
  try {
    return hljs.highlight(content, { language }).value;
  } catch (error) {
    return hljs.highlightAuto(content).value;
  }
});

const normalizeCodeResponse = (payload) => {
  const files = Array.isArray(payload?.files) ? payload.files : [];
  return files.map((file) => ({
    path: file.path || file.name || '',
    language: file.language || detectLanguage(file.path || file.name || ''),
    content: file.content || ''
  }));
};

const formatTime = (timeText) => {
  if (!timeText) return '';
  const date = new Date(timeText);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString();
};

const messageSenderLabel = (message) => {
  if (message.sender_type === 'ai') return 'AI 助手';
  if (message.sender_type === 'system') return '系统';
  return message.username || '用户';
};

const scrollChatToBottom = () => {
  nextTick(() => {
    const el = chatThreadRef.value;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  });
};

const stopPollingMessages = () => {
  if (!pollingTimer.value) return;
  clearInterval(pollingTimer.value);
  pollingTimer.value = null;
};

const startPollingMessages = () => {
  stopPollingMessages();
  pollingTimer.value = setInterval(async () => {
    if (!activeRoom.value?.id) return;
    await fetchMessages(true);
  }, 4000);
};

const fetchGames = async () => {
  if (!gameStore.gamesLoaded) {
    await gameStore.loadGames();
  }
  games.value = gameStore.games || [];
};

const fetchCodeFiles = async () => {
  if (!hasAuthToken()) {
    codeFiles.value = [];
    selectedFilePath.value = '';
    return;
  }

  if (!selectedGameId.value) {
    codeFiles.value = [];
    selectedFilePath.value = '';
    return;
  }
  codeLoading.value = true;
  try {
    const payload = await apiCall(`/games/${selectedGameId.value}/code`);
    codeFiles.value = normalizeCodeResponse(payload);
    if (!codeFiles.value.some((file) => file.path === selectedFilePath.value)) {
      selectedFilePath.value = codeFiles.value[0]?.path || '';
    }
  } catch (error) {
    codeFiles.value = [];
    selectedFilePath.value = '';
    notificationStore.warning('源码加载失败', error.message || '无法读取当前游戏源码');
  } finally {
    codeLoading.value = false;
  }
};

const fetchMessages = async (silent = false) => {
  if (!hasAuthToken()) return;

  if (!activeRoom.value?.id) {
    messages.value = [];
    return;
  }
  try {
    const payload = await apiCall(`/discussion/rooms/${activeRoom.value.id}/messages?limit=150`);
    const nextMessages = Array.isArray(payload?.messages) ? payload.messages : [];
    const hasNew = nextMessages.length > messages.value.length;
    messages.value = nextMessages;
    if (hasNew || !silent) {
      scrollChatToBottom();
    }
  } catch (error) {
    if (!silent) {
      notificationStore.warning('消息加载失败', error.message || '无法读取房间消息');
    }
  }
};

const ensureRoomForCurrentGame = async () => {
  if (!hasAuthToken()) {
    activeRoom.value = null;
    messages.value = [
      {
        id: 'auth-required',
        sender_type: 'system',
        content: '请先登录后加入团队讨论房间。',
        created_at: new Date().toISOString()
      }
    ];
    stopPollingMessages();
    return;
  }

  if (!selectedGameId.value) {
    activeRoom.value = null;
    messages.value = [];
    return;
  }

  try {
    const savedRoomId = getSavedRoomId(selectedGameId.value);
    if (savedRoomId) {
      try {
        const joinedSaved = await apiCall(`/discussion/rooms/${savedRoomId}/join`, { method: 'POST' });
        if (joinedSaved?.room?.id) {
          activeRoom.value = joinedSaved.room;
          saveRoomId(selectedGameId.value, joinedSaved.room.id);
          await fetchMessages();
          startPollingMessages();
          return;
        }
      } catch (savedJoinError) {
        clearSavedRoomId(selectedGameId.value);
      }
    }

    const roomList = await apiCall(`/discussion/games/${selectedGameId.value}/rooms`);
    const candidate = (roomList.rooms || []).find((room) => {
      const joined = Number(room.joined_count || 0);
      const max = Number(room.max_members || 4);
      return joined < max;
    });

    let roomPayload = null;
    if (candidate) {
      const joinedResult = await apiCall(`/discussion/rooms/${candidate.id}/join`, { method: 'POST' });
      roomPayload = joinedResult.room;
    } else {
      const createdResult = await apiCall('/discussion/rooms', {
        method: 'POST',
        body: JSON.stringify({
          gameId: selectedGameId.value,
          mode: 'room',
          visibility: 'public',
          title: `${currentGame.value?.title || selectedGameId.value} 讨论房间`
        })
      });
      roomPayload = createdResult.room;
    }

    activeRoom.value = roomPayload || null;
    if (roomPayload?.id) {
      saveRoomId(selectedGameId.value, roomPayload.id);
    }
    await fetchMessages();
    startPollingMessages();
  } catch (error) {
    activeRoom.value = null;
    messages.value = [];
    stopPollingMessages();
    clearSavedRoomId(selectedGameId.value);
    notificationStore.error('房间初始化失败', error.message || '无法创建或加入讨论房间');
  }
};

const bootstrapGameContext = async (gameId) => {
  if (!gameId) return;
  isBootstrapping.value = true;
  try {
    currentGame.value = gameStore.getGameById(gameId) || await gameStore.loadGameById(gameId);
    await Promise.all([ensureRoomForCurrentGame(), fetchCodeFiles()]);
  } finally {
    isBootstrapping.value = false;
  }
};

const handleGameSelectChange = async () => {
  if (!selectedGameId.value) return;
  if (route.params.id !== selectedGameId.value) {
    await router.replace({ name: 'DiscussionMode', params: { id: selectedGameId.value } });
  }
};

const sendUserMessage = async () => {
  if (!hasAuthToken()) {
    notificationStore.info('请先登录', '登录后才能发送讨论消息');
    return;
  }

  const content = inputText.value.trim();
  if (!content || !activeRoom.value?.id) return;
  sendingMessage.value = true;
  try {
    await apiCall(`/discussion/rooms/${activeRoom.value.id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
    inputText.value = '';
    await fetchMessages();
  } catch (error) {
    notificationStore.error('发送失败', error.message || '消息发送失败');
  } finally {
    sendingMessage.value = false;
  }
};

const sendAiMessage = async () => {
  if (!hasAuthToken()) {
    notificationStore.info('请先登录', '登录后才能调用 AI 讨论助手');
    return;
  }

  const prompt = inputText.value.trim();
  if (!prompt || !activeRoom.value?.id) return;
  askingAi.value = true;
  try {
    await apiCall(`/discussion/rooms/${activeRoom.value.id}/ai-message`, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
    inputText.value = '';
    await fetchMessages();
  } catch (error) {
    notificationStore.error('AI 调用失败', error.message || 'AI 暂时不可用');
  } finally {
    askingAi.value = false;
  }
};

const copyCode = async () => {
  if (!selectedFile.value) return;
  try {
    await navigator.clipboard.writeText(selectedFile.value.content);
    notificationStore.success('复制成功', '代码已复制到剪贴板');
  } catch (error) {
    notificationStore.warning('复制失败', error.message || '请检查浏览器权限');
  }
};

const reloadCodeFiles = async () => {
  await fetchCodeFiles();
};

const reloadAll = async () => {
  if (!selectedGameId.value) return;
  await bootstrapGameContext(selectedGameId.value);
  await Promise.all([fetchMessages(), fetchCodeFiles()]);
};

watch(
  () => route.params.id,
  async (paramId) => {
    const nextId = paramId?.toString() || '';
    if (!nextId && games.value.length) {
      const fallback = games.value[0]?.game_id;
      if (fallback) {
        selectedGameId.value = fallback;
        await router.replace({ name: 'DiscussionMode', params: { id: fallback } });
      }
      return;
    }
    if (!nextId) return;
    selectedGameId.value = nextId;
    await bootstrapGameContext(nextId);
  },
  { immediate: true }
);

onMounted(async () => {
  await fetchGames();
  if (!route.params.id && games.value.length) {
    selectedGameId.value = games.value[0].game_id;
    await router.replace({ name: 'DiscussionMode', params: { id: selectedGameId.value } });
  }
});

onUnmounted(() => {
  stopPollingMessages();
});
</script>

<style scoped>
.discussion-page {
  --navbar-height: 72px;
  height: calc(100vh - var(--navbar-height));
  background: black;
  padding: 1rem 0.75rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  box-sizing: border-box;
}

.discussion-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  gap: 0.8rem;
  align-items: end;
}

.header-kicker {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.72rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.header-title {
  color: #fff;
  font-size: 1.55rem;
  font-weight: 700;
  margin-top: 0.15rem;
}

.header-center {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
}

.game-select {
  width: 100%;
  border-radius: 0.7rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0.55rem 0.75rem;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.42rem 0.72rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.8rem;
  white-space: nowrap;
}

.soft-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 0.45rem 0.85rem;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.86rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.soft-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.16);
}

.soft-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.soft-btn.primary {
  background: #fff;
  color: #111;
  border-color: transparent;
}

.discussion-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.9rem;
}

.panel {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.08);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  gap: 0.7rem;
}

.panel-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
}

.panel-title {
  color: #fff;
  font-size: 1rem;
  font-weight: 700;
  margin-top: 0.2rem;
}

.panel-subtle {
  color: rgba(255, 255, 255, 0.72);
  font-size: 0.82rem;
  white-space: nowrap;
}

.chat-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.9rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}

.chat-message {
  display: flex;
}

.chat-message.user {
  justify-content: flex-end;
}

.chat-message.user .bubble {
  background: rgba(255, 255, 255, 0.95);
  color: #141414;
}

.chat-message.ai .bubble {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(147, 197, 253, 0.35);
}

.chat-message.system .bubble {
  background: rgba(250, 204, 21, 0.14);
  border: 1px solid rgba(253, 224, 71, 0.35);
}

.bubble {
  max-width: 86%;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.13);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  padding: 0.55rem 0.7rem;
}

.bubble-head {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  margin-bottom: 0.25rem;
}

.bubble-head small {
  opacity: 0.75;
  font-size: 0.72rem;
}

.bubble p {
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 0.9rem;
}

.chat-empty {
  margin: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.55);
}

.chat-empty i {
  font-size: 1.2rem;
  margin-bottom: 0.35rem;
}

.chat-composer {
  border-top: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.chat-input {
  width: 100%;
  resize: none;
  border-radius: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  padding: 0.62rem 0.72rem;
  line-height: 1.45;
}

.composer-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.code-tools {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.code-search {
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  padding: 0.45rem 0.7rem;
  min-width: 180px;
}

.code-layout {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(180px, 220px) 1fr;
}

.code-files {
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  overflow-y: auto;
  min-height: 0;
  padding: 0.55rem;
}

.file-item {
  width: 100%;
  text-align: left;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.86);
  border-radius: 0.55rem;
  padding: 0.45rem 0.55rem;
  margin-bottom: 0.3rem;
  border: 1px solid transparent;
  background: transparent;
  transition: all 0.2s ease;
}

.file-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.file-item.active {
  background: rgba(255, 255, 255, 0.18);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}

.file-empty {
  color: rgba(255, 255, 255, 0.58);
  font-size: 0.82rem;
  padding: 0.6rem 0.2rem;
}

.code-view-wrap {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.code-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  padding: 0.55rem 0.7rem;
  color: rgba(255, 255, 255, 0.8);
  font-size: 0.82rem;
}

.code-view-block {
  min-height: 0;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.code-view {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0.8rem;
  overflow: auto;
  color: #f8fafc;
  font-size: 0.83rem;
  line-height: 1.6;
  background: rgba(2, 6, 23, 0.65);
}

.code-empty {
  margin: auto;
  text-align: center;
  color: rgba(255, 255, 255, 0.58);
}

@media (max-width: 1280px) {
  .discussion-header {
    grid-template-columns: 1fr;
    align-items: start;
  }

  .header-right {
    justify-content: flex-start;
    flex-wrap: wrap;
  }
}

@media (max-width: 1024px) {
  .discussion-page {
    --navbar-height: 64px;
    height: calc(100vh - var(--navbar-height));
  }

  .discussion-grid {
    grid-template-columns: 1fr;
  }

  .code-layout {
    grid-template-columns: 1fr;
    grid-template-rows: 170px 1fr;
  }

  .code-files {
    border-right: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  }
}

@media (max-width: 480px) {
  .discussion-page {
    --navbar-height: 56px;
  }

  .code-search {
    min-width: 120px;
    width: 120px;
  }
}
</style>
