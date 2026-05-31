const { GoogleGenAI, GoogleGenAIPermalink } = require('@google/generative-ai');
const path = require('path');
require('dotenv').config();

// Predefined set of common tech/industry skills for local fallback analysis
const SKILLS_DICTIONARY = [
  'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby', 'php', 'swift', 'kotlin', 'go', 'rust',
  'react', 'angular', 'vue', 'next.js', 'nuxt.js', 'svelte', 'jquery', 'bootstrap', 'tailwind', 'sass', 'css', 'html',
  'node.js', 'express', 'django', 'flask', 'spring boot', 'laravel', 'asp.net', 'fastapi',
  'mysql', 'postgresql', 'mongodb', 'sqlite', 'redis', 'oracle', 'mariadb', 'dynamodb', 'sql', 'nosql',
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'github', 'gitlab', 'ci/cd', 'terraform',
  'graphql', 'rest api', 'soap', 'microservices', 'serverless',
  'agile', 'scrum', 'jira', 'confluence', 'testing', 'jest', 'cypress', 'mocha', 'selenium',
  'machine learning', 'deep learning', 'data science', 'ai', 'nlp', 'pytorch', 'tensorflow', 'pandas', 'numpy',
  'figma', 'ui/ux', 'photoshop', 'illustrator', 'product management', 'project management'
];

/**
 * Main function to evaluate a resume against a job description.
 * Checks for Gemini API Key first; falls back to rules-based keyword comparison if not available.
 * @param {string} resumeText - Full text extracted from candidate resume
 * @param {string} jdText - Job Description text
 * @returns {Promise<object>} Analysis results
 */
async function scoreResume(resumeText, jdText) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      console.log('Gemini API key found. Running AI scoring...');
      return await scoreWithGemini(resumeText, jdText, apiKey);
    } catch (error) {
      console.error('Gemini scoring failed, falling back to local scoring:', error.message);
      return scoreLocally(resumeText, jdText);
    }
  } else {
    console.log('No Gemini API key found. Running local fallback scoring...');
    return scoreLocally(resumeText, jdText);
  }
}

/**
 * Score resume using Gemini API
 */
