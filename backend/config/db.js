const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: process.env.DB_PORT || 3306
};

const dbName = process.env.DB_NAME || 'resume_screening';

let pool;
let useFallback = false;

const JSON_DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

// Helper to ensure data folder and db.json exists
function initFallbackDB() {
  const dataDir = path.dirname(JSON_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const initialData = {
    jobs: [],
    candidates: [],
    screenings: [],
    nextIds: { jobs: 1, candidates: 1, screenings: 1 }
  };
  if (!fs.existsSync(JSON_DB_PATH)) {
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(initialData, null, 2));
  }
}

function readJsonDB() {
  try {
    initFallbackDB();
    if (!fs.existsSync(JSON_DB_PATH)) {
      return { jobs: [], candidates: [], screenings: [], nextIds: { jobs: 1, candidates: 1, screenings: 1 } };
    }
    const raw = fs.readFileSync(JSON_DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('Error reading local database file:', e.message);
    return { jobs: [], candidates: [], screenings: [], nextIds: { jobs: 1, candidates: 1, screenings: 1 } };
  }
}

function writeJsonDB(data) {
  try {
    initFallbackDB();
    fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Error writing to local database file:', e.message);
  }
}

async function initDB() {
  try {
    console.log('Attempting to connect to MySQL database...');
    // Connect without database selected to create it if it doesn't exist
    const connection = await mysql.createConnection(dbConfig);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    await connection.end();

    // Create pool with the database selected
    pool = mysql.createPool({
      ...dbConfig,
      database: dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log(`Connected to MySQL database: ${dbName}`);

    // Create tables
    await createTables();
  } catch (error) {
    console.warn('MySQL database connection failed:', error.message);
    console.log('Falling back to local file-based database (db.json)...');
    useFallback = true;
    initFallbackDB();
  }
}

async function createTables() {
  if (useFallback) return;
  const connection = await pool.getConnection();
  try {
    // Jobs table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Candidates table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        raw_text LONGTEXT,
        file_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Screenings table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS screenings (
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
      ) ENGINE=InnoDB;
    `);

    console.log('Database tables verified/created successfully.');
  } catch (error) {
    console.error('Error creating tables:', error.message);
    throw error;
  } finally {
    connection.release();
  }
}

async function query(sql, params = []) {
  if (!useFallback) {
    if (!pool) {
      throw new Error('Database pool not initialized. Call initDB() first.');
    }
    const [results] = await pool.execute(sql, params);
    return results;
  }

  // Fallback database logic
  const sqlStr = sql.trim();
  const dbData = readJsonDB();

  // 1. INSERT INTO jobs (title, description) VALUES (?, ?)
  if (/INSERT\s+INTO\s+jobs/i.test(sqlStr)) {
    const newJob = {
      id: dbData.nextIds.jobs++,
      title: params[0],
      description: params[1],
      created_at: new Date().toISOString()
    };
    dbData.jobs.push(newJob);
    writeJsonDB(dbData);
    return { insertId: newJob.id };
  }

  // 2. SELECT * FROM jobs ORDER BY created_at DESC
  if (/SELECT\s+\*\s+FROM\s+jobs\s+ORDER\s+BY/i.test(sqlStr)) {
    return [...dbData.jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  // 3. SELECT * FROM jobs WHERE id = ?
  if (/SELECT\s+\*\s+FROM\s+jobs\s+WHERE\s+id\s*=\s*\?/i.test(sqlStr)) {
    const job = dbData.jobs.find(j => j.id === parseInt(params[0], 10));
    return job ? [job] : [];
  }

  // 4. INSERT INTO candidates (name, email, phone, raw_text, file_path) VALUES (?, ?, ?, ?, ?)
  if (/INSERT\s+INTO\s+candidates/i.test(sqlStr)) {
    const newCandidate = {
      id: dbData.nextIds.candidates++,
      name: params[0],
      email: params[1] || null,
      phone: params[2] || null,
      raw_text: params[3] || null,
      file_path: params[4] || null,
      created_at: new Date().toISOString()
    };
    dbData.candidates.push(newCandidate);
    writeJsonDB(dbData);
    return { insertId: newCandidate.id };
  }

  // 5. INSERT INTO screenings (candidate_id, job_id, score, matched_skills, missing_skills, experience_relevance, education_alignment) VALUES (?, ?, ?, ?, ?, ?, ?)
  if (/INSERT\s+INTO\s+screenings/i.test(sqlStr)) {
    const newScreening = {
      id: dbData.nextIds.screenings++,
      candidate_id: parseInt(params[0], 10),
      job_id: parseInt(params[1], 10),
      score: parseInt(params[2], 10),
      matched_skills: params[3],
      missing_skills: params[4],
      experience_relevance: params[5] || '',
      education_alignment: params[6] || '',
      created_at: new Date().toISOString()
    };
    dbData.screenings.push(newScreening);
    writeJsonDB(dbData);
    return { insertId: newScreening.id };
  }

  // 6. SELECT screenings / candidates JOIN
  if (/SELECT\s+s\.id/i.test(sqlStr) && /JOIN\s+candidates/i.test(sqlStr)) {
    const jobId = parseInt(params[0], 10);
    const results = [];
    for (const s of dbData.screenings) {
      if (s.job_id === jobId) {
        const c = dbData.candidates.find(cand => cand.id === s.candidate_id);
        if (c) {
          results.push({
            screening_id: s.id,
            score: s.score,
            matched_skills: s.matched_skills,
            missing_skills: s.missing_skills,
            experience_relevance: s.experience_relevance,
            education_alignment: s.education_alignment,
            created_at: s.created_at,
            candidate_id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            file_path: c.file_path
          });
        }
      }
    }
    results.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.name.localeCompare(b.name);
    });
    return results;
  }

  // 7. SELECT file_path, name FROM candidates WHERE id = ?
  if (/SELECT\s+file_path\s*,\s*name\s+FROM\s+candidates\s+WHERE\s+id\s*=\s*\?/i.test(sqlStr)) {
    const candidate = dbData.candidates.find(c => c.id === parseInt(params[0], 10));
    return candidate ? [{ file_path: candidate.file_path, name: candidate.name }] : [];
  }

  // 8. DELETE FROM candidates WHERE id = ?
  if (/DELETE\s+FROM\s+candidates\s+WHERE\s+id\s*=\s*\?/i.test(sqlStr)) {
    const candidateId = parseInt(params[0], 10);
    dbData.candidates = dbData.candidates.filter(c => c.id !== candidateId);
    dbData.screenings = dbData.screenings.filter(s => s.candidate_id !== candidateId);
    writeJsonDB(dbData);
    return { affectedRows: 1 };
  }

  console.warn('Unhandled SQL query in fallback DB:', sqlStr);
  return [];
}

module.exports = {
  initDB,
  query,
  getPool: () => pool
};
