const express = require('express');
const { Pool } = require('pg');
const multer = require('multer');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS
aapp.use(cors({
  origin: '*',  // Temporary for debugging, remove once it's resolved
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Log CORS preflight requests
app.options('*', (req, res) => {
  console.log('Preflight request:', req.method, req.headers);
  res.sendStatus(200);
});


app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// QR code data processing endpoint
app.post('/scan', async (req, res) => {
  const qrData = req.body.qrCodeData;

  // Validate the QR code data format
  if (!qrData || !qrData.match(/\*A\d+\*/) || !qrData.match(/\*V\d+\*/)) {
    return res.status(400).json({ error: 'Invalid QR code format' });
  }

  // Extract GroupID and PlantID
  const group = qrData.match(/\*A(\d+)\*/)[1];
  const plant = qrData.match(/\*V(\d+)\*/)[1];

  try {
    // Query the database to find the plant
    const result = await pool.query('SELECT * FROM "PlantList" WHERE "GroupID" = $1 AND "Plant" = $2', [group, plant]);
    if (result.rows.length > 0) {
      res.json(result.rows[0]);  // Send the matching plant data
    } else {
      res.status(404).json({ error: 'Plant not found' });
    }
  } catch (err) {
    console.error('Database error:', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
