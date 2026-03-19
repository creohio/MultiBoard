const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 🔥 CHANGE THIS IF YOUR HTML NAME IS DIFFERENT
const HTML_FILE = 'unified_board_builder.html';

const DATA_FILE = path.join(__dirname, 'server.json');

app.use(express.json());
app.use(express.static(__dirname));

let boards = {};
const clients = {};

// =======================
// LOAD DATA
// =======================
if (fs.existsSync(DATA_FILE)) {
  try {
    boards = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    boards = {};
  }
}

// =======================
// SAVE DATA
// =======================
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(boards, null, 2));
}

// =======================
// HOME PAGE (FIXES "Cannot GET /")
// =======================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, HTML_FILE));
});

// =======================
// REALTIME EVENTS (SSE)
// =======================
app.get('/events', (req, res) => {
  const board = req.query.board || 'default';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  if (!clients[board]) clients[board] = [];
  clients[board].push(res);

  // Send current state immediately
  res.write(`data: ${JSON.stringify({
    type: 'hello',
    state: boards[board] || {}
  })}\n\n`);

  req.on('close', () => {
    clients[board] = clients[board].filter(c => c !== res);
  });
});

// =======================
// SAVE / UPDATE BOARD
// =======================
app.post('/patch', (req, res) => {
  const board = req.query.board || 'default';

  boards[board] = req.body.state;
  saveData();

  // Broadcast to all users
  (clients[board] || []).forEach(client => {
    client.write(`data: ${JSON.stringify({
      type: 'patch',
      state: boards[board]
    })}\n\n`);
  });

  res.json({ ok: true });
});

// =======================
// DELETE BOARD
// =======================
app.post('/delete', (req, res) => {
  const board = req.query.board;

  if (board && boards[board]) {
    delete boards[board];
    saveData();
  }

  res.json({ ok: true });
});

// =======================
// START SERVER
// =======================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
