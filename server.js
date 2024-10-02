const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 5001;

// Enable CORS for frontend requests, using environment variable for frontend URL
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
}));

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));  // Serve uploaded images

// Connect to SQLite database
const db = new sqlite3.Database('./PlantList.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Multer configuration for image uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Use timestamp to avoid duplicate filenames
  }
});
const upload = multer({ storage });

// QR code data processing endpoint
app.post('/scan', (req, res) => {
  const qrData = req.body.qrCodeData;

  // Validate the QR code data format
  if (!qrData || !qrData.match(/\*A\d+\*/) || !qrData.match(/\*V\d+\*/)) {
    return res.status(400).json({ error: 'Invalid QR code format' });
  }

  // Extract GroupID and PlantID from the QR code data
  const group = qrData.match(/\*A(\d+)\*/)[1];
  const plant = qrData.match(/\*V(\d+)\*/)[1];

  // Fetch plant data from the database
  const sql = 'SELECT * FROM PlantList WHERE GroupID = ? AND Plant = ?';
  db.get(sql, [group, plant], (err, row) => {
    if (err) {
      console.error('Database error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    if (row) {
      res.json(row);  // Return the plant data if found
    } else {
      res.status(404).json({ error: 'Plant not found' });
    }
  });
});

// Image upload endpoint: Upload image and update ImageLinks column in PlantList.db
app.post('/upload', upload.single('plantImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const imageUrl = `/uploads/${req.file.filename}`;
  const { groupId, plantId } = req.body;

  // Validate Group ID and Plant ID
  if (!groupId || !plantId) {
    return res.status(400).json({ error: 'Group ID and Plant ID are required' });
  }

  // Fetch current ImageLinks for the plant
  const selectSql = 'SELECT ImageLinks FROM PlantList WHERE GroupID = ? AND Plant = ?';
  db.get(selectSql, [groupId, plantId], (err, row) => {
    if (err) {
      console.error('Failed to fetch plant data:', err.message);
      return res.status(500).json({ error: 'Failed to fetch plant data' });
    }

    // Append new image URL to existing ImageLinks
    let updatedImageLinks = imageUrl;
    if (row && row.ImageLinks) {
      updatedImageLinks = `${row.ImageLinks},${imageUrl}`;
    }

    // Update ImageLinks column in the database
    const updateSql = 'UPDATE PlantList SET ImageLinks = ? WHERE GroupID = ? AND Plant = ?';
    db.run(updateSql, [updatedImageLinks, groupId, plantId], (err) => {
      if (err) {
        console.error('Failed to update plant with image:', err.message);
        return res.status(500).json({ error: 'Failed to update plant with image' });
      }

      res.status(201).json({ imageUrl });  // Send the new image URL
    });
  });
});

// Delete image endpoint: Remove image URL from ImageLinks and delete image file
app.delete('/delete-image', (req, res) => {
  const { imageUrl, groupId, plantId } = req.body;

  // Remove image file from the uploads folder
  const filePath = path.join(__dirname, 'uploads', path.basename(imageUrl));
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error('Error deleting image file:', err.message);
      return res.status(500).json({ error: 'Failed to delete image file' });
    }

    // Remove the image URL from the ImageLinks in the database
    const selectSql = 'SELECT ImageLinks FROM PlantList WHERE GroupID = ? AND Plant = ?';
    db.get(selectSql, [groupId, plantId], (err, row) => {
      if (err) {
        console.error('Failed to fetch plant data:', err.message);
        return res.status(500).json({ error: 'Failed to fetch plant data' });
      }

      // Filter out the deleted image URL from ImageLinks
      const updatedImageLinks = row.ImageLinks.split(',').filter(link => link !== imageUrl).join(',');

      // Update the ImageLinks column in the database
      const updateSql = 'UPDATE PlantList SET ImageLinks = ? WHERE GroupID = ? AND Plant = ?';
      db.run(updateSql, [updatedImageLinks, groupId, plantId], (err) => {
        if (err) {
          console.error('Failed to update ImageLinks:', err.message);
          return res.status(500).json({ error: 'Failed to update ImageLinks' });
        }

        res.status(200).json({ success: true, message: 'Image deleted successfully' });
      });
    });
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
