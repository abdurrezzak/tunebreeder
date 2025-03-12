import React, { useContext, useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tone from 'tone';
import { ThemeContext } from './context/ThemeContext';
import Navigation from './components/Navigation';
import './MyTunes.css';

const MyTunes = () => {
  const { darkMode } = useContext(ThemeContext);
  // State variables
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedMelodies, setSavedMelodies] = useState([]);
  const [selectedMelody, setSelectedMelody] = useState(null);
  const [parentalTree, setParentalTree] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [samplerLoaded, setSamplerLoaded] = useState(false);

  // Refs
  const samplerRef = useRef(null);
  const navigate = useNavigate();

  // --- Initialize Tone.js Sampler ---
  useEffect(() => {
    if (samplerRef.current) {
      samplerRef.current.dispose();
    }
    samplerRef.current = new Tone.Sampler({
      urls: {
        "A0": "A0.mp3",
        "C1": "C1.mp3",
        "Db1": "Db1.mp3",
        "F1": "F1.mp3",
        "A1": "A1.mp3",
        "C2": "C2.mp3",
        "Db2": "Db2.mp3",
        "F2": "F2.mp3",
        "A2": "A2.mp3",
        "C3": "C3.mp3",
        "Db3": "Db3.mp3",
        "F3": "F3.mp3",
        "A3": "A3.mp3",
        "C4": "C4.mp3",
        "Db4": "Db4.mp3",
        "F4": "F4.mp3",
        "A4": "A4.mp3",
        "C5": "C5.mp3",
        "Db5": "Db5.mp3",
        "F5": "F5.mp3",
        "A5": "A5.mp3",
        "C6": "C6.mp3",
        "Db6": "Db6.mp3",
        "F6": "F6.mp3",
        "A6": "A6.mp3",
        "C7": "C7.mp3",
        "Db7": "Db7.mp3",
        "F7": "F7.mp3",
        "A7": "A7.mp3",
        "C8": "C8.mp3"
      },
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => {
        console.log("Sampler loaded successfully");
        setSamplerLoaded(true);
      },
      onerror: (err) => {
        console.error("Error loading sampler:", err);
        createFallbackSynth();
      }
    }).toDestination();
    return () => {
      if (samplerRef.current) {
        samplerRef.current.dispose();
      }
    };
  }, []);

  // --- Fallback Synth ---
  const createFallbackSynth = () => {
    console.log("Creating fallback synth");
    samplerRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    samplerRef.current.set({
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
    });
    setSamplerLoaded(true);
  };

  // --- Helper: MIDI to Note ---
  const midiToNote = (midi) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteNames[midi % 12]}${octave}`;
  };

  // --- Fetch user and saved melodies data ---
  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }
      
      const response = await fetch('http://localhost:8000/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch user data');
      }
      
      const userData = await response.json();
      setUser(userData);
      fetchSavedMelodies();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedMelodies = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/melody/saved', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch saved melodies');
      const melodiesData = await response.json();
      setSavedMelodies(melodiesData);
    } catch (err) {
      console.error('Error fetching saved melodies:', err);
      setError('Failed to load your saved melodies');
    }
  };

  const fetchGenomeParentalTree = async (genomeId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/genome/${genomeId}/ancestry`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch genome ancestry');
      const ancestryData = await response.json();
      setParentalTree(ancestryData);
    } catch (err) {
      console.error('Error fetching genome ancestry:', err);
      setParentalTree(null);
      alert('Could not load the ancestry data for this melody');
    }
  };

  // --- Handle melody selection ---
  const handleSelectMelody = (melody) => {
    setSelectedMelody(melody);
    fetchGenomeParentalTree(melody.genome.id);
  };

  // --- Audio playback functions ---
  const genomeToNotes = (genomeData) => {
    if (Array.isArray(genomeData)) {
      return genomeData;
    }
    try {
      return JSON.parse(genomeData);
    } catch {
      return [];
    }
  };

  const playNote = (note) => {
    if (!samplerRef.current || !samplerLoaded) {
      console.warn("Sampler not ready yet");
      return;
    }
    try {
      const midi = note.pitch || 60;
      const noteName = midiToNote(midi);
      const duration = note.duration || 0.5;
      const velocity = note.velocity ? note.velocity / 127 : 0.7;
      samplerRef.current.triggerAttackRelease(noteName, duration, Tone.now(), velocity);
    } catch (err) {
      console.error("Error playing note:", err);
    }
  };

  const playMelody = async (genomeData, melodyId = null) => {
    stopPlaying();
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
    } catch (err) {
      console.error("Error starting Tone.js", err);
      alert("Could not start audio playback. Please try again.");
      return;
    }
    
    if (!samplerLoaded) {
      alert("Sound samples are still loading. Please try again shortly.");
      return;
    }
    
    const notes = genomeToNotes(genomeData);
    if (!notes.length) return;
    
    setIsPlaying(true);
    setCurrentPlayingId(melodyId);
    
    Tone.Transport.cancel();
    Tone.Transport.stop();
    
    let cumulativeTime = 0;
    notes.forEach((note) => {
      Tone.Transport.scheduleOnce(() => {
        playNote(note);
      }, cumulativeTime);
      cumulativeTime += note.duration;
    });
    
    Tone.Transport.scheduleOnce(() => {
      stopPlaying();
    }, cumulativeTime);
    
    Tone.Transport.start();
  };

  const stopPlaying = () => {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    setIsPlaying(false);
    setCurrentPlayingId(null);
  };

  // --- Delete melody function ---
  const deleteMelody = async (melodyId) => {
    // Use window.confirm to avoid ESLint error
    if (!window.confirm('Are you sure you want to delete this melody?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/melody/${melodyId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to delete melody');
      
      // If the deleted melody is the currently selected one, clear the selection
      if (selectedMelody && selectedMelody.id === melodyId) {
        setSelectedMelody(null);
        setParentalTree(null);
      }
      
      // Refresh the saved melodies list
      fetchSavedMelodies();
      
    } catch (err) {
      console.error('Error deleting melody:', err);
      alert(`Error: ${err.message}`);
    }
  };

  // --- Render melody cards ---
  const MelodyCard = ({ melody }) => {
    const barHeights = useMemo(
      () => Array.from({ length: 8 }, () => 10 + Math.random() * 30),
      [melody.id]
    );
    
    const isActive = selectedMelody && selectedMelody.id === melody.id;
    const isCurrentlyPlaying = isPlaying && currentPlayingId === melody.id;
    
    return (
      <div 
        className={`melody-card ${isActive ? 'active' : ''}`}
        onClick={() => handleSelectMelody(melody)}
      >
        <h3>{melody.name}</h3>
        <p className="melody-description">{melody.description || 'No description'}</p>
        <div className="melody-info">
          <span>
            <i className="fas fa-layer-group"></i> Gen {melody.genome.generation}
          </span>
          <span>
            <i className="fas fa-star"></i> {Math.round(melody.genome.score)}/100
          </span>
        </div>
        <div className="melody-minivis">
          {barHeights.map((height, i) => (
            <div key={i} className="mini-bar" style={{ height: `${height}px` }}></div>
          ))}
        </div>
        <div className="melody-actions">
          <button
            className={`play-btn ${isCurrentlyPlaying ? 'playing' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              isCurrentlyPlaying
                ? stopPlaying()
                : playMelody(melody.genome.data, melody.id);
            }}
            disabled={!samplerLoaded}
          >
            {isCurrentlyPlaying ? (
              <>
                <i className="fas fa-stop"></i> Stop
              </>
            ) : (
              <>
                <i className="fas fa-play"></i> {samplerLoaded ? 'Play' : 'Loading...'}
              </>
            )}
          </button>
          <button 
            className="delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              deleteMelody(melody.id);
            }}
          >
            <i className="fas fa-trash"></i>
          </button>
        </div>
      </div>
    );
  };

  // --- Render genome tree visualization ---
  const GenomeTreeVisualization = ({ tree }) => {
    if (!tree || !tree.nodes || tree.nodes.length === 0) {
      return (
        <div className="no-ancestry">
          <i className="fas fa-dna"></i>
          <p>No ancestry data available for this melody</p>
        </div>
      );
    }

    // Group nodes by generation for a tree-like layout
    const nodesByGeneration = {};
    tree.nodes.forEach(node => {
      const gen = node.generation || 0;
      if (!nodesByGeneration[gen]) {
        nodesByGeneration[gen] = [];
      }
      nodesByGeneration[gen].push(node);
    });

    const generations = Object.keys(nodesByGeneration).sort((a, b) => a - b);

    return (
      <div className="genome-tree">
        <h3>Evolution Path <span className="evolution-note">(Focusing on highest-scoring ancestry)</span></h3>
        <div className="tree-visualization">
          {generations.map(gen => (
            <div key={gen} className="tree-generation">
              <div className="generation-label">Gen {gen}</div>
              <div className="generation-nodes">
                {nodesByGeneration[gen].map(node => {
                  const isSelected = selectedMelody && selectedMelody.genome.id === node.id;
                  const isPlaying = currentPlayingId === `tree_${node.id}`;
                  const isMainBranch = node.is_main_branch;
                  
                  return (
                    <div 
                      key={node.id} 
                      className={`tree-node ${isSelected ? 'selected' : ''} ${isPlaying ? 'playing' : ''} ${isMainBranch ? 'main-branch' : ''}`}
                    >
                      <div className="node-id">
                        <i className="fas fa-fingerprint"></i> {node.id}
                      </div>
                      <div className="node-score">
                        <i className="fas fa-star"></i> {Math.round(node.score)}
                        {isMainBranch && <span className="main-branch-indicator" title="Main evolutionary path"><i className="fas fa-route"></i></span>}
                      </div>
                      <div className="node-controls">
                        <button
                          className="node-play-btn"
                          onClick={() => {
                            isPlaying
                              ? stopPlaying()
                              : playMelody(node.data, `tree_${node.id}`);
                          }}
                          disabled={!samplerLoaded}
                        >
                          {isPlaying ? (
                            <i className="fas fa-stop"></i>
                          ) : (
                            <i className="fas fa-play"></i>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        
        <div className="tree-legend">
          <div className="legend-item">
            <span className="main-branch-dot"></span> Main evolutionary branch
          </div>
          <div className="legend-item">
            <span className="secondary-branch-dot"></span> Secondary contributions
          </div>
        </div>
      </div>
    );
  };

  // --- Render melody details ---
  const MelodyDetails = ({ melody }) => {
    if (!melody) return null;

    return (
      <div className="melody-details">
        <div className="melody-header">
          <h2>{melody.name}</h2>
          <div className="melody-timestamp">
            <i className="fas fa-clock"></i> Saved on {new Date(melody.created_at).toLocaleDateString()}
          </div>
        </div>

        <div className="melody-body">
          <div className="melody-description-full">
            <h3>Description</h3>
            <p>{melody.description || 'No description provided.'}</p>
          </div>
          
          <div className="melody-stats">
            <div className="stat-item">
              <span className="stat-label">Generation</span>
              <span className="stat-value">{melody.genome.generation}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Score</span>
              <span className="stat-value">{Math.round(melody.genome.score)}/100</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Genome ID</span>
              <span className="stat-value">{melody.genome.id}</span>
            </div>
          </div>

          <div className="melody-visualization">
            <h3>Melody Pattern</h3>
            <StickRoll notes={genomeToNotes(melody.genome.data)} />
          </div>
          
          <div className="melody-actions-full">
            <button
              className={`action-btn play ${isPlaying && currentPlayingId === melody.id ? 'playing' : ''}`}
              onClick={() =>
                isPlaying && currentPlayingId === melody.id
                  ? stopPlaying()
                  : playMelody(melody.genome.data, melody.id)
              }
              disabled={!samplerLoaded}
            >
              {isPlaying && currentPlayingId === melody.id ? (
                <>
                  <i className="fas fa-stop"></i> Stop Playback
                </>
              ) : (
                <>
                  <i className="fas fa-play"></i> {samplerLoaded ? 'Play Melody' : 'Loading sounds...'}
                </>
              )}
            </button>
            <button className="action-btn delete" onClick={() => deleteMelody(melody.id)}>
              <i className="fas fa-trash"></i> Delete Melody
            </button>
          </div>
        </div>
      </div>
    );
  };

  // --- StickRoll component for melody visualization ---
  const StickRoll = ({ notes = [] }) => {
    const DURATION_SCALE = 80;
    const BASE_HEIGHT = 20;
    
    return (
      <div
        className="stickroll-container"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "5px",
          maxHeight: "250px",
          overflowY: "auto",
          overflowX: "hidden",
          padding: "10px",
          background: "rgba(250, 245, 255, 0.5)"
        }}
      >
        {notes.map((note, i) => {
          const pitch = note.pitch ?? Math.round(note.frequency ?? 60);
          const duration = note.duration ?? 0.5;
          const velocity = note.velocity ?? 80;
          const MIN_PITCH = 36;
          const MAX_PITCH = 96;
          const clampedPitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
          const normalizedPitch = (clampedPitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH);
          const hue = 260 + normalizedPitch * 20;
          const saturation = 70 + normalizedPitch * 30;
          const lightness = 30 + (1 - normalizedPitch) * 30;
          const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
          const barWidth = duration * DURATION_SCALE;
          
          return (
            <div
              key={i}
              style={{
                width: `${barWidth}px`,
                height: `${BASE_HEIGHT}px`,
                backgroundColor: backgroundColor,
                borderRadius: "4px",
                flexShrink: 0,
              }}
              title={`Pitch: ${pitch}, Dur: ${duration}, Vel: ${velocity}`}
            />
          );
        })}
      </div>
    );
  };

  // --- Main render function ---
  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your melodies...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Oops! Something went wrong</h2>
        <p>{error}</p>
        <button className="primary-btn" onClick={() => navigate('/login')}>
          Go back to login
        </button>
      </div>
    );
  }

  return (
    <div className={`mytunes-page ${darkMode ? 'dark-mode' : ''}`}>
      {/* Replace the header with the Navigation component */}
      <Navigation user={user} />

      {/* MAIN CONTENT */}
      <main className="mytunes-content">
        <h1 className="page-title"><i className="fas fa-album-collection"></i> My Tunes</h1>
        
        <div className="mytunes-layout">
          {/* Left side - Melodies grid */}
          <div className="melodies-section">
            <h2>Your Saved Melodies</h2>
            {savedMelodies.length > 0 ? (
              <div className="melodies-grid">
                {savedMelodies.map(melody => (
                  <MelodyCard key={melody.id} melody={melody} />
                ))}
              </div>
            ) : (
              <div className="no-melodies">
                <i className="fas fa-music melody-icon"></i>
                <p>You haven't saved any melodies yet.</p>
                <p>Go to the home page to explore and save melodies!</p>
                <button className="action-btn" onClick={() => navigate('/')}>
                  <i className="fas fa-home"></i> Go to Home
                </button>
              </div>
            )}
          </div>
          
          {/* Right side - Melody details and ancestry */}
          <div className="details-section">
            {selectedMelody ? (
              <>
                <MelodyDetails melody={selectedMelody} />
                <GenomeTreeVisualization tree={parentalTree} />
              </>
            ) : (
              <div className="no-selection">
                <i className="fas fa-hand-pointer"></i>
                <p>Select a melody from your collection to view its details and ancestry</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="app-footer">
        <p>&copy; 2025 TuneBreeder - Evolving Music Together</p>
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default MyTunes;