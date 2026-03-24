<template>
  <div class="page">
    <section class="left-side">
      <div class="topbar">
        <button class="icon-btn">☰</button>
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" placeholder="Search" />
        </div>
      </div>

      <div class="chat-layout">
        <aside class="chat-list">
          <div
            v-for="item in chats"
            :key="item.id"
            class="chat-item"
            :class="{ active: currentChatId === item.id }"
            @click="currentChatId = item.id"
          >
            <div class="avatar" :style="{ background: item.avatarColor }">
              {{ item.avatar }}
            </div>

            <div class="chat-item-main">
              <div class="chat-item-top">
                <div class="name-row">
                  <span class="name">{{ item.name }}</span>
                  <span v-if="item.verified" class="verified">✔</span>
                </div>
                <span class="time">{{ item.time }}</span>
              </div>

              <div class="chat-item-bottom">
                <p class="preview">{{ item.preview }}</p>
                <span v-if="item.unread > 0" class="unread">{{ item.unread }}</span>
              </div>
            </div>
          </div>
        </aside>

        <main class="chat-panel">
          <header class="chat-header">
            <div class="chat-user">
              <div class="avatar small" :style="{ background: currentChat.avatarColor }">
                {{ currentChat.avatar }}
              </div>
              <div>
                <div class="chat-user-name">{{ currentChat.name }}</div>
                <div class="chat-user-status">{{ currentChat.status }}</div>
              </div>
            </div>

            <div class="chat-header-actions">
              <button class="icon-btn">🔍</button>
              <button class="icon-btn">📞</button>
              <button class="icon-btn">⋮</button>
            </div>
          </header>

          <section class="chat-messages">
            <div class="day-tag">Today</div>

            <div
              v-for="message in currentChat.messages"
              :key="message.id"
              class="message-row"
              :class="message.from === 'me' ? 'mine' : 'theirs'"
            >
              <div class="message-bubble">
                <div class="message-text">{{ message.text }}</div>
                <div class="message-meta">
                  <span>{{ message.time }}</span>
                  <span v-if="message.from === 'me'">✓✓</span>
                </div>
              </div>
            </div>
          </section>

          <footer class="chat-input-bar">
            <button class="icon-btn light">😊</button>
            <input v-model="draft" type="text" placeholder="Message" @keyup.enter="sendMessage" />
            <button class="send-btn" @click="sendMessage">➤</button>
          </footer>
        </main>
      </div>
    </section>

    <section class="right-side">
      <div class="code-header">
        <div>
          <h2>Code Preview</h2>
          <p>右半边固定为代码显示区域，适合展示前端代码、接口返回和日志。</p>
        </div>
        <button class="run-btn">Run</button>
      </div>

      <div class="code-toolbar">
        <span class="dot red"></span>
        <span class="dot yellow"></span>
        <span class="dot green"></span>
        <span class="file-name">App.vue</span>
      </div>

      <pre class="code-panel"><code>{{ codeText }}</code></pre>
    </section>
  </div>
</template>

