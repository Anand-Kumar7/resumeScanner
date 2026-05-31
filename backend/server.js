const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const db = require('./config/db');
const { parseResume } = require('./utils/parser');
const { scoreResume } = require('./utils/scorer');

const app = express();
const PORT = process.env.PORT || 5000;

// CORS: Restrict to configured frontend origin (defaults to localhost for dev)
const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: allowedOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Rate limiting: Prevent API abuse (100 requests per 15 minutes per IP)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});

// Stricter rate limit for file uploads (20 uploads per 15 minutes per IP)
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many file uploads. Please try again after 15 minutes.' }
});

app.use('/api', apiLimiter);
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Unique filename to prevent overwrites
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /pdf|doc|docx|txt/i;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF, DOC, DOCX, and TXT files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// -------------------------------------------------------------
// ENDPOINTS
// -------------------------------------------------------------

// 1. Create a Job Description
app.post('/api/jobs', async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required.' });
  }

  try {
    const result = await db.query(
      'INSERT INTO jobs (title, description) VALUES (?, ?)',
      [title, description]
    );
    res.status(201).json({
      id: result.insertId,
      title,
      description,
      created_at: new Date()
    });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Database error occurred while creating job.' });
  }
});

// 2. Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await db.query('SELECT * FROM jobs ORDER BY created_at DESC');
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Database error occurred while fetching jobs.' });
  }
});

// 3. Parse an uploaded Job Description document
app.post('/api/jobs/parse', uploadLimiter, upload.single('jd'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No Job Description file uploaded.' });
  }

  try {
    const buffer = fs.readFileSync(req.file.path);
    const description = await parseResume(buffer, req.file.originalname);
    const title = path.basename(req.file.originalname, path.extname(req.file.originalname));

    fs.unlink(req.file.path, () => {});

    if (!description || description.trim().length < 20) {
      return res.status(422).json({ error: 'Could not extract enough text from this Job Description file.' });
    }

    res.json({
      title,
      description: description.trim()
    });
  } catch (error) {
    console.error('JD parsing error:', error);
    fs.unlink(req.file.path, () => {});
    res.status(500).json({ error: error.message || 'Failed to parse Job Description file.' });
  }
});

// 4. Upload resumes and run screening for a job
app.post('/api/screenings/upload', uploadLimiter, upload.array('resumes'), async (req, res) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'Job ID is required.' });
  }
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No resume files uploaded.' });
  }

  try {
    // Check if job exists
    const jobs = await db.query('SELECT * FROM jobs WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
      return res.status(404).json({ error: 'Job Description not found.' });
    }
    const job = jobs[0];

    const results = [];
    const errors = [];

    for (const file of req.files) {
      try {
        const filePath = file.path;
        const buffer = fs.readFileSync(filePath);
        
        // Step 1: Parse text
        const resumeText = await parseResume(buffer, file.originalname);
        
        // Step 2: Score against JD
        const evaluation = await scoreResume(resumeText, job.description);

        // Step 3: Insert into candidates table
        const candidateResult = await db.query(
          'INSERT INTO candidates (name, email, phone, raw_text, file_path) VALUES (?, ?, ?, ?, ?)',
          [
            evaluation.candidateName || 'Unknown Candidate',
            evaluation.email || null,
            evaluation.phone || null,
            resumeText,
            file.filename
          ]
        );
        const candidateId = candidateResult.insertId;

        // Step 4: Insert into screenings table
        await db.query(
          'INSERT INTO screenings (candidate_id, job_id, score, matched_skills, missing_skills, experience_relevance, education_alignment) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            candidateId,
            job.id,
            evaluation.score,
            JSON.stringify(evaluation.matchedSkills || []),
            JSON.stringify(evaluation.missingSkills || []),
            evaluation.experienceRelevance || '',
            evaluation.educationAlignment || ''
          ]
        );

        results.push({
          candidateId,
          name: evaluation.candidateName || 'Unknown Candidate',
          email: evaluation.email || null,
          phone: evaluation.phone || null,
          score: evaluation.score,
          matchedSkills: evaluation.matchedSkills || [],
          missingSkills: evaluation.missingSkills || [],
          experienceRelevance: evaluation.experienceRelevance || '',
          educationAlignment: evaluation.educationAlignment || '',
          fileName: file.originalname
        });
      } catch (err) {
        console.error(`Error processing file ${file.originalname}:`, err);
        errors.push({
          fileName: file.originalname,
          error: err.message || 'Processing failed'
        });
      }
    }

    res.json({
      successCount: results.length,
      failureCount: errors.length,
      screenings: results.sort((a, b) => b.score - a.score),
      errors
    });
  } catch (error) {
    console.error('Screening process error:', error);
    res.status(500).json({ error: 'An error occurred during resume screening.' });
  }
});

// 5. Get screening rankings for a job
app.get('/api/screenings/job/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const rows = await db.query(`
      SELECT 
        s.id AS screening_id,
        s.score,
        s.matched_skills,
        s.missing_skills,
        s.experience_relevance,
        s.education_alignment,
        s.created_at AS screened_at,
        c.id AS candidate_id,
        c.name,
        c.email,
        c.phone,
        c.file_path
      FROM screenings s
      JOIN candidates c ON s.candidate_id = c.id
      WHERE s.job_id = ?
      ORDER BY s.score DESC, c.name ASC
    `, [jobId]);

    // Parse the skills columns from stringified JSON to arrays
    const formattedRows = rows.map(row => {
      let matched = [];
      let missing = [];
      try {
        matched = JSON.parse(row.matched_skills || '[]');
        missing = JSON.parse(row.missing_skills || '[]');
      } catch (e) {
        console.warn('JSON parsing error for skills:', e.message);
      }

      return {
        screeningId: row.screening_id,
        candidateId: row.candidate_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        filePath: row.file_path,
        score: row.score,
        matchedSkills: matched,
        missingSkills: missing,
        experienceRelevance: row.experience_relevance,
        educationAlignment: row.education_alignment,
        screenedAt: row.screened_at
      };
    });

    res.json(formattedRows);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Database error occurred while fetching rankings.' });
  }
});

// 6. Download/Preview original resume file
app.get('/api/candidates/:id/resume', async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await db.query('SELECT file_path, name FROM candidates WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found.' });
    }

    const fileName = rows[0].file_path;
    if (!fileName) {
      return res.status(404).json({ error: 'Resume file not associated with this candidate.' });
    }

    const filePath = path.join(uploadsDir, fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Resume file not found on disk.' });
    }

    // Set appropriate content deposition to view inline if browser supports, or download
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving resume file:', error);
    res.status(500).json({ error: 'Error serving resume file.' });
  }
});

// 7. Delete candidate (will cascade to screenings)
app.delete('/api/candidates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const rows = await db.query('SELECT file_path FROM candidates WHERE id = ?', [id]);
    if (rows.length > 0) {
      const fileName = rows[0].file_path;
      if (fileName) {
        const filePath = path.join(uploadsDir, fileName);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Delete local file
        }
      }
    }
    
    await db.query('DELETE FROM candidates WHERE id = ?', [id]);
    res.json({ message: 'Candidate and associated screening records deleted successfully.' });
  } catch (error) {
    console.error('Error deleting candidate:', error);
    res.status(500).json({ error: 'Database error occurred while deleting candidate.' });
  }
});

// -------------------------------------------------------------
// SERVER INITIALIZATION
// -------------------------------------------------------------
async function startServer() {
  try {
    await db.initDB();
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server due to database error:', error.message);
    process.exit(1);
  }
}

startServer();
