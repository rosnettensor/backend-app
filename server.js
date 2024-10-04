const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS with configuration for preflight
app.use(cors({
  origin: ['https://preeminent-lamington-2b8cba.netlify.app', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.options('/scan', cors());

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
  const { groupID, plantID } = req.body;

  console.log('QR Data received:', { groupID, plantID });

  // Ensure valid groupID and plantID
  if (!groupID || !plantID) {
    return res.status(400).json({ error: 'Invalid QR code data' });
  }

  try {
    // Query the database for matching GroupID and Plant
    const result = await pool.query(
      'SELECT * FROM "PlantList" WHERE "GroupID" = $1 AND "Plant" = $2', 
      [groupID, plantID]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);  // Return plant data if found
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
  console.log(`Server is running on port ${port}`);
});
