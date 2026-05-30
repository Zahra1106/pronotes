const mongoose = require('mongoose');

const folderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  folderId: { type: String, required: true }, // unique string id used by Flutter
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Folder', folderSchema);