<script>
export default {
  name: 'TelegramLikePage',
  data() {
    return {
      currentChatId: 3,
      draft: '',
      chats: [
        {
          id: 1,
          name: 'Chatgram',
          verified: true,
          time: '19:48',
          preview: 'Chatgram Web was updated.',
          unread: 1,
          avatar: 'C',
          avatarColor: 'linear-gradient(135deg, #8ab4ff, #4d7cff)',
          status: 'last seen 5 mins ago',
          messages: [
            { id: 1, from: 'other', text: 'Chatgram Web was updated.', time: '19:40' },
            { id: 2, from: 'me', text: 'Okay, I will check it later.', time: '19:42' }
          ]
        },
        {
          id: 2,
          name: 'Jessica Drew',
          verified: false,
          time: '18:30',
          preview: 'Ok, see you later',
          unread: 2,
          avatar: 'J',
          avatarColor: 'linear-gradient(135deg, #ffb199, #ff6a88)',
          status: 'online',
          messages: [
            { id: 1, from: 'other', text: 'Ok, see you later.', time: '18:29' },
            { id: 2, from: 'me', text: 'See you.', time: '18:30' }
          ]
        },
        {
          id: 3,
          name: 'David Moore',
          verified: false,
          time: '18:16',
          preview: "You: i don't remember anything 😁",
          unread: 0,
          avatar: 'D',
          avatarColor: 'linear-gradient(135deg, #d6a86c, #8d6a4f)',
          status: 'last seen 5 mins ago',
          messages: [
            {
              id: 1,
              from: 'other',
              text: 'OMG 😲 do you remember what you did last night at the work night out?',
              time: '18:12'
            },
            { id: 2, from: 'me', text: 'no haha', time: '18:16' },
            { id: 3, from: 'me', text: "i don't remember anything 😁", time: '18:16' }
          ]
        },
        {
          id: 4,
          name: 'Greg James',
          verified: false,
          time: '18:02',
          preview: 'I got a job at SpaceX 🎉🚀',
          unread: 0,
          avatar: 'G',
          avatarColor: 'linear-gradient(135deg, #6dd5ed, #2193b0)',
          status: 'typing...',
          messages: [
            { id: 1, from: 'other', text: 'I got a job at SpaceX 🎉🚀', time: '18:02' }
          ]
        },
        {
          id: 5,
          name: 'Office Chat',
          verified: false,
          time: '17:08',
          preview: 'Lewis: All done mate 😆',
          unread: 0,
          avatar: 'O',
          avatarColor: 'linear-gradient(135deg, #a18cd1, #6a82fb)',
          status: '25 members, 6 online',
          messages: [
            { id: 1, from: 'other', text: 'Lewis: All done mate 😆', time: '17:08' }
          ]
        }
      ],
      codeText: `<template>\n  <div class="page">\n    <LeftSide />\n    <RightCodePanel />\n  </div>\n</template>\n\n<script>\nexport default {\n  name: 'TelegramLikePage'\n}\n<\/script>`
    }
  },
  computed: {
    currentChat() {
      return this.chats.find(item => item.id === this.currentChatId) || this.chats[0]
    }
  },
  methods: {
    sendMessage() {
      const value = this.draft.trim()
      if (!value) return

      this.currentChat.messages.push({
        id: Date.now(),
        from: 'me',
        text: value,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })

      this.currentChat.preview = `You: ${value}`
      this.currentChat.time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      this.draft = ''
    }
  }
}
</script>

<style scoped>
* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
}

.page {
  display: flex;
  height: 100vh;
  background: #eef1f5;
  color: #1f2937;
  font-family: Arial, Helvetica, sans-serif;
}

.left-side {
  width: 50%;
  min-width: 760px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #dbe2ea;
  background: #ffffff;
}

.right-side {
  width: 50%;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  color: #e2e8f0;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid #e8edf3;
}

.search-box {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 44px;
  padding: 0 14px;
  border-radius: 24px;
  background: #f2f5f8;
}

.search-box input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
}

.chat-layout {
  display: flex;
  flex: 1;
  min-height: 0;
}

.chat-list {
  width: 33.3333%;
  min-width: 290px;
  border-right: 1px solid #e8edf3;
  overflow-y: auto;
  background: #ffffff;
}

.chat-panel {
  width: 66.6667%;
  display: flex;
  flex-direction: column;
  background:
    linear-gradient(rgba(130, 170, 230, 0.92), rgba(130, 170, 230, 0.92)),
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.18) 1px, transparent 1px);
  background-size: auto, 28px 28px;
}

.chat-item {
  display: flex;
  gap: 12px;
  padding: 16px 14px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: 1px solid #f2f4f7;
}

.chat-item:hover {
  background: #f7f9fc;
}

.chat-item.active {
  background: #edf2f8;
}

.avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  font-size: 22px;
  flex-shrink: 0;
}

.avatar.small {
  width: 42px;
  height: 42px;
  font-size: 18px;
}

.chat-item-main {
  flex: 1;
  min-width: 0;
}

