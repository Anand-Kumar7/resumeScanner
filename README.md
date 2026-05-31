# TalentMatch AI - Resume Screening & Candidate Ranking

TalentMatch AI is a full-stack web application for screening resumes against a Job Description (JD). It extracts text from uploaded resumes, compares each candidate against the active JD, generates a 0-100 match score, and displays candidates ranked from best fit to lowest fit.

## Features

- Upload one or many resumes.
- Supports PDF, DOC, DOCX, and TXT files.
- Enter a JD manually or import a JD document.
- Extract candidate name, email, phone, skills, experience, and education signals.
- Score candidates by skills match, experience relevance, education alignment, and keyword similarity.
- Rank candidates from highest score to lowest score.
- Search candidates by name, email, or skills.
- Sort by score or candidate name.
- Preview/download original resumes.
- Delete candidate records.
- Export rankings to CSV.
- Store jobs, candidates, and screening results in MySQL.

## Tech Stack

- Frontend: React, Vite, Lucide icons
- Backend: Node.js, Express, Multer
- Database: MySQL
- Parsing: pdf-parse, mammoth
- AI/Scoring: Gemini API when `GEMINI_API_KEY` is present, local heuristic scoring fallback otherwise

## Architecture

```text
React Dashboard
  -> Upload JD / enter JD
  -> Upload resumes
  -> Express API
  -> Parse PDF/DOC/DOCX/TXT text
  -> Gemini or local scoring engine
  -> MySQL persistence
  -> Ranked dashboard + CSV export
```

Main backend routes:

- `POST /api/jobs` - create a JD profile
- `POST /api/jobs/parse` - parse an uploaded JD document
- `GET /api/jobs` - list saved jobs
- `POST /api/screenings/upload` - upload resumes and score them
- `GET /api/screenings/job/:jobId` - get ranked candidates for a job
- `GET /api/candidates/:id/resume` - preview/download resume
- `DELETE /api/candidates/:id` - delete a candidate and related screenings

## Local Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=resume_screening
GEMINI_API_KEY=
ALLOWED_ORIGIN=http://localhost:5173
```

Start MySQL, then start the backend:

```bash
npm start
```

The backend runs on:

```text
http://localhost:5000
```

The backend automatically creates the `resume_screening` database and the required tables if the configured database user has permission.

### 2. Frontend

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:5173
```

## Database Schema

```sql
CREATE DATABASE IF NOT EXISTS resume_screening;
USE resume_screening;

CREATE TABLE jobs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE candidates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  raw_text LONGTEXT,
  file_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE screenings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  candidate_id INT NOT NULL,
  job_id INT NOT NULL,
  score INT NOT NULL,
  matched_skills TEXT,
  missing_skills TEXT,
  experience_relevance TEXT,
  education_alignment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
```

## Scoring Approach

The app supports two scoring modes.

### Gemini AI mode

When `GEMINI_API_KEY` is configured, the backend asks Gemini to extract candidate details and evaluate the resume against the JD. The response is normalized into JSON containing the score, matched skills, missing skills, experience relevance, education alignment, candidate name, email, and phone.

### Local fallback mode

When no Gemini key is configured, the backend uses a local scoring engine:

- Skills match: compares detected technical skills in the JD and resume.
- Experience relevance: compares years of experience and seniority signals.
- Education alignment: compares degree keywords.
- Keyword similarity: measures overlap between meaningful JD and resume terms.
- Contact parsing: extracts email and phone with regular expressions.
- Name parsing: uses structural resume line heuristics.

This keeps the app usable even without an AI API key.

## Verification

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Backend:

```bash
cd backend
node --check server.js
npm start
```

Expected backend output:

```text
Connected to MySQL database: resume_screening
Database tables verified/created successfully.
Server is running on http://localhost:5000
```

## Deployment

Recommended simple deployment:

1. Push this project to GitHub.
2. Create a hosted MySQL database on Railway, Aiven, PlanetScale, or another MySQL provider.
3. Deploy `backend/` to Render or Railway as a Node.js web service.
4. Deploy `frontend/` to Vercel or Netlify.

Backend production environment variables:

```env
PORT=5000
DB_HOST=your_mysql_host
DB_PORT=3306
DB_USER=your_mysql_user
DB_PASSWORD=your_mysql_password
DB_NAME=resume_screening
GEMINI_API_KEY=optional_gemini_key
ALLOWED_ORIGIN=https://your-frontend-domain.vercel.app
```

Frontend production environment variable:

```env
VITE_API_BASE_URL=https://your-backend-domain.onrender.com/api
```

Build commands:

- Backend install command: `npm install`
- Backend start command: `npm start`
- Frontend build command: `npm run build`
- Frontend publish directory: `frontend/dist`

## Assumptions and Limitations

- Resumes and JDs are expected to be in English.
- Text-based PDFs are supported. Scanned image PDFs require OCR, which is outside the current scope.
- Uploaded resumes are stored on local backend disk. For production platforms with ephemeral file systems, use persistent disks or cloud storage such as S3.
- The local fallback scorer is deterministic and explainable, but Gemini scoring provides better semantic matching when configured.
