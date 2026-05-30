const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Note = require('../models/Note');
const Folder = require('../models/Folder');

// =================== NOTES ===================

// GET all notes for user
router.get('/', auth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json({ notes });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create note
router.post('/', auth, async (req, res) => {
  try {
    const { title, content, folderId, shared } = req.body;
    const note = await Note.create({
      userId: req.userId,
      title: title || '',
      content: content || '',
      folderId: folderId || 'default',
      shared: shared || false,
    });
    res.status(201).json({ note });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update note
router.put('/:id', auth, async (req, res) => {
  try {
    const note = await Note.findOne({ _id: req.params.id, userId: req.userId });
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const { title, content, folderId, isDeleted, shared } = req.body;
    if (title !== undefined) note.title = title;
    if (content !== undefined) note.content = content;
    if (folderId !== undefined) note.folderId = folderId;
    if (isDeleted !== undefined) note.isDeleted = isDeleted;
    if (shared !== undefined) note.shared = shared;

    await note.save();
    res.json({ note });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE note permanently
router.delete('/:id', auth, async (req, res) => {
  try {
    await Note.deleteOne({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// =================== FOLDERS ===================

// GET all folders for user
router.get('/folders', auth, async (req, res) => {
  try {
    const folders = await Folder.find({ userId: req.userId }).sort({ createdAt: 1 });
    res.json({ folders });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create folder
router.post('/folders', auth, async (req, res) => {
  try {
    const { name, folderId } = req.body;
    const folder = await Folder.create({
      userId: req.userId,
      name,
      folderId: folderId || Date.now().toString(),
    });
    res.status(201).json({ folder });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT update folder
router.put('/folders/:folderId', auth, async (req, res) => {
  try {
    const folder = await Folder.findOneAndUpdate(
      { folderId: req.params.folderId, userId: req.userId },
      { name: req.body.name },
      { new: true }
    );
    if (!folder) return res.status(404).json({ error: 'Folder not found' });
    res.json({ folder });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE folder (moves its notes to default)
router.delete('/folders/:folderId', auth, async (req, res) => {
  try {
    await Note.updateMany(
      { userId: req.userId, folderId: req.params.folderId },
      { folderId: 'default' }
    );
    await Folder.deleteOne({ folderId: req.params.folderId, userId: req.userId });
    res.json({ message: 'Folder deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;