async function scoreWithGemini(resumeText, jdText, apiKey) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  
  // Use gemini-2.5-flash as it is fast, cost-effective, and highly accurate for text tasks
  const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
    You are an expert HR Resume Screener and Recruiter. Analyze the following candidate Resume against the Job Description (JD).
    
    Extract the candidate's name, email, and phone number.
    Evaluate the candidate on the following criteria:
    1. Skills Match: Compare skills found in the resume against skills required in the JD.
    2. Experience Relevance: How well does their career history align with the requirements?
    3. Education Alignment: Does their educational background meet the JD's criteria?
    4. Keyword Similarity: Overall semantic and terminological similarity.

    Provide an overall score from 0 to 100 reflecting how well the candidate fits the role.

    Return a JSON object with this exact structure:
    {
      "candidateName": "Candidate Name or 'Unknown Candidate'",
      "email": "extracted email or null",
      "phone": "extracted phone or null",
      "score": 85, // integer 0-100
      "matchedSkills": ["skill1", "skill2"], // array of matching skills
      "missingSkills": ["missing_skill1", "missing_skill2"], // array of key required skills missing from the resume
      "experienceRelevance": "Detailed explanation of experience relevance and years of fit",
      "educationAlignment": "Detailed explanation of education relevance"
    }

    Resume Text:
    """
    ${resumeText}
    """

    Job Description (JD) Text:
    """
    ${jdText}
    """
  `;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();
  
  try {
    return JSON.parse(responseText);
  } catch (parseError) {
    console.error('Failed to parse Gemini JSON response:', responseText);
    throw parseError;
  }
}

/**
 * Score resume locally (fallback rules engine)
 */
function scoreLocally(resumeText, jdText) {
  const normalizedResume = resumeText.toLowerCase();
  const normalizedJD = jdText.toLowerCase();

  // 1. Extract contact information using RegEx
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+?\d{1,4}[-.\s]??)?(\(?\d{3}\)?[-.\s]??\d{3}[-.\s]??\d{4})/g;

  const emailMatch = resumeText.match(emailRegex);
  const phoneMatch = resumeText.match(phoneRegex);

  const email = emailMatch ? emailMatch[0] : null;
  const phone = phoneMatch ? phoneMatch[0] : null;

  // 2. Extract Name (Heuristic: Look at first 3 non-empty lines, find first line without emails/phones/websites)
  let candidateName = 'Unknown Candidate';
  const lines = resumeText.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.includes('@') && !line.match(/https?:\/\//) && !line.match(/\.com|\.org|\.in/));

  if (lines.length > 0) {
    // Take the first line, limit length, clean up common words
    const candidateLine = lines[0];
    if (candidateLine.length < 50 && !/resume|curriculum|cv/i.test(candidateLine)) {
      candidateName = candidateLine;
    }
  }

  // 3. Extract Skills from Resume and JD
  const jdSkills = [];
  const resumeSkills = [];

  SKILLS_DICTIONARY.forEach(skill => {
    // Use word boundaries or sub-string logic carefully
    const escapedSkill = skill.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const skillRegex = new RegExp(`\\b${escapedSkill}\\b|\\b${escapedSkill}\\.js\\b`, 'i');

    if (skillRegex.test(normalizedJD)) {
      jdSkills.push(skill);
    }
    if (skillRegex.test(normalizedResume)) {
      resumeSkills.push(skill);
    }
  });

  // Unique list
  const uniqueJdSkills = [...new Set(jdSkills)];
  const uniqueResumeSkills = [...new Set(resumeSkills)];

  const matchedSkills = uniqueResumeSkills.filter(skill => uniqueJdSkills.includes(skill));
  const missingSkills = uniqueJdSkills.filter(skill => !uniqueResumeSkills.includes(skill));

  // 4. Calculate Scores
  // A. Skills Score (Max 50 points)
  let skillsScore = 0;
  if (uniqueJdSkills.length > 0) {
    skillsScore = (matchedSkills.length / uniqueJdSkills.length) * 50;
  } else {
    // If JD has no detectable skills, check how many dictionary skills are in the resume
    skillsScore = Math.min((uniqueResumeSkills.length / 10) * 50, 50);
  }

  // B. Experience Match (Max 25 points)
  // Search for phrases like "X years of experience" in resume
  let candidateYears = 0;
  const expRegex = /(\d+)\+?\s*(?:year|yr)s?\s*(?:of)?\s*(?:experience|exp|work)/gi;
  let match;
  while ((match = expRegex.exec(resumeText)) !== null) {
    const years = parseInt(match[1], 10);
    if (years > candidateYears && years < 40) {
      candidateYears = years;
    }
  }

  // Find JD required years
  let requiredYears = 0;
  let jdMatch;
  while ((jdMatch = expRegex.exec(jdText)) !== null) {
    const years = parseInt(jdMatch[1], 10);
    if (years > requiredYears && years < 40) {
      requiredYears = years;
    }
  }

  let experienceScore = 15; // default base score
  let expRelevanceText = 'Experience relevance estimated based on keyword overlap.';
  if (candidateYears > 0) {
    if (requiredYears > 0) {
      if (candidateYears >= requiredYears) {
        experienceScore = 25;
        expRelevanceText = `Candidate has ${candidateYears} years of experience, meeting/exceeding the required ${requiredYears} years.`;
      } else {
        experienceScore = Math.max(10, Math.round((candidateYears / requiredYears) * 25));
        expRelevanceText = `Candidate has ${candidateYears} years of experience, which is below the required ${requiredYears} years.`;
      }
    } else {
      experienceScore = 20;
      expRelevanceText = `Candidate has ${candidateYears} years of experience.`;
    }
  } else {
    // Try to check for simple keyword matches like "Senior", "Lead", "Junior"
    const hasSeniorJD = /senior|lead|architect|manager/i.test(normalizedJD);
    const hasSeniorResume = /senior|lead|architect|manager/i.test(normalizedResume);
    if (hasSeniorJD && !hasSeniorResume) {
      experienceScore = 10;
      expRelevanceText = 'Role requires Senior/Lead level experience. Candidate resume shows mostly junior/mid keywords.';
    } else if (hasSeniorJD && hasSeniorResume) {
      experienceScore = 20;
      expRelevanceText = 'Candidate profile matches Senior/Lead keywords specified in Job Description.';
    }
  }

  // C. Education Match (Max 15 points)
  let educationScore = 10; // Default base
  let eduAlignmentText = 'Education alignment evaluated by keyword checking.';
  const degrees = [
    { name: 'phd', keywords: [/ph\.?d/i, /doctor of philosophy/i], weight: 3 },
    { name: 'master', keywords: [/master/i, /m\.?s/i, /m\.?tech/i, /m\.?b\.?a/i], weight: 2 },
    { name: 'bachelor', keywords: [/bachelor/i, /b\.?s/i, /b\.?tech/i, /b\.?e\b/i], weight: 1 }
  ];

  let jdDegreeWeight = 0;
  let resumeDegreeWeight = 0;

  degrees.forEach(deg => {
    const isJdDegree = deg.keywords.some(regex => regex.test(normalizedJD));
    const isResumeDegree = deg.keywords.some(regex => regex.test(normalizedResume));

    if (isJdDegree && deg.weight > jdDegreeWeight) jdDegreeWeight = deg.weight;
    if (isResumeDegree && deg.weight > resumeDegreeWeight) resumeDegreeWeight = deg.weight;
  });

  if (jdDegreeWeight > 0) {
    if (resumeDegreeWeight >= jdDegreeWeight) {
      educationScore = 15;
      eduAlignmentText = 'Candidate education credentials meet or exceed the degree required in the JD.';
    } else if (resumeDegreeWeight > 0) {
      educationScore = 12;
      eduAlignmentText = 'Candidate has a degree, but it is below the level requested in the JD.';
    } else {
      educationScore = 5;
      eduAlignmentText = 'Could not explicitly verify required degree level in candidate resume.';
    }
  } else {
    if (resumeDegreeWeight > 0) {
      educationScore = 15;
      eduAlignmentText = 'Candidate has a college degree.';
    }
  }

  // D. General Keyword Similarity (Max 10 points)
  // Simple word count overlap (intersection of unique words)
  const jdWords = new Set(normalizedJD.split(/[^a-zA-Z]+/).filter(w => w.length > 3));
  const resumeWords = new Set(normalizedResume.split(/[^a-zA-Z]+/).filter(w => w.length > 3));
  let overlapCount = 0;
  jdWords.forEach(w => {
    if (resumeWords.has(w)) overlapCount++;
  });
  const similarityScore = jdWords.size > 0 ? Math.min((overlapCount / jdWords.size) * 10, 10) : 5;

  // 5. Compute Final Rounded Score
  const totalScore = Math.min(100, Math.round(skillsScore + experienceScore + educationScore + similarityScore));

  return {
    candidateName,
    email,
    phone,
    score: totalScore,
    matchedSkills: matchedSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)), // Title case
    missingSkills: missingSkills.map(s => s.charAt(0).toUpperCase() + s.slice(1)),
    experienceRelevance: expRelevanceText,
    educationAlignment: eduAlignmentText
  };
}

module.exports = {
  scoreResume
};
