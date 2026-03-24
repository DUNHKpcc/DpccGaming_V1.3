const {
  getPool,
  toInt,
  getJoinedMember,
  removeUploadedFile,
  parseDocumentSource,
  ensureRoomDocumentsTable,
  ensureRoomDocumentStateTable,
  buildUploadedFileUrl,
  inferDocumentPageCount,
  loadDocumentPreviewText,
  emitRoomDocumentsEvent,
  emitRoomMemoryEvent,
  refreshRoomMemoryArtifacts
} = require('./shared');

const setSelectedDocumentForRoom = async (pool, roomId, selectedDocumentId, userId = null) => {
  await ensureRoomDocumentStateTable(pool);
  await pool.execute(
    `INSERT INTO discussion_room_document_state (room_id, selected_document_id, updated_by_user_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE
       selected_document_id = VALUES(selected_document_id),
       updated_by_user_id = VALUES(updated_by_user_id),
       updated_at = CURRENT_TIMESTAMP`,
    [roomId, selectedDocumentId, userId]
  );
};

const listRoomDocuments = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });

    const userId = req.user.userId;
    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可查看文档' });
    }

    await ensureRoomDocumentsTable(pool);
    await ensureRoomDocumentStateTable(pool);
    const [documents] = await pool.execute(
      `SELECT id, room_id, uploader_user_id, source, file_name, file_url, file_size, mime_type,
              page_count, preview_text, status, uploaded_at, updated_at
       FROM discussion_room_documents
       WHERE room_id = ?
       ORDER BY uploaded_at DESC, id DESC`,
      [roomId]
    );

    const [stateRows] = await pool.execute(
      `SELECT selected_document_id
       FROM discussion_room_document_state
       WHERE room_id = ?
       LIMIT 1`,
      [roomId]
    );

    res.json({
      documents,
      selectedDocumentId: stateRows[0]?.selected_document_id || null
    });
  } catch (error) {
    console.error('获取房间文档失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const uploadRoomDocument = async (req, res) => {
  const uploadedPath = req.file?.path || '';
  try {
    const roomId = toInt(req.params.roomId);
    if (!roomId) {
      await removeUploadedFile(uploadedPath);
      return res.status(400).json({ error: '无效的 roomId' });
    }
    if (!req.file) return res.status(400).json({ error: '请上传文档文件' });

    const userId = req.user.userId;
    const source = parseDocumentSource(req.body?.source);
    const pool = getPool();

    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      await removeUploadedFile(uploadedPath);
      return res.status(403).json({ error: '仅房间成员可上传文档' });
    }

    const [roomRows] = await pool.execute(
      `SELECT id
       FROM discussion_rooms
       WHERE id = ?
       LIMIT 1`,
      [roomId]
    );
    if (!roomRows.length) {
      await removeUploadedFile(uploadedPath);
      return res.status(404).json({ error: '房间不存在' });
    }

    await ensureRoomDocumentsTable(pool);

    const originalName = String(req.file.originalname || req.file.filename || 'document').trim();
    const mimeType = String(req.file.mimetype || '').trim();
    const fileUrl = buildUploadedFileUrl(uploadedPath, `discussion/document/${req.file.filename}`);
    const pageCount = inferDocumentPageCount(originalName);
    const previewText = await loadDocumentPreviewText(uploadedPath, originalName, mimeType);

    const [insertResult] = await pool.execute(
      `INSERT INTO discussion_room_documents
       (room_id, uploader_user_id, source, file_name, file_url, file_size, mime_type, page_count, preview_text, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded')`,
      [
        roomId,
        userId,
        source,
        originalName,
        fileUrl,
        Number(req.file.size || 0),
        mimeType,
        pageCount,
        previewText || null
      ]
    );

    const [rows] = await pool.execute(
      `SELECT id, room_id, uploader_user_id, source, file_name, file_url, file_size, mime_type,
              page_count, preview_text, status, uploaded_at, updated_at
       FROM discussion_room_documents
       WHERE id = ?
       LIMIT 1`,
      [insertResult.insertId]
    );

    await setSelectedDocumentForRoom(pool, roomId, insertResult.insertId, userId);
    emitRoomDocumentsEvent(roomId, {
      action: 'upload',
      document: rows[0] || null,
      selectedDocumentId: insertResult.insertId,
      updatedByUserId: userId
    });
    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });

    res.status(201).json({
      document: rows[0] || null,
      selectedDocumentId: insertResult.insertId
    });
  } catch (error) {
    await removeUploadedFile(uploadedPath);
    console.error('上传房间文档失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const deleteRoomDocument = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const documentId = toInt(req.params.documentId);
    const userId = req.user.userId;

    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!documentId) return res.status(400).json({ error: '无效的 documentId' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可删除文档' });
    }

    await ensureRoomDocumentsTable(pool);
    await ensureRoomDocumentStateTable(pool);

    const [rows] = await pool.execute(
      `SELECT id
       FROM discussion_room_documents
       WHERE id = ? AND room_id = ?
       LIMIT 1`,
      [documentId, roomId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: '文档不存在' });
    }

    await pool.execute(
      `DELETE FROM discussion_room_documents
       WHERE id = ? AND room_id = ?`,
      [documentId, roomId]
    );

    const [remainingRows] = await pool.execute(
      `SELECT id
       FROM discussion_room_documents
       WHERE room_id = ?
       ORDER BY uploaded_at DESC, id DESC
       LIMIT 1`,
      [roomId]
    );
    const nextSelectedDocumentId = remainingRows[0]?.id || null;

    await setSelectedDocumentForRoom(pool, roomId, nextSelectedDocumentId, userId);

    emitRoomDocumentsEvent(roomId, {
      action: 'deleted',
      documentId,
      selectedDocumentId: nextSelectedDocumentId,
      updatedByUserId: userId
    });
    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });

    res.json({
      removed: true,
      documentId,
      selectedDocumentId: nextSelectedDocumentId
    });
  } catch (error) {
    console.error('删除房间文档失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

const setCurrentRoomDocument = async (req, res) => {
  try {
    const roomId = toInt(req.params.roomId);
    const documentId = toInt(req.body?.documentId || req.body?.document_id);
    const userId = req.user.userId;

    if (!roomId) return res.status(400).json({ error: '无效的 roomId' });
    if (!documentId) return res.status(400).json({ error: '无效的 documentId' });

    const pool = getPool();
    const member = await getJoinedMember(pool, roomId, userId, false);
    if (!member || member.status !== 'joined') {
      return res.status(403).json({ error: '仅房间成员可切换文档' });
    }

    await ensureRoomDocumentsTable(pool);
    await ensureRoomDocumentStateTable(pool);

    const [rows] = await pool.execute(
      `SELECT id
       FROM discussion_room_documents
       WHERE id = ? AND room_id = ?
       LIMIT 1`,
      [documentId, roomId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: '文档不存在' });
    }

    await setSelectedDocumentForRoom(pool, roomId, documentId, userId);
    emitRoomDocumentsEvent(roomId, {
      action: 'select',
      selectedDocumentId: documentId,
      updatedByUserId: userId
    });
    const memoryPayload = await refreshRoomMemoryArtifacts(pool, roomId, { updatedByUserId: userId });
    emitRoomMemoryEvent(roomId, {
      summary: memoryPayload.summary,
      memory: memoryPayload.memory,
      updatedByUserId: userId
    });

    res.json({ selectedDocumentId: documentId });
  } catch (error) {
    console.error('切换房间文档失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  listRoomDocuments,
  uploadRoomDocument,
  deleteRoomDocument,
  setCurrentRoomDocument
};
