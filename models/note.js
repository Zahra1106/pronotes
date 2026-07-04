const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Note = require('../models/note');
const Folder = require('../models/folder');

// ============================================================
// ====================== NOTES ROUTES ========================
// ============================================================

// 📌 GET / - Fetch all notes for logged-in user
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId })
      .sort({ updatedAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error('GET /notes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 POST / - Create a new note
router.post('/', auth, async (req, res) => {
  try {
    const { 
      title, 
      content, 
      folderId, 
      shared, 
      isPinned, 
      imagePath, 
      fontFamily, 
      fontSize 
    } = req.body;

    const note = await Note.create({
      userId: req.userId,
      title: title || '',
      content: content || '',
      folderId: folderId || 'default',
      shared: shared || false,
      isPinned: isPinned || false,
      imagePath: imagePath || '',
      fontFamily: fontFamily || 'Inter',
      fontSize: fontSize || 15,
    });

    res.status(201).json({ note });
  } catch (err) {
    console.error('POST /notes error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 PUT /:id - Update a note
router.put('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { 
      title, 
      content, 
      folderId, 
      isDeleted, 
      shared, 
      isPinned, 
      imagePath, 
      fontFamily, 
      fontSize 
    } = req.body;

    // Update only fields that are provided
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (folderId !== undefined) note.folderId = folderId;
    if (isDeleted !== undefined) note.isDeleted = isDeleted;
    if (shared !== undefined) note.shared = shared;
    if (isPinned !== undefined) note.isPinned = isPinned;
    if (imagePath !== undefined) note.imagePath = imagePath;
    if (fontFamily !== undefined) note.fontFamily = fontFamily;
    if (fontSize !== undefined) note.fontSize = fontSize;

    // updatedAt automatically updates via pre('save') hook
    await note.save();

    res.json({ note });
  } catch (err) {
    console.error('PUT /notes/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 DELETE /:id - Permanently delete a note
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await Note.deleteOne({ 
      _id: req.params.id, 
      userId: req.userId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    console.error('DELETE /notes/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// ===================== FOLDER ROUTES ========================
// ============================================================

// 📌 GET /folders - Fetch all folders for user
router.get('/folders', auth, async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.userId })
      .sort({ createdAt: 1 });
    res.json({ folders });
  } catch (err) {
    console.error('GET /notes/folders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 POST /folders - Create a new folder
router.post('/folders', auth, async (req, res) => {
  try {
    const { name, folderId } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    // Check if folderId already exists for this user
    const existing = await Folder.findOne({ 
      folderId: folderId || Date.now().toString(),
      userId: req.userId 
    });

    if (existing) {
      return res.status(409).json({ error: 'Folder already exists' });
    }

    const folder = await Folder.create({
      userId: req.userId,
      name,
      folderId: folderId || Date.now().toString(),
    });

    res.status(201).json({ folder });
  } catch (err) {
    console.error('POST /notes/folders error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 PUT /folders/:folderId - Rename a folder
router.put('/folders/:folderId', auth, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await Folder.findOneAndUpdate(
      { 
        folderId: req.params.folderId, 
        userId: req.userId 
      },
      { name },
      { new: true }
    );

    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ folder });
  } catch (err) {
    console.error('PUT /notes/folders/:folderId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 DELETE /folders/:folderId - Delete folder & move notes to default
router.delete('/folders/:folderId', auth, async (req, res) => {
  try {
    const folderId = req.params.folderId;

    // Don't allow deleting 'default' folder
    if (folderId === 'default') {
      return res.status(400).json({ error: 'Cannot delete default folder' });
    }

    // Move all notes from this folder to 'default'
    await Note.updateMany(
      { 
        userId: req.userId, 
        folderId: folderId 
      },
      { folderId: 'default' }
    );

    // Delete the folder
    const result = await Folder.deleteOne({ 
      folderId: folderId, 
      userId: req.userId 
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    res.json({ message: 'Folder deleted successfully' });
  } catch (err) {
    console.error('DELETE /notes/folders/:folderId error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================================
// =================== ADVANCED FEATURES ======================
// ============================================================

// 📌 GET /search - Search notes with filters
router.get('/search', auth, async (req, res) => {
  try {
    const { q, folderId, isDeleted, shared, isPinned } = req.query;
    const query = { userId: req.userId };

    // Text search
    if (q && q.trim()) {
      query.$or = [
        { title: { $regex: q.trim(), $options: 'i' } },
        { content: { $regex: q.trim(), $options: 'i' } }
      ];
    }

    // Filters
    if (folderId) query.folderId = folderId;
    if (isDeleted !== undefined) query.isDeleted = isDeleted === 'true';
    if (shared !== undefined) query.shared = shared === 'true';
    if (isPinned !== undefined) query.isPinned = isPinned === 'true';

    const notes = await Note.find(query)
      .sort({ updatedAt: -1 });

    res.json({ notes });
  } catch (err) {
    console.error('GET /notes/search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 POST /bulk-delete - Delete multiple notes at once
router.post('/bulk-delete', auth, async (req, res) => {
  try {
    const { noteIds } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs array is required' });
    }

    // Validate max limit (prevent abuse)
    if (noteIds.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 notes can be deleted at once' });
    }

    const result = await Note.deleteMany({
      _id: { $in: noteIds },
      userId: req.userId
    });

    res.json({ 
      message: `${result.deletedCount} notes deleted successfully`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    console.error('POST /notes/bulk-delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 GET /analytics - Get note statistics
router.get('/analytics', auth, async (req, res) => {
  try {
    const [total, deleted, shared, pinned, folders] = await Promise.all([
      Note.countDocuments({ userId: req.userId }),
      Note.countDocuments({ userId: req.userId, isDeleted: true }),
      Note.countDocuments({ userId: req.userId, shared: true }),
      Note.countDocuments({ userId: req.userId, isPinned: true }),
      Folder.countDocuments({ userId: req.userId }),
    ]);

    // Additional stats
    const [lastWeek, thisWeek] = await Promise.all([
      Note.countDocuments({
        userId: req.userId,
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      }),
      Note.countDocuments({
        userId: req.userId,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }),
    ]);

    res.json({
      total,
      deleted,
      shared,
      pinned,
      active: total - deleted,
      folders,
      lastWeek,
      thisWeek,
    });
  } catch (err) {
    console.error('GET /notes/analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 POST /export - Export notes as JSON
router.post('/export', auth, async (req, res) => {
  try {
    const { noteIds } = req.body;

    if (!noteIds || !Array.isArray(noteIds) || noteIds.length === 0) {
      return res.status(400).json({ error: 'Note IDs array is required' });
    }

    const notes = await Note.find({
      _id: { $in: noteIds },
      userId: req.userId
    }).select('-userId'); // Remove userId from response

    res.json({
      count: notes.length,
      exportedAt: new Date().toISOString(),
      notes,
    });
  } catch (err) {
    console.error('POST /notes/export error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 POST /duplicate - Duplicate a note
router.post('/duplicate/:id', auth, async (req, res) => {
  try {
    const original = await Note.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!original) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Create a copy
    const duplicated = await Note.create({
      userId: req.userId,
      title: `${original.title} (Copy)`,
      content: original.content,
      folderId: original.folderId,
      shared: false,
      isPinned: false,
      imagePath: original.imagePath,
      fontFamily: original.fontFamily,
      fontSize: original.fontSize,
    });

    res.status(201).json({ note: duplicated });
  } catch (err) {
    console.error('POST /notes/duplicate/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 GET /recent - Get recently updated notes
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const notes = await Note.find({ 
      userId: req.userId,
      isDeleted: false 
    })
      .sort({ updatedAt: -1 })
      .limit(parseInt(limit));

    res.json({ notes });
  } catch (err) {
    console.error('GET /notes/recent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 📌 GET /stats - Get quick stats for dashboard
router.get('/stats', auth, async (req, res) => {
  try {
    const [total, pinned, shared, recent] = await Promise.all([
      Note.countDocuments({ userId: req.userId, isDeleted: false }),
      Note.countDocuments({ userId: req.userId, isPinned: true, isDeleted: false }),
      Note.countDocuments({ userId: req.userId, shared: true, isDeleted: false }),
      Note.find({ userId: req.userId, isDeleted: false })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select('title updatedAt'),
    ]);

    res.json({
      total,
      pinned,
      shared,
      recentNotes: recent,
    });
  } catch (err) {
    console.error('GET /notes/stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;