const {
  getPool,
  toInt,
  getJoinedMember,
  removeUploadedFile,
  parseDocumentSource,
  ensureRoomDocumentsTable,
  buildUploadedFileUrl,
  inferDocumentPageCount,
  loadDocumentPreviewText
} = require('./shared');

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
    const [documents] = await pool.execute(
      `SELECT id, room_id, uploader_user_id, source, file_name, file_url, file_size, mime_type,
              page_count, preview_text, status, uploaded_at, updated_at
       FROM discussion_room_documents
       WHERE room_id = ?
       ORDER BY uploaded_at DESC, id DESC`,
      [roomId]
    );

    res.json({ documents });
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

    res.status(201).json({ document: rows[0] || null });
  } catch (error) {
    await removeUploadedFile(uploadedPath);
    console.error('上传房间文档失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
};

module.exports = {
  listRoomDocuments,
  uploadRoomDocument
};