.chat-item-top,
.chat-item-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.chat-item-top {
  margin-bottom: 6px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.name {
  font-size: 18px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verified {
  color: #2a8cff;
  font-size: 13px;
}

.time {
  font-size: 13px;
  color: #7b8794;
  white-space: nowrap;
}

.preview {
  margin: 0;
  color: #6b7280;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread {
  min-width: 22px;
  height: 22px;
  padding: 0 6px;
  border-radius: 999px;
  background: #63d471;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.chat-header {
  height: 74px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: rgba(255, 255, 255, 0.96);
  border-bottom: 1px solid rgba(219, 226, 234, 0.9);
}

.chat-user {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-user-name {
  font-size: 20px;
  font-weight: 700;
}

.chat-user-status {
  font-size: 13px;
  color: #6b7280;
  margin-top: 3px;
}

.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 22px 24px;
}

.day-tag {
  width: fit-content;
  margin: 0 auto 18px;
  padding: 8px 14px;
  border-radius: 16px;
  background: rgba(88, 109, 140, 0.55);
  color: #ffffff;
  font-size: 14px;
}

.message-row {
  display: flex;
  margin-bottom: 14px;
}

.message-row.theirs {
  justify-content: flex-start;
}

.message-row.mine {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 72%;
  padding: 12px 14px 8px;
  border-radius: 18px;
  box-shadow: 0 8px 20px rgba(31, 41, 55, 0.08);
}

.message-row.theirs .message-bubble {
  background: #ffffff;
  border-top-left-radius: 6px;
}

.message-row.mine .message-bubble {
  background: #93f26f;
  border-top-right-radius: 6px;
}

.message-text {
  font-size: 16px;
  line-height: 1.45;
  color: #111827;
  word-break: break-word;
}

.message-meta {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: #4b5563;
}

.chat-input-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px 18px;
}

.chat-input-bar input {
  flex: 1;
  height: 50px;
  border: none;
  outline: none;
  border-radius: 26px;
  padding: 0 18px;
  font-size: 16px;
  background: #ffffff;
  box-shadow: 0 6px 18px rgba(31, 41, 55, 0.08);
}

.icon-btn,
.send-btn,
.run-btn {
  border: none;
  cursor: pointer;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: transparent;
  font-size: 18px;
}

.icon-btn.light {
  background: rgba(255, 255, 255, 0.9);
}

.send-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #6f98d8;
  color: #ffffff;
  font-size: 20px;
  box-shadow: 0 8px 18px rgba(60, 100, 180, 0.28);
}

.code-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.code-header h2 {
  margin: 0 0 6px;
  font-size: 24px;
}

.code-header p {
  margin: 0;
  color: #94a3b8;
  font-size: 14px;
}

.run-btn {
  height: 40px;
  padding: 0 18px;
  border-radius: 10px;
  background: #2563eb;
  color: #ffffff;
  font-size: 14px;
}

.code-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 24px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

.dot.red {
  background: #ef4444;
}

.dot.yellow {
  background: #f59e0b;
}

.dot.green {
  background: #22c55e;
}

.file-name {
  margin-left: 8px;
  font-size: 13px;
  color: #cbd5e1;
}

.code-panel {
  flex: 1;
  margin: 0;
  padding: 24px;
  overflow: auto;
  font-size: 14px;
  line-height: 1.6;
  font-family: Consolas, Monaco, monospace;
  white-space: pre-wrap;
}

@media (max-width: 1400px) {
  .page {
    flex-direction: column;
    height: auto;
    min-height: 100vh;
  }

  .left-side,
  .right-side {
    width: 100%;
    min-width: 0;
  }

  .left-side {
    min-height: 70vh;
  }

  .right-side {
    min-height: 40vh;
  }
}

@media (max-width: 900px) {
  .chat-layout {
    flex-direction: column;
  }

  .chat-list,
  .chat-panel {
    width: 100%;
    min-width: 0;
  }

  .chat-list {
    max-height: 320px;
  }

  .chat-panel {
    min-height: 520px;
  }

  .message-bubble {
    max-width: 86%;
  }
}
</style>
