const {
  parseJsonObject,
  safeText,
  safeLongText
} = require('./core');

const extractMemorySearchTokens = (...parts) => {
  const joined = parts
    .map((item) => safeLongText(item || '', 1000))
    .filter(Boolean)
    .join('\n');
  const matches = joined.match(/[\u4e00-\u9fa5]{2,12}|[a-zA-Z0-9_.-]{2,32}/g) || [];
  return [...new Set(matches.map((item) => item.toLowerCase()))].slice(0, 24);
};

const scoreMemoryContent = (text = '', tokens = []) => {
  if (!text || !tokens.length) return 0;
  const haystack = String(text || '').toLowerCase();
  let score = 0;
  tokens.forEach((token) => {
    if (haystack.includes(token)) score += token.length > 6 ? 3 : 2;
  });
  return score;
};

const normalizeMemoryTitleForDedupe = (title = '') => (
  safeText(title || '', 255)
    .replace(/^(消息源码|源码|消息文档|文档)\//, '')
    .trim()
    .toLowerCase()
);

const buildRoomMemoryDedupeKey = (entry = {}) => {
  const memoryType = safeText(entry.memoryType || '', 32);
  if (!memoryType || memoryType === 'summary' || memoryType === 'profile' || memoryType === 'message' || memoryType === 'note') {
    return `unique:${safeText(entry.sourceKey || entry.id || '', 160)}`;
  }

  if (memoryType === 'document') {
    const sourceDocumentId = Number(entry.sourceDocumentId || 0) || 0;
    if (sourceDocumentId > 0) return `document:id:${sourceDocumentId}`;
    const titleKey = normalizeMemoryTitleForDedupe(entry.title || '');
    if (titleKey) return `document:title:${titleKey}`;
  }

  if (memoryType === 'code') {
    const sourceGameId = safeText(entry.sourceGameId || '', 120);
    const sourcePath = safeText(entry.sourcePath || '', 320).toLowerCase();
    if (sourceGameId && sourcePath) return `code:path:${sourceGameId}:${sourcePath}`;
    const titleKey = normalizeMemoryTitleForDedupe(entry.title || '');
    if (titleKey) return `code:title:${titleKey}`;
  }

  return `unique:${safeText(entry.sourceKey || entry.id || '', 160)}`;
};

const pickPreferredMemoryEntry = (currentEntry = null, nextEntry = null) => {
  if (!currentEntry) return nextEntry;
  if (!nextEntry) return currentEntry;

  const currentHasMessageLink = Number(currentEntry.sourceMessageId || 0) > 0;
  const nextHasMessageLink = Number(nextEntry.sourceMessageId || 0) > 0;
  if (currentHasMessageLink !== nextHasMessageLink) {
    return nextHasMessageLink ? nextEntry : currentEntry;
  }

  const currentUpdatedAt = new Date(currentEntry.updatedAt || currentEntry.createdAt || 0).getTime();
  const nextUpdatedAt = new Date(nextEntry.updatedAt || nextEntry.createdAt || 0).getTime();
  if (currentUpdatedAt !== nextUpdatedAt) {
    return nextUpdatedAt > currentUpdatedAt ? nextEntry : currentEntry;
  }

  const currentContentLength = String(currentEntry.content || '').length;
  const nextContentLength = String(nextEntry.content || '').length;
  if (currentContentLength !== nextContentLength) {
    return nextContentLength > currentContentLength ? nextEntry : currentEntry;
  }

  return (Number(nextEntry.id || 0) || 0) > (Number(currentEntry.id || 0) || 0) ? nextEntry : currentEntry;
};

const dedupeRoomMemoryEntries = (entries = []) => {
  if (!Array.isArray(entries) || !entries.length) return [];
  const dedupedMap = new Map();
  entries.forEach((entry) => {
    const dedupeKey = buildRoomMemoryDedupeKey(entry);
    const existingEntry = dedupedMap.get(dedupeKey);
    dedupedMap.set(dedupeKey, pickPreferredMemoryEntry(existingEntry, entry));
  });

  return [...dedupedMap.values()].sort((left, right) => {
    const typeOrder = ['summary', 'profile', 'document', 'code', 'message', 'note'];
    const leftIndex = Math.max(0, typeOrder.indexOf(String(left.memoryType || '')));
    const rightIndex = Math.max(0, typeOrder.indexOf(String(right.memoryType || '')));
    if (leftIndex !== rightIndex) return leftIndex - rightIndex;

    const leftUpdatedAt = new Date(left.updatedAt || left.createdAt || 0).getTime();
    const rightUpdatedAt = new Date(right.updatedAt || right.createdAt || 0).getTime();
    if (leftUpdatedAt !== rightUpdatedAt) return rightUpdatedAt - leftUpdatedAt;

    return (Number(right.id || 0) || 0) - (Number(left.id || 0) || 0);
  });
};

const createRoomMemoryToolkit = ({
  ensureRoomSummaryTable,
  ensureRoomMemoryTable,
  ensureRoomDocumentsTable,
  getRuntimeRoomSettings,
  loadGameCodeFilesForMemory,
  loadDocumentFullText,
  resolveUploadedFilePath,
  buildAiSenderLabel,
  describeMessageForMemory,
  roomMemoryCodeLimit,
  roomMemoryDocumentLimit,
  roomMemoryContextLimit,
  roomMemoryFileMaxLength
}) => {
  const memoryCodeLimit = Math.max(1, Number(roomMemoryCodeLimit || 0) || 8);
  const memoryDocumentLimit = Math.max(1, Number(roomMemoryDocumentLimit || 0) || 6);
  const memoryContextLimit = Math.max(1, Number(roomMemoryContextLimit || 0) || 4);
  const memoryFileMaxLength = Math.max(512, Number(roomMemoryFileMaxLength || 0) || 6000);

  const buildRoomSummaryText = ({
    room = {},
    members = [],
    settings = {},
    recentMessages = [],
    documents = [],
    codeFiles = []
  }) => {
    const joinedMembers = members
      .filter((item) => item?.status === 'joined')
      .map((item) => safeText(item.username || `用户${item.user_id || ''}`, 40))
      .filter(Boolean);
    const enabledAiNames = (Array.isArray(settings.aiSlots) ? settings.aiSlots : [])
      .filter((slot) => slot?.enabled)
      .map((slot) => safeText(slot.name || slot.builtinModel || slot.customModel || slot.id, 40))
      .filter(Boolean);
    const messageLines = recentMessages.slice(-10).map((message) => `- ${buildAiSenderLabel(message)}：${describeMessageForMemory(message)}`);
    const documentLines = documents.slice(0, memoryDocumentLimit).map((doc) => `- ${safeText(doc.file_name || '', 120)}（上传者：${safeText(doc.uploader_name || '', 40) || '未知'}）`);
    const codeLines = codeFiles.slice(0, memoryCodeLimit).map((file) => `- ${safeText(file.path || '', 180)}`);

    return [
      '# 房间滚动摘要',
      `房间：${safeText(room.title || room.game_title || '未命名房间', 120)}`,
      `游戏：${safeText(room.game_title || settings.sourceGameTitle || '未命名游戏', 120)}`,
      `协作状态：${safeText(settings.collaborationStatus || 'private-chat', 60)}`,
      settings.collaborationNote ? `协作备注：${safeLongText(settings.collaborationNote, 240)}` : '',
      settings.peerRolePreset ? `当前角色预设：${safeText(settings.peerRolePreset, 60)}` : '',
      joinedMembers.length ? `当前成员：${joinedMembers.join('、')}` : '',
      enabledAiNames.length ? `当前 AI：${enabledAiNames.join('、')}` : '',
      '',
      '## 最近对话',
      ...(messageLines.length ? messageLines : ['- 暂无消息']),
      '',
      '## 相关文档',
      ...(documentLines.length ? documentLines : ['- 暂无文档记忆']),
      '',
      '## 相关源码',
      ...(codeLines.length ? codeLines : ['- 暂无源码记忆'])
    ].filter(Boolean).join('\n');
  };

  const upsertRoomMemoryEntry = async (pool, entry = {}) => {
    await ensureRoomMemoryTable(pool);
    await pool.execute(
      `INSERT INTO discussion_room_memory
       (room_id, memory_type, source_key, title, content, metadata_json, source_user_id, source_message_id, source_document_id, source_game_id, source_path)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         memory_type = VALUES(memory_type),
         title = VALUES(title),
         content = VALUES(content),
         metadata_json = VALUES(metadata_json),
         source_user_id = VALUES(source_user_id),
         source_message_id = VALUES(source_message_id),
         source_document_id = VALUES(source_document_id),
         source_game_id = VALUES(source_game_id),
         source_path = VALUES(source_path),
         updated_at = CURRENT_TIMESTAMP`,
      [
        entry.roomId,
        safeText(entry.memoryType || 'note', 32) || 'note',
        safeText(entry.sourceKey || '', 160),
        safeText(entry.title || '未命名记忆', 255) || '未命名记忆',
        safeLongText(entry.content || '', memoryFileMaxLength),
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        Number(entry.sourceUserId || 0) || null,
        Number(entry.sourceMessageId || 0) || null,
        Number(entry.sourceDocumentId || 0) || null,
        safeText(entry.sourceGameId || '', 120) || null,
        safeText(entry.sourcePath || '', 320) || null
      ]
    );
  };

  const mapRoomMemoryRow = (row = {}) => ({
    id: Number(row.id || 0) || null,
    roomId: Number(row.room_id || 0) || null,
    memoryType: safeText(row.memory_type || '', 32),
    sourceKey: safeText(row.source_key || '', 160),
    title: safeText(row.title || '', 255),
    content: safeLongText(row.content || '', memoryFileMaxLength),
    metadata: parseJsonObject(row.metadata_json) || null,
    sourceUserId: Number(row.source_user_id || 0) || null,
    sourceMessageId: Number(row.source_message_id || 0) || null,
    sourceDocumentId: Number(row.source_document_id || 0) || null,
    sourceGameId: safeText(row.source_game_id || '', 120),
    sourcePath: safeText(row.source_path || '', 320),
    updatedAt: row.updated_at || null,
    createdAt: row.created_at || null
  });

  const listRoomMemoryEntries = async (pool, roomId) => {
    await ensureRoomMemoryTable(pool);
    const [rows] = await pool.execute(
      `SELECT id, room_id, memory_type, source_key, title, content, metadata_json,
              source_user_id, source_message_id, source_document_id, source_game_id, source_path,
              created_at, updated_at
       FROM discussion_room_memory
       WHERE room_id = ?
       ORDER BY
         FIELD(memory_type, 'summary', 'profile', 'document', 'code', 'message', 'note'),
         updated_at DESC,
         id DESC`,
      [roomId]
    );
    return dedupeRoomMemoryEntries(rows.map((row) => mapRoomMemoryRow(row)));
  };

  const getRoomSummary = async (pool, roomId) => {
    await ensureRoomSummaryTable(pool);
    const [rows] = await pool.execute(
      `SELECT room_id, summary_text, summary_json, last_message_id, updated_by_user_id, created_at, updated_at
       FROM discussion_room_summary
       WHERE room_id = ?
       LIMIT 1`,
      [roomId]
    );
    const row = rows[0];
    if (!row) return null;
    return {
      roomId: Number(row.room_id || 0) || null,
      summaryText: safeLongText(row.summary_text || '', memoryFileMaxLength),
      summaryMeta: parseJsonObject(row.summary_json) || null,
      lastMessageId: Number(row.last_message_id || 0) || null,
      updatedByUserId: Number(row.updated_by_user_id || 0) || null,
      createdAt: row.created_at || null,
      updatedAt: row.updated_at || null
    };
  };

  const refreshRoomMemoryArtifacts = async (pool, roomId, options = {}) => {
    const parsedRoomId = Number(roomId || 0);
    if (!parsedRoomId) {
      return { summary: null, memory: [] };
    }

    await ensureRoomSummaryTable(pool);
    await ensureRoomMemoryTable(pool);
    await ensureRoomDocumentsTable(pool);

    const [roomRows] = await pool.execute(
      `SELECT r.id, r.title, r.game_id, r.mode, g.title AS game_title
       FROM discussion_rooms r
       JOIN games g ON g.game_id = r.game_id
       WHERE r.id = ?
       LIMIT 1`,
      [parsedRoomId]
    );
    const room = roomRows[0];
    if (!room) {
      return { summary: null, memory: [] };
    }

    const settings = options.settings || await getRuntimeRoomSettings(pool, parsedRoomId);
    const [members] = await pool.execute(
      `SELECT m.user_id, m.status, u.username
       FROM discussion_room_members m
       JOIN users u ON u.id = m.user_id
       WHERE m.room_id = ?
       ORDER BY m.joined_at ASC`,
      [parsedRoomId]
    );
    const [recentMessages] = await pool.execute(
      `SELECT m.id, m.sender_type, m.sender_user_id, m.content, m.metadata_json, m.created_at, u.username
       FROM discussion_messages m
       LEFT JOIN users u ON u.id = m.sender_user_id
       WHERE m.room_id = ?
       ORDER BY m.id DESC
       LIMIT 30`,
      [parsedRoomId]
    );
    const recentMessagesAsc = recentMessages.reverse();
    const [documents] = await pool.execute(
      `SELECT d.id, d.file_name, d.file_url, d.preview_text, d.mime_type, d.page_count, d.uploader_user_id, d.updated_at, u.username AS uploader_name
       FROM discussion_room_documents d
       LEFT JOIN users u ON u.id = d.uploader_user_id
       WHERE d.room_id = ?
       ORDER BY d.updated_at DESC, d.id DESC
       LIMIT ${memoryDocumentLimit}`,
      [parsedRoomId]
    );

    const sourceGameId = safeText(settings.sourceGameId || room.game_id || '', 120) || safeText(room.game_id || '', 120);
    const sourceGameTitle = safeText(settings.sourceGameTitle || room.game_title || '', 255) || safeText(room.game_title || '', 255);
    const codeFiles = await loadGameCodeFilesForMemory(sourceGameId, memoryCodeLimit);
    const latestMessageId = Number(recentMessagesAsc[recentMessagesAsc.length - 1]?.id || 0) || null;
    const summaryText = buildRoomSummaryText({
      room: {
        ...room,
        game_title: sourceGameTitle || room.game_title
      },
      members,
      settings,
      recentMessages: recentMessagesAsc,
      documents,
      codeFiles
    });

    const summaryMeta = {
      memberCount: members.filter((item) => item?.status === 'joined').length,
      documentCount: documents.length,
      codeFileCount: codeFiles.length,
      sourceGameId,
      sourceGameTitle
    };

    await pool.execute(
      `INSERT INTO discussion_room_summary (room_id, summary_text, summary_json, last_message_id, updated_by_user_id)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         summary_text = VALUES(summary_text),
         summary_json = VALUES(summary_json),
         last_message_id = VALUES(last_message_id),
         updated_by_user_id = VALUES(updated_by_user_id),
         updated_at = CURRENT_TIMESTAMP`,
      [parsedRoomId, summaryText, JSON.stringify(summaryMeta), latestMessageId, Number(options.updatedByUserId || 0) || null]
    );

    await pool.execute(
      `DELETE FROM discussion_room_memory
       WHERE room_id = ?
         AND (
         source_key = 'summary:latest'
           OR source_key = 'profile:room'
           OR source_key LIKE 'document:%'
           OR source_key LIKE 'code-file:%'
           OR source_key LIKE 'message-code-preview:%'
           OR source_key LIKE 'message-document-preview:%'
         )`,
      [parsedRoomId]
    );

    await upsertRoomMemoryEntry(pool, {
      roomId: parsedRoomId,
      memoryType: 'summary',
      sourceKey: 'summary:latest',
      title: '房间滚动摘要.md',
      content: summaryText,
      metadata: {
        fileType: 'markdown',
        updatedByUserId: Number(options.updatedByUserId || 0) || null
      }
    });

    await upsertRoomMemoryEntry(pool, {
      roomId: parsedRoomId,
      memoryType: 'profile',
      sourceKey: 'profile:room',
      title: '房间记忆配置.json',
      content: JSON.stringify({
        roomId: parsedRoomId,
        roomTitle: safeText(room.title || room.game_title || '未命名房间', 120),
        gameId: sourceGameId,
        gameTitle: sourceGameTitle,
        collaborationStatus: settings.collaborationStatus || 'private-chat',
        collaborationNote: settings.collaborationNote || '',
        peerRolePreset: settings.peerRolePreset || '',
        members: members
          .filter((item) => item?.status === 'joined')
          .map((item) => ({
            userId: Number(item.user_id || 0) || null,
            username: safeText(item.username || '', 40)
          })),
        aiSlots: (Array.isArray(settings.aiSlots) ? settings.aiSlots : []).map((slot) => ({
          id: slot.id,
          enabled: Boolean(slot.enabled),
          provider: slot.provider,
          model: slot.provider === 'custom' ? slot.customModel : slot.builtinModel,
          name: slot.name,
          context: safeLongText(slot.context || '', 2000),
          memoryEnabled: slot.memoryEnabled !== false
        }))
      }, null, 2),
      metadata: {
        fileType: 'json'
      }
    });

    for (const doc of documents) {
      const documentFullText = await loadDocumentFullText(
        resolveUploadedFilePath(doc.file_url || ''),
        doc.file_name || '',
        doc.mime_type || '',
        doc.preview_text || ''
      );
      await upsertRoomMemoryEntry(pool, {
        roomId: parsedRoomId,
        memoryType: 'document',
        sourceKey: `document:${doc.id}`,
        title: `文档/${safeText(doc.file_name || `document-${doc.id}`, 180)}`,
        content: [
          `文档名称：${safeText(doc.file_name || '', 180)}`,
          `上传者：${safeText(doc.uploader_name || '', 40) || '未知'}`,
          doc.page_count ? `页数：${Number(doc.page_count)}` : '',
          doc.mime_type ? `类型：${safeText(doc.mime_type, 120)}` : '',
          '',
          safeLongText(documentFullText || doc.preview_text || '当前文档暂无可用文本内容。', memoryFileMaxLength - 256)
        ].filter(Boolean).join('\n'),
        metadata: {
          fileType: 'document',
          uploaderName: safeText(doc.uploader_name || '', 40),
          previewText: safeLongText(doc.preview_text || '', 1200)
        },
        sourceUserId: Number(doc.uploader_user_id || 0) || null,
        sourceDocumentId: Number(doc.id || 0) || null
      });
    }

    for (const file of codeFiles) {
      await upsertRoomMemoryEntry(pool, {
        roomId: parsedRoomId,
        memoryType: 'code',
        sourceKey: `code-file:${safeText(file.path || '', 280)}`,
        title: `源码/${safeText(file.path || '', 220)}`,
        content: safeLongText(file.content || '', memoryFileMaxLength),
        metadata: {
          fileType: 'code',
          gameId: sourceGameId,
          gameTitle: sourceGameTitle
        },
        sourceGameId,
        sourcePath: safeText(file.path || '', 320)
      });
    }

    const codeFileMap = new Map(
      codeFiles.map((file) => [safeText(file.path || '', 320), file])
    );
    const documentMap = new Map(
      documents.map((doc) => [Number(doc.id || 0), doc])
    );

    for (const message of recentMessagesAsc) {
      const metadata = parseJsonObject(message.metadata_json) || {};
      const codePreview = metadata.code_preview && typeof metadata.code_preview === 'object' ? metadata.code_preview : null;
      const documentPreview = metadata.document_preview && typeof metadata.document_preview === 'object' ? metadata.document_preview : null;
      const senderName = buildAiSenderLabel(message);

      if (codePreview?.path) {
        const linkedGameId = safeText(codePreview.game_id || sourceGameId || '', 120) || sourceGameId;
        let fileContent = '';
        const resolvedPath = safeText(codePreview.path || '', 320);
        if (linkedGameId === sourceGameId && codeFileMap.has(resolvedPath)) {
          fileContent = safeLongText(codeFileMap.get(resolvedPath)?.content || '', memoryFileMaxLength);
        } else if (linkedGameId) {
          const linkedFiles = await loadGameCodeFilesForMemory(linkedGameId, Math.max(memoryCodeLimit, 24));
          const matchedFile = linkedFiles.find((file) => safeText(file.path || '', 320) === resolvedPath);
          fileContent = safeLongText(matchedFile?.content || '', memoryFileMaxLength);
        }

        await upsertRoomMemoryEntry(pool, {
          roomId: parsedRoomId,
          memoryType: 'code',
          sourceKey: `message-code-preview:${message.id}`,
          title: `消息源码/${safeText(codePreview.path || `message-${message.id}`, 220)}`,
          content: [
            `发送者：${safeText(senderName, 60)}`,
            `消息ID：${Number(message.id || 0) || ''}`,
            `源码路径：${safeText(codePreview.path || '', 220)}`,
            linkedGameId ? `源码游戏：${linkedGameId}` : '',
            '',
            safeLongText(fileContent || codePreview.snippet || '当前源码未找到完整内容，已回退为预览片段。', memoryFileMaxLength - 256)
          ].filter(Boolean).join('\n'),
          metadata: {
            fileType: 'code',
            senderName: safeText(senderName, 60),
            linkedFromMessage: true,
            previewSnippet: safeLongText(codePreview.snippet || '', 1200)
          },
          sourceUserId: Number(message.sender_user_id || 0) || null,
          sourceMessageId: Number(message.id || 0) || null,
          sourceGameId: linkedGameId,
          sourcePath: safeText(codePreview.path || '', 320)
        });
      }

      if (documentPreview?.document_id) {
        const documentId = Number(documentPreview.document_id || 0) || null;
        const linkedDoc = documentId ? documentMap.get(documentId) : null;
        const documentFullText = linkedDoc
          ? await loadDocumentFullText(
            resolveUploadedFilePath(linkedDoc.file_url || ''),
            linkedDoc.file_name || '',
            linkedDoc.mime_type || '',
            linkedDoc.preview_text || documentPreview.preview_text || ''
          )
          : safeLongText(documentPreview.preview_text || '当前文档未找到完整内容，已回退为预览内容。', memoryFileMaxLength);

        await upsertRoomMemoryEntry(pool, {
          roomId: parsedRoomId,
          memoryType: 'document',
          sourceKey: `message-document-preview:${message.id}`,
          title: `消息文档/${safeText(documentPreview.name || `document-${documentId || message.id}`, 220)}`,
          content: [
            `发送者：${safeText(senderName, 60)}`,
            `消息ID：${Number(message.id || 0) || ''}`,
            `文档名称：${safeText(documentPreview.name || '', 220)}`,
            documentId ? `文档ID：${documentId}` : '',
            '',
            safeLongText(documentFullText || documentPreview.preview_text || '当前文档未找到可用内容。', memoryFileMaxLength - 256)
          ].filter(Boolean).join('\n'),
          metadata: {
            fileType: 'document',
            senderName: safeText(senderName, 60),
            linkedFromMessage: true,
            previewText: safeLongText(documentPreview.preview_text || '', 1200)
          },
          sourceUserId: Number(message.sender_user_id || 0) || null,
          sourceMessageId: Number(message.id || 0) || null,
          sourceDocumentId: documentId
        });
      }
    }

    const memory = await listRoomMemoryEntries(pool, parsedRoomId);
    const summary = await getRoomSummary(pool, parsedRoomId);
    return { summary, memory };
  };

  const retrieveRelevantMemoryEntries = (entries = [], prompt = '', summaryText = '') => {
    const tokens = extractMemorySearchTokens(prompt, summaryText);
    const weighted = entries
      .map((entry) => {
        const typeWeight = entry.memoryType === 'summary'
          ? 6
          : entry.memoryType === 'profile'
            ? 5
            : entry.memoryType === 'document'
              ? 4
              : entry.memoryType === 'code'
                ? 4
                : 2;
        return {
          entry,
          score: typeWeight
            + scoreMemoryContent(entry.title, tokens) * 2
            + scoreMemoryContent(entry.content, tokens)
        };
      })
      .sort((left, right) => right.score - left.score || String(right.entry.updatedAt || '').localeCompare(String(left.entry.updatedAt || '')));

    return weighted.slice(0, memoryContextLimit).map((item) => item.entry);
  };

  const findRecentMessageLinkedMemoryEntries = (entries = [], recentMessages = []) => {
    const recentIds = new Set(
      recentMessages
        .map((item) => Number(item?.id || 0))
        .filter((id) => id > 0)
    );
    if (!recentIds.size) return [];

    return entries
      .filter((entry) => recentIds.has(Number(entry?.sourceMessageId || 0)))
      .sort((left, right) => String(right.updatedAt || '').localeCompare(String(left.updatedAt || '')))
      .slice(0, memoryContextLimit);
  };

  return {
    getRoomSummary,
    listRoomMemoryEntries,
    refreshRoomMemoryArtifacts,
    retrieveRelevantMemoryEntries,
    findRecentMessageLinkedMemoryEntries
  };
};

module.exports = {
  createRoomMemoryToolkit
};
