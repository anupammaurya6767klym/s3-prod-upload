const express = require('express');
const multer = require('multer');
const AWS = require('aws-sdk');
const cors = require('cors');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
const upload = multer({ dest: 'uploads/' });

// Enable CORS
app.use(cors());

// Configure AWS with environment variables
const s3 = new AWS.S3({
  accessKeyId: process.env.KLYM_AWS_ACCESS_KEY,
  secretAccessKey: process.env.KLYM_AWS_SECRET_KEY,
  region: process.env.KLYM_AWS_REGION || 'ap-south-1'
});

const bucketName = process.env.KLYM_S3_BUCKET || 'klym-products-bucket';

// Upload endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    console.log('📁 File received:', req.file);
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const fs = require('fs');
    const fileBuffer = fs.readFileSync(req.file.path);
    const fileName = `images/${Date.now()}-${req.file.originalname}`;
    console.log('🎯 Uploading to S3...');
    
    const uploadParams = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileBuffer,
      ContentType: req.file.mimetype
    };

    const result = await s3.upload(uploadParams).promise();
    
    // Generate signed URL
    const signedUrl = s3.getSignedUrl('getObject', {
      Bucket: bucketName,
      Key: fileName,
      Expires: 86400 // 24 hours
    });

    // Clean up temp file
    fs.unlinkSync(req.file.path);
    
    console.log('✅ Upload successful:', result.Location);
    
    res.json({
      message: 'Upload successful',
      url: result.Location,
      signedUrl: signedUrl,
      key: fileName,
      etag: result.ETag,
      bucket: bucketName
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      details: error.message
    });
  }
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ 
    message: 'Server is running!', 
    timestamp: new Date().toISOString(),
    bucket: bucketName,
    region: process.env.KLYM_AWS_REGION || 'ap-south-1'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const requiredEnvVars = [
    'KLYM_AWS_ACCESS_KEY',
    'KLYM_AWS_SECRET_KEY',
    'KLYM_S3_BUCKET'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    return res.status(500).json({
      status: 'error',
      message: 'Missing required environment variables',
      missing: missingVars
    });
  }

  res.json({
    status: 'ok',
    message: 'All environment variables configured',
    bucket: bucketName,
    region: process.env.KLYM_AWS_REGION || 'ap-south-1'
  });
});

// Serve static files for testing
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📤 Upload endpoint: http://localhost:${PORT}/upload`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/test`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  
  // Check if required environment variables are set
  const requiredEnvVars = [
    'KLYM_AWS_ACCESS_KEY',
    'KLYM_AWS_SECRET_KEY', 
    'KLYM_S3_BUCKET'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('⚠️  Missing environment variables:', missingVars.join(', '));
    console.log('📝 Create a .env file with:');
    console.log('   KLYM_AWS_ACCESS_KEY=your_access_key');
    console.log('   KLYM_AWS_SECRET_KEY=your_secret_key');
    console.log('   KLYM_S3_BUCKET=your_bucket_name');
    console.log('   KLYM_AWS_REGION=ap-south-1');
  } else {
    console.log('✅ All environment variables configured');
  }
});

module.exports = app;
