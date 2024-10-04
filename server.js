const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS with robust configuration
app.use(cors({
  origin: ['https://preeminent-lamington-2b8cba.netlify.app', 'http://localhost:3000'], // Your frontend URLs
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Allow preflight requests (OPTIONS) for /scan
app.options('/scan', cors());

app.options('*', cors()); // Handle preflight requests globally

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

// QR code data processing endpoint
app.post('/scan', async (req, res) => {
  const { groupID, plant } = req.body; // We are using groupID and plant

  console.log('QR Data received:', groupID, plant);

  // Validate the QR code data
  if (!groupID || !plant) {
    return res.status(400).json({ error: 'Missing groupID or plant' });
  }

  try {
    const result = await pool.query('SELECT * FROM "PlantList" WHERE "GroupID" = $1 AND "Plant" = $2', [groupID, plant]); // Correct column names
    if (result.rows.length > 0) {
      res.json(result.rows[0]); // Return the plant data if found
    } else {
      res.status(404).json({ error: 'Plant not found' });
    }
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Image upload endpoint (unchanged)
app.post('/upload', upload.single('plantImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  const { groupID, plant } = req.body; // Using groupID and plant

  if (!groupID || !plant) {
    return res.status(400).json({ error: 'Group ID and Plant are required' });
  }

  try {
    const selectResult = await pool.query('SELECT "ImageLinks" FROM "PlantList" WHERE "GroupID" = $1 AND "Plant" = $2', [groupID, plant]);

    let updatedImageLinks = imageUrl;
    if (selectResult.rows.length > 0 && selectResult.rows[0].ImageLinks) {
      updatedImageLinks = `${selectResult.rows[0].ImageLinks},${imageUrl}`;
    }

    await pool.query('UPDATE "PlantList" SET "ImageLinks" = $1 WHERE "GroupID" = $2 AND "Plant" = $3', [updatedImageLinks, groupID, plant]);
    res.status(201).json({ imageUrl });

  } catch (err) {
    console.error('Failed to update plant with image:', err.message);
    res.status(500).json({ error: 'Failed to update plant with image' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Test endpoint
app.get('/', (req, res) => {
  res.send('Welcome to the Plant Nursery API!');
});
