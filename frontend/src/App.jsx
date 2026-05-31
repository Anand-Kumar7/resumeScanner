import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Briefcase, 
  FileText, 
  UploadCloud, 
  Trash2, 
  Search, 
  Download, 
  X, 
  Mail, 
  Phone, 
  FileSpreadsheet, 
  Sparkles, 
  Plus, 
  Database 
} from 'lucide-react';
import { useToast } from './components/useToast.js';
import './App.css';

const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/api';

function App() {
  const toast = useToast();

  // State Management
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [jdTitle, setJdTitle] = useState('');
  const [jdDescription, setJdDescription] = useState('');
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [screenings, setScreenings] = useState([]);
  const [selectedScreening, setSelectedScreening] = useState(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingJd, setIsLoadingJd] = useState(false);
  const [isFetchingScreenings, setIsFetchingScreenings] = useState(false);
  const [dbConnected, setDbConnected] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('score-desc'); // score-desc, score-asc, name-asc, name-desc

  const fileInputRef = useRef(null);
  const jdFileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  // API Call: Fetch all job descriptions
  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data);
        setDbConnected(true);
        setSelectedJobId(prev => prev || (data.length > 0 ? data[0].id.toString() : 'new'));
      } else {
        throw new Error('Failed to load jobs');
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
      setDbConnected(false);
    }
  }, []);

  // API Call: Fetch screenings for specific job
  const fetchScreenings = useCallback(async (jobId) => {
    setIsFetchingScreenings(true);
    try {
      const response = await fetch(`${API_BASE}/screenings/job/${jobId}`);
      if (response.ok) {
        const data = await response.json();
        setScreenings(data);
      } else {
        throw new Error('Failed to load screenings');
      }
    } catch (error) {
      console.error('Error fetching screenings:', error);
    } finally {
      setIsFetchingScreenings(false);
    }
  }, []);

  // Initial Data Load
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Fetch rankings whenever job selection changes
  useEffect(() => {
    if (selectedJobId && selectedJobId !== 'new') {
      fetchScreenings(selectedJobId);
    }
  }, [selectedJobId, fetchScreenings]);

  const selectedJob = selectedJobId && selectedJobId !== 'new'
    ? jobs.find(job => job.id === parseInt(selectedJobId, 10))
    : null;

  const displayedJdDescription = selectedJob ? selectedJob.description : jdDescription;

  // API Call: Save new Job Description
  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!jdTitle.trim() || !jdDescription.trim()) return;

    setIsCreatingJob(true);
    try {
      const response = await fetch(`${API_BASE}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: jdTitle, description: jdDescription })
      });

      if (response.ok) {
        const newJob = await response.json();
        setJobs([newJob, ...jobs]);
        setSelectedJobId(newJob.id.toString());
        toast.success('Job Description saved! Now upload resumes for this role.');
      } else {
        throw new Error('Failed to save Job Description');
      }
    } catch (error) {
      console.error('Error saving job:', error);
      toast.error('Error connecting to backend database.');
    } finally {
      setIsCreatingJob(false);
    }
  };

  const handleJdFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('jd', file);
    setIsLoadingJd(true);

    try {
      const response = await fetch(`${API_BASE}/jobs/parse`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not read this Job Description file.');
      }

      setSelectedJobId('new');
      setJdTitle(prev => prev.trim() || data.title || 'Imported Job Description');
      setJdDescription(data.description || '');
      toast.success('Job Description imported. Review it, then save the job profile.');
    } catch (error) {
      console.error('Error importing JD:', error);
      toast.error(error.message);
    } finally {
      setIsLoadingJd(false);
    }
  };

  const startNewJobProfile = () => {
    setSelectedJobId('new');
    setJdTitle('');
    setJdDescription('');
    setSelectedScreening(null);
  };

  const handleJobSelection = (value) => {
    if (value === 'new') {
      startNewJobProfile();
      return;
    }
    setSelectedJobId(value);
  };

  // Drag and Drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
  };

  const addFilesToQueue = (fileList) => {
    const validExtensions = ['.pdf', '.doc', '.docx', '.txt'];
    const added = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      
      if (validExtensions.includes(ext)) {
        // Prevent duplicate file uploads in the current queue
        if (!uploadedFiles.some(f => f.name === file.name && f.size === file.size)) {
          added.push(file);
        }
      } else {
        toast.warning(`File "${file.name}" has an unsupported format. Please upload PDF, DOC, or DOCX.`);
      }
    }

    setUploadedFiles(prev => [...prev, ...added]);
  };

  const removeFileFromQueue = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // API Call: Upload & Screen Queue
  const handleScreenResumes = async () => {
    if (uploadedFiles.length === 0) {
      toast.warning('Please add at least one resume file.');
      return;
    }
    
    let activeJobId = selectedJobId;

    // Auto-save job first if we are on the "Create New" screen
    if (selectedJobId === 'new' || !selectedJobId) {
      if (!jdTitle.trim() || !jdDescription.trim()) {
        toast.warning('Please fill out the Job Description details first.');
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: jdTitle, description: jdDescription })
        });
        if (response.ok) {
          const newJob = await response.json();
          setJobs([newJob, ...jobs]);
          activeJobId = newJob.id.toString();
          setSelectedJobId(activeJobId);
        } else {
          throw new Error('Auto-saving job failed');
        }
      } catch (err) {
        console.error(err);
        toast.error('Could not save Job Description prior to uploading resumes.');
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    const formData = new FormData();
    formData.append('jobId', activeJobId);
    uploadedFiles.forEach(file => {
      formData.append('resumes', file);
    });

    try {
      const response = await fetch(`${API_BASE}/screenings/upload`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.failureCount > 0) {
          toast.warning(`Screened ${data.successCount} resume(s). ${data.failureCount} file(s) failed parsing.`);
        } else {
          toast.success(`Completed screening! Screened ${data.successCount} candidate(s).`);
        }

        // Refresh rankings list for this job
        fetchScreenings(activeJobId);
        setUploadedFiles([]); // Clear upload queue
      } else {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error uploading resumes');
      }
    } catch (error) {
      console.error(error);
      toast.error(`Error during screening: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // API Call: Delete Candidate
  const handleDeleteCandidate = async (e, candidateId) => {
    e.stopPropagation(); // Stop row click drawer activation
    if (!window.confirm('Are you sure you want to delete this candidate and their screening results?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/candidates/${candidateId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setScreenings(prev => prev.filter(s => s.candidateId !== candidateId));
        if (selectedScreening && selectedScreening.candidateId === candidateId) {
          setSelectedScreening(null);
        }
      } else {
        toast.error('Failed to delete candidate.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Network error deleting candidate.');
    }
  };

  // Helper: Client side Search & Filtering
  const activeScreenings = selectedJobId && selectedJobId !== 'new' ? screenings : [];

  const filteredScreenings = activeScreenings
    .filter(item => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      
      const nameMatch = item.name.toLowerCase().includes(query);
      const skillMatch = item.matchedSkills.some(skill => skill.toLowerCase().includes(query));
      const emailMatch = item.email && item.email.toLowerCase().includes(query);

      return nameMatch || skillMatch || emailMatch;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score-desc':
          return b.score - a.score;
        case 'score-asc':
          return a.score - b.score;
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return b.score - a.score;
      }
    });

  // Action: Export rankings to CSV
  const handleExportCSV = () => {
    if (filteredScreenings.length === 0) return;

    // Header row
    const headers = ['Rank', 'Candidate Name', 'Email', 'Phone', 'Match Score (%)', 'Matching Skills', 'Missing Skills'];
    
    // Convert rows
    const rows = filteredScreenings.map((item, idx) => [
      idx + 1,
      `"${item.name.replace(/"/g, '""')}"`,
      item.email || 'N/A',
      item.phone || 'N/A',
      item.score,
      `"${item.matchedSkills.join(', ')}"`,
      `"${item.missingSkills.join(', ')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create download blob
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    
    const activeJobTitle = (selectedJob?.title || jdTitle || 'candidates')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    link.setAttribute('download', `rankings_${activeJobTitle}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper for Score colors
  const getScoreClass = (score) => {
    if (score >= 80) return 'high';
    if (score >= 50) return 'mid';
    return 'low';
  };

  return (
    <div className="app-container">
      {/* Header Panel */}
      <header className="app-header">
        <div className="logo-section">
          <Sparkles className="logo-icon" size={32} />
          <div className="logo-text">
            <h1>TalentMatch AI</h1>
            <span className="logo-tagline">AUTOMATED SCREENING & CANDIDATE RANKING</span>
          </div>
        </div>
        <div className="db-indicator">
          <Database size={14} />
          <span>MySQL Database:</span>
          <div className={`status-dot ${dbConnected ? '' : 'disconnected'}`}></div>
          <span>{dbConnected ? 'Connected' : 'Offline'}</span>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="dashboard-grid">
        
        {/* Left Column: Job Description & File Uploader */}
        <section className="left-column">
          
          {/* Job Description Card */}
          <div className="panel-card">
            <div className="panel-title">
              <Briefcase size={20} />
              <h2>Job Description</h2>
            </div>
            
            <div className="form-group">
              <label className="form-label">Select Active Role</label>
              <select 
                className="form-select"
                value={selectedJobId} 
                onChange={(e) => handleJobSelection(e.target.value)}
              >
                {jobs.map(job => (
                  <option key={job.id} value={job.id}>{job.title}</option>
                ))}
                <option value="new">+ Create New Role</option>
              </select>
            </div>

            {(selectedJobId === 'new' || jobs.length === 0) && (
              <form onSubmit={handleSaveJob}>
                <div className="form-group">
                  <label className="form-label">Role Title</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    placeholder="e.g., Senior Full-Stack Engineer"
                    value={jdTitle}
                    onChange={(e) => setJdTitle(e.target.value)}
                    style={{ paddingLeft: '12px' }}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Requirements & Skills</label>
                  <input
                    ref={jdFileInputRef}
                    type="file"
                    className="file-input"
                    accept=".pdf,.docx,.doc,.txt"
                    onChange={handleJdFileChange}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary import-jd-btn"
                    onClick={() => jdFileInputRef.current.click()}
                    disabled={isLoadingJd}
                  >
                    <FileText size={16} />
                    {isLoadingJd ? 'Importing JD...' : 'Import JD Document'}
                  </button>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Paste job details, duties, required skills (React, Node, MySQL, AWS, Docker...)"
                    value={jdDescription}
                    onChange={(e) => setJdDescription(e.target.value)}
                    required
                  ></textarea>
                </div>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  disabled={isCreatingJob}
                >
                  <Plus size={16} />
                  {isCreatingJob ? 'Saving Job...' : 'Save Job Profile'}
                </button>
              </form>
            )}

            {selectedJobId && selectedJobId !== 'new' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Requirements</label>
                  <div className="text-box" style={{ maxHeight: '180px', overflowY: 'auto', fontSize: '0.85rem' }}>
                    {displayedJdDescription}
                  </div>
                </div>
                <button 
                  className="btn btn-secondary" 
                  onClick={startNewJobProfile} 
                  style={{ width: '100%' }}
                >
                  Create Another Job Profile
                </button>
              </div>
            )}
          </div>

          {/* Resume Upload Panel */}
          <div className="panel-card">
            <div className="panel-title">
              <UploadCloud size={20} />
              <h2>Upload Resumes</h2>
            </div>

            <div 
              className={`upload-zone ${dragActive ? 'dragover' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                ref={fileInputRef}
                type="file" 
                className="file-input" 
                multiple 
                accept=".pdf,.docx,.doc,.txt"
                onChange={handleFileChange}
              />
              <div className="upload-icon-container">
                <UploadCloud size={40} />
              </div>
              <p className="upload-title">Drag & drop files here</p>
              <p className="upload-subtitle">or click to browse your folders</p>
              <span className="badge badge-matched" style={{ fontSize: '0.7rem' }}>
                PDF, DOCX, DOC, TXT (Max 10MB)
              </span>
            </div>

            {uploadedFiles.length > 0 && (
              <div>
                <div className="file-queue">
                  {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="file-queue-item">
                      <div className="file-details">
                        <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                        <span className="file-name">{file.name}</span>
                      </div>
                      <X 
                        size={14} 
                        className="file-remove" 
                        onClick={() => removeFileFromQueue(idx)} 
                      />
                    </div>
                  ))}
                </div>

                <button 
                  className="btn btn-primary" 
                  style={{ width: '100%', marginTop: '1.2rem' }}
                  onClick={handleScreenResumes}
                  disabled={isLoading}
                >
                  <Sparkles size={16} />
                  {isLoading ? 'Analyzing & Scoring...' : `Screen & Rank ${uploadedFiles.length} Resume(s)`}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Screenings Table & Metrics Dashboard */}
        <section className="right-column-panel">
          <div className="panel-card" style={{ minHeight: '520px' }}>
            <div className="results-header">
              <div className="results-top-bar">
                <div>
                  <h2 style={{ fontSize: '1.3rem' }}>Screening Results & Rankings</h2>
                  <span className="results-stats">
                    Showing {filteredScreenings.length} of {activeScreenings.length} candidates
                  </span>
                </div>
                
                {activeScreenings.length > 0 && (
                  <button className="btn btn-secondary" onClick={handleExportCSV}>
                    <FileSpreadsheet size={16} />
                    Export CSV
                  </button>
                )}
              </div>

              {activeScreenings.length > 0 && (
                <div className="results-top-bar">
                  <div className="search-container">
                    <Search className="search-icon" size={16} />
                    <input 
                      type="text" 
                      className="search-input" 
                      placeholder="Search candidates or skills..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="sort-container">
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sort By:</span>
                    <select 
                      className="form-select" 
                      style={{ width: '160px', padding: '6px 10px' }}
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option value="score-desc">Highest Score</option>
                      <option value="score-asc">Lowest Score</option>
                      <option value="name-asc">Name A-Z</option>
                      <option value="name-desc">Name Z-A</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Table Container */}
            {isFetchingScreenings ? (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <span>Fetching candidate records...</span>
              </div>
            ) : filteredScreenings.length > 0 ? (
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ width: '50px' }}>Rank</th>
                      <th>Candidate</th>
                      <th style={{ width: '80px' }}>Score</th>
                      <th>Matching Skills</th>
                      <th>Missing Skills</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredScreenings.map((item, idx) => {
                      const rank = sortBy === 'score-desc' ? idx + 1 : activeScreenings.findIndex(s => s.candidateId === item.candidateId) + 1;
                      return (
                        <tr key={item.candidateId} onClick={() => setSelectedScreening(item)}>
                          <td>
                            <div className="rank-badge">{rank}</div>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{item.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.email || 'No email'}</div>
                          </td>
                          <td>
                            <span className={`score-pill ${getScoreClass(item.score)}`}>
                              {item.score}%
                            </span>
                          </td>
                          <td>
                            <div className="skills-cell">
                              {item.matchedSkills.slice(0, 4).map((skill, sIdx) => (
                                <span key={sIdx} className="badge badge-matched">{skill}</span>
                              ))}
                              {item.matchedSkills.length > 4 && (
                                <span className="badge badge-matched">+{item.matchedSkills.length - 4} more</span>
                              )}
                              {item.matchedSkills.length === 0 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>None detected</span>}
                            </div>
                          </td>
                          <td>
                            <div className="skills-cell">
                              {item.missingSkills.slice(0, 4).map((skill, sIdx) => (
                                <span key={sIdx} className="badge badge-missing">{skill}</span>
                              ))}
                              {item.missingSkills.length > 4 && (
                                <span className="badge badge-missing">+{item.missingSkills.length - 4} more</span>
                              )}
                              {item.missingSkills.length === 0 && <span style={{ color: 'var(--color-success)', fontSize: '0.8rem' }}>No skills missing!</span>}
                            </div>
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="actions-cell">
                              <a 
                                href={`${API_BASE}/candidates/${item.candidateId}/resume`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="action-icon-btn"
                                title="Download / Preview Resume"
                              >
                                <Download size={15} />
                              </a>
                              <button 
                                className="action-icon-btn delete-btn" 
                                onClick={(e) => handleDeleteCandidate(e, item.candidateId)}
                                title="Delete Candidate"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <FileText className="empty-state-icon" size={60} />
                <h3 className="empty-state-title">No Candidates Screened Yet</h3>
                <p className="empty-state-desc">
                  {selectedJobId && selectedJobId !== 'new'
                    ? 'Upload resumes on the left to analyze and rank candidates for this role.'
                    : 'Create a Job Profile first, then upload resumes to see rankings.'}
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Drawer: Detailed Profile View */}
      {selectedScreening && (
        <div className="drawer-backdrop" onClick={() => setSelectedScreening(null)}>
          <div className="drawer-content" onClick={(e) => e.stopPropagation()}>
            
            <div className="drawer-header">
              <div className="drawer-title-container">
                <h2 style={{ fontSize: '1.25rem' }}>{selectedScreening.name}</h2>
                <span className="drawer-subtitle">Candidate Assessment Details</span>
              </div>
              <button className="drawer-close" onClick={() => setSelectedScreening(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              
              {/* Score Assessment */}
              <div className="breakdown-row">
                <div>
                  <h3 style={{ fontSize: '1rem', marginBottom: '4px' }}>Matching Fit Score</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Weighted overall assessment relevance</p>
                </div>
                <div className={`score-circle-big ${getScoreClass(selectedScreening.score)}`}>
                  {selectedScreening.score}%
                </div>
              </div>

              {/* Contact Information */}
              <div className="detail-section">
                <span className="detail-section-title">Contact details</span>
                <div className="contact-grid">
                  <div className="contact-card">
                    <Mail size={14} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedScreening.email || 'Not extracted'}
                    </span>
                  </div>
                  <div className="contact-card">
                    <Phone size={14} />
                    <span>{selectedScreening.phone || 'Not extracted'}</span>
                  </div>
                </div>
              </div>

              {/* Experience Evaluation */}
              <div className="detail-section">
                <span className="detail-section-title">Experience Relevance</span>
                <p className="text-box">{selectedScreening.experienceRelevance || 'No additional experience text provided.'}</p>
              </div>

              {/* Education Evaluation */}
              <div className="detail-section">
                <span className="detail-section-title">Education Credentials</span>
                <p className="text-box">{selectedScreening.educationAlignment || 'No additional education text provided.'}</p>
              </div>

              {/* Matching Skills */}
              <div className="detail-section">
                <span className="detail-section-title">Matched Skills ({selectedScreening.matchedSkills.length})</span>
                <div className="skills-cell" style={{ maxW: '100%' }}>
                  {selectedScreening.matchedSkills.map((skill, idx) => (
                    <span key={idx} className="badge badge-matched">{skill}</span>
                  ))}
                  {selectedScreening.matchedSkills.length === 0 && (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching skills detected.</span>
                  )}
                </div>
              </div>

              {/* Missing Skills */}
              <div className="detail-section">
                <span className="detail-section-title">Missing Core Skills ({selectedScreening.missingSkills.length})</span>
                <div className="skills-cell" style={{ maxW: '100%' }}>
                  {selectedScreening.missingSkills.map((skill, idx) => (
                    <span key={idx} className="badge badge-missing">{skill}</span>
                  ))}
                  {selectedScreening.missingSkills.length === 0 && (
                    <span style={{ color: 'var(--color-success)', fontSize: '0.85rem' }}>Perfect skills match! No missing skills.</span>
                  )}
                </div>
              </div>

            </div>

            <div className="drawer-footer">
              <a 
                href={`${API_BASE}/candidates/${selectedScreening.candidateId}/resume`} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-secondary"
              >
                <Download size={16} />
                Open Original Resume
              </a>
              <button className="btn btn-primary" onClick={() => setSelectedScreening(null)}>
                Close Panel
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
