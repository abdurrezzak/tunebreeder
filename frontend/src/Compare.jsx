import React, { useContext, useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Tone from 'tone';
import { ThemeContext } from './context/ThemeContext';
import Navigation from './components/Navigation';
import './Compare.css';

const Compare = () => {
  const { darkMode } = useContext(ThemeContext);
  const [melodyIds, setMelodyIds] = useState({ first: '', second: '' });
  const [melodies, setMelodies] = useState({ first: null, second: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [samplerLoaded, setSamplerLoaded] = useState(false);
  const [playingIndices, setPlayingIndices] = useState({ first: -1, second: -1 });
  const [savedMelodies, setSavedMelodies] = useState([]);
  const [showMelodySelector, setShowMelodySelector] = useState(false);
  const [selectorType, setSelectorType] = useState('first'); // 'first' or 'second'
  const [user, setUser] = useState(null);
  const [showFirstData, setShowFirstData] = useState(false);
  const [showSecondData, setShowSecondData] = useState(false);
  const [ancestryInfo, setAncestryInfo] = useState(null);
  
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

  // --- Fetch genomes ---
  const fetchGenomes = async () => {
    if (!melodyIds.first || !melodyIds.second) {
      setError("Please enter both melody IDs to compare");
      return;
    }

    setLoading(true);
    setError(null);
    // Clear any previous ancestry info when starting a new comparison
    setAncestryInfo(null);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const authHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch both melodies in parallel
      const [firstResponse, secondResponse] = await Promise.all([
        fetch(`http://localhost:8000/api/genome/${melodyIds.first}`, {
          headers: authHeaders
        }),
        fetch(`http://localhost:8000/api/genome/${melodyIds.second}`, {
          headers: authHeaders
        })
      ]);

      // Handle specific error cases more gracefully
      if (!firstResponse.ok) {
        if (firstResponse.status === 401) {
          // Authentication error
          localStorage.removeItem('token'); // Clear invalid token
          navigate('/login', { state: { message: "Your session has expired. Please log in again." } });
          return;
        }
        throw new Error(`Melody with ID ${melodyIds.first} not found or is inaccessible.`);
      }
      if (!secondResponse.ok) {
        if (secondResponse.status === 401) {
          // Authentication error
          localStorage.removeItem('token'); // Clear invalid token
          navigate('/login', { state: { message: "Your session has expired. Please log in again." } });
          return;
        }
        throw new Error(`Melody with ID ${melodyIds.second} not found or is inaccessible.`);
      }

      const firstGenome = await firstResponse.json();
      const secondGenome = await secondResponse.json();

      const loadedMelodies = {
        first: firstGenome,
        second: secondGenome
      };
      
      // Set melodies first
      setMelodies(loadedMelodies);
      
      // Then immediately fetch the common ancestry with the loaded data instead of the state
      // This avoids any timing issues with state updates
      await fetchCommonAncestryWithData(loadedMelodies);
      
    } catch (err) {
      console.error("Error fetching genomes:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Fetch saved melodies ---
  const fetchSavedMelodies = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('http://localhost:8000/api/melody/saved', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          navigate('/login', { state: { message: "Your session has expired. Please log in again." } });
          return;
        }
        throw new Error('Failed to fetch saved melodies');
      }
      
      const melodiesData = await response.json();
      setSavedMelodies(melodiesData);
    } catch (err) {
      console.error('Error fetching saved melodies:', err);
      setError('Could not load your saved melodies for selection');
    }
  };

  // --- Load melodies when the selector is opened ---
  useEffect(() => {
    if (showMelodySelector) {
      fetchSavedMelodies();
    }
  }, [showMelodySelector]);

  // --- Parse genome data to notes ---
  const genomeToNotes = (genomeData) => {
    if (!genomeData) return [];
    if (Array.isArray(genomeData)) {
      return genomeData;
    }
    try {
      return JSON.parse(genomeData);
    } catch {
      return [];
    }
  };

  // --- Play note function ---
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

  // --- Play both melodies side by side ---
  const playComparison = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!melodies.first || !melodies.second) {
      setError("Both melodies must be loaded before playing");
      return;
    }

    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
    } catch (err) {
      console.error("Error starting audio context", err);
      setError("Could not start audio playback. Please try again.");
      return;
    }

    const firstNotes = genomeToNotes(melodies.first.data);
    const secondNotes = genomeToNotes(melodies.second.data);

    if (firstNotes.length === 0 && secondNotes.length === 0) {
      setError("Both melodies have no notes to play");
      return;
    }

    setIsPlaying(true);
    Tone.Transport.cancel();
    Tone.Transport.stop();

    // Calculate the maximum number of notes to play
    const maxLength = Math.max(firstNotes.length, secondNotes.length);
    let cumulativeTime = 0;

    // Schedule playback of both melodies
    for (let i = 0; i < maxLength; i++) {
      const idx = i; // Closure for correct index in callback

      Tone.Transport.scheduleOnce(() => {
        setPlayingIndices({ first: idx < firstNotes.length ? idx : -1, second: idx < secondNotes.length ? idx : -1 });

        // Play notes from both melodies if they exist
        if (idx < firstNotes.length) {
          playNote(firstNotes[idx]);
        }
        if (idx < secondNotes.length) {
          playNote(secondNotes[idx]);
        }
      }, cumulativeTime);

      // Determine time increment based on the longer note duration
      const firstDuration = idx < firstNotes.length ? firstNotes[idx].duration || 0.5 : 0;
      const secondDuration = idx < secondNotes.length ? secondNotes[idx].duration || 0.5 : 0;
      cumulativeTime += Math.max(firstDuration, secondDuration);
    }

    // Schedule stop at the end
    Tone.Transport.scheduleOnce(() => {
      stopPlayback();
    }, cumulativeTime);

    Tone.Transport.start();
  };

  // --- Stop playback function ---
  const stopPlayback = () => {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    setIsPlaying(false);
    setPlayingIndices({ first: -1, second: -1 });
  };

  // --- StickRoll component for melody visualization ---
  const StickRoll = ({ notes = [], playingIndex = -1, otherNotes = [] }) => {
    const DURATION_SCALE = 80;
    const BASE_HEIGHT = 20;
    
    // Function to check if a note is different from the corresponding note in the other melody
    const isDifferent = (note, index) => {
      if (!otherNotes || index >= otherNotes.length) return false;
      
      const otherNote = otherNotes[index];
      return (
        note.pitch !== otherNote.pitch ||
        note.duration !== otherNote.duration ||
        note.velocity !== otherNote.velocity
      );
    };
    
    return (
      <div className="stickroll-container">
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
          const different = isDifferent(note, i);
          
          return (
            <div
              key={i}
              className={`stick ${i === playingIndex ? 'playing' : ''} ${different ? 'different' : ''}`}
              style={{
                width: `${barWidth}px`,
                height: `${BASE_HEIGHT}px`,
                backgroundColor: backgroundColor,
              }}
              title={`Pitch: ${pitch}, Dur: ${duration}, Vel: ${velocity}${different ? ' - Different from other melody' : ''}`}
            />
          );
        })}
      </div>
    );
  };

// Replace the current AncestryTree component with this enhanced version

// --- AncestryTree component for visualizing the common ancestor ---
const AncestryTree = ({ ancestryInfo, melodyIds }) => {
  console.log("AncestryTree rendering with:", { ancestryInfo, melodyIds });
  
  if (!ancestryInfo || !ancestryInfo.hasCommonAncestor || !ancestryInfo.commonAncestor) {
    return null;
  }
  
  // Extract the data we need
  const commonAncestor = ancestryInfo.commonAncestor;
  const firstMelodyId = parseInt(melodyIds.first);
  const secondMelodyId = parseInt(melodyIds.second);
  
  // Use the ancestry paths if provided, otherwise just show the endpoints
  const firstPath = ancestryInfo.firstPath || [];
  const secondPath = ancestryInfo.secondPath || [];
  
  // Calculate generation differences for display
  const firstGenDifference = ancestryInfo.firstGeneration - commonAncestor.generation || 0;
  const secondGenDifference = ancestryInfo.secondGeneration - commonAncestor.generation || 0;
  
  return (
    <div className="ancestry-tree">
      <h3>Evolutionary Tree View</h3>
      
      <div className="tree-container">
        {/* The common ancestor at the top */}
        <div className="tree-level">
          <div 
            className="tree-node lca"
            onClick={() => window.open(`/compare?first=${commonAncestor.id}&second=${melodyIds.first}`, '_blank')}
          >
            <div className="node-content">
              <div className="node-title">Common Ancestor</div>
              <div className="node-id">ID: {commonAncestor.id}</div>
              <div className="node-gen">Gen {commonAncestor.generation}</div>
              <div className="node-score"><i className="fas fa-star"></i> {Math.round(commonAncestor.score)}</div>
            </div>
          </div>
        </div>
        
        {/* Connecting lines from LCA */}
        <div className="tree-connections">
          <div className="line-left"></div>
          <div className="line-right"></div>
        </div>
        
        {/* Intermediate ancestors if available */}
        {(firstPath.length > 0 || secondPath.length > 0) && (
          <>
            <div className="tree-level intermediate-level">
              <div className="path-branch">
                {firstPath.length > 0 ? (
                  firstPath.map((ancestor, index) => (
                    <div 
                      key={`first-${ancestor.id}`} 
                      className={`tree-node intermediate ${index === 0 ? 'first-intermediate' : ''}`}
                    >
                      <div className="node-content">
                        <div className="node-id">ID: {ancestor.id}</div>
                        <div className="node-gen">Gen {ancestor.generation}</div>
                        <div className="node-score"><i className="fas fa-star"></i> {Math.round(ancestor.score)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="direct-path">Direct descendant</div>
                )}
              </div>
              
              <div className="path-branch">
                {secondPath.length > 0 ? (
                  secondPath.map((ancestor, index) => (
                    <div 
                      key={`second-${ancestor.id}`} 
                      className={`tree-node intermediate ${index === 0 ? 'first-intermediate' : ''}`}
                    >
                      <div className="node-content">
                        <div className="node-id">ID: {ancestor.id}</div>
                        <div className="node-gen">Gen {ancestor.generation}</div>
                        <div className="node-score"><i className="fas fa-star"></i> {Math.round(ancestor.score)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="direct-path">Direct descendant</div>
                )}
              </div>
            </div>
            
            {/* Additional connecting lines */}
            <div className="tree-connections">
              <div className="line-left"></div>
              <div className="line-right"></div>
            </div>
          </>
        )}
        
        {/* Bottom level with the two compared melodies */}
        <div className="tree-level bottom-level">
          <div className="tree-node current">
            <div className="node-content">
              <div className="node-title">Melody 1</div>
              <div className="node-id">ID: {firstMelodyId}</div>
              <div className="node-gen">
                Gen {ancestryInfo.firstGeneration || "?"}
                <span className="gen-distance">
                  ({firstGenDifference > 0 ? `+${firstGenDifference}` : firstGenDifference} gens)
                </span>
              </div>
              <div className="node-score"><i className="fas fa-star"></i> {Math.round(ancestryInfo.firstScore || 0)}</div>
            </div>
          </div>
          
          <div className="tree-node current">
            <div className="node-content">
              <div className="node-title">Melody 2</div>
              <div className="node-id">ID: {secondMelodyId}</div>
              <div className="node-gen">
                Gen {ancestryInfo.secondGeneration || "?"}
                <span className="gen-distance">
                  ({secondGenDifference > 0 ? `+${secondGenDifference}` : secondGenDifference} gens)
                </span>
              </div>
              <div className="node-score"><i className="fas fa-star"></i> {Math.round(ancestryInfo.secondScore || 0)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


  // --- MelodySelector component ---
  const MelodySelector = () => {
    return (
      <div className="melody-selector-overlay">
        <div className="melody-selector-modal">
          <div className="selector-header">
            <h3>Select a {selectorType === 'first' ? 'First' : 'Second'} Melody</h3>
            <button className="close-btn" onClick={() => setShowMelodySelector(false)}>
              <i className="fas fa-times"></i>
            </button>
          </div>
          
          {savedMelodies.length > 0 ? (
            <div className="melodies-list">
              {savedMelodies.map(melody => (
                <div 
                  key={melody.id}
                  className="selector-melody-item"
                  onClick={() => {
                    setMelodyIds(prev => ({
                      ...prev,
                      [selectorType]: melody.genome.id.toString()
                    }));
                    setShowMelodySelector(false);
                  }}
                >
                  <div className="selector-melody-info">
                    <h4>{melody.name}</h4>
                    <div className="selector-melody-details">
                      <span><i className="fas fa-fingerprint"></i> ID: {melody.genome.id}</span>
                      <span><i className="fas fa-layer-group"></i> Gen {melody.genome.generation}</span>
                      <span><i className="fas fa-star"></i> Score: {Math.round(melody.genome.score)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="no-melodies-message">
              <p>You don't have any saved melodies.</p>
              <button 
                className="primary-btn" 
                onClick={() => {
                  setShowMelodySelector(false);
                  navigate('/mytunes');
                }}
              >
                Go to My Tunes
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- Authentication check ---
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      try {
        const response = await fetch('http://localhost:8000/api/users/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('token');
            navigate('/login', { state: { message: "Your session has expired. Please log in again." } });
            return;
          }
          throw new Error('Failed to authenticate');
        }

        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Authentication error:", error);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate]);

  // Add this function to the Compare component

  // Modify the fetchCommonAncestry function to include more detailed logging

const fetchCommonAncestryWithData = async (melodyData) => {
  if (!melodyData.first || !melodyData.second) {
    console.log("Cannot fetch ancestry: melody data not provided");
    return;
  }

  try {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    const url = `http://localhost:8000/api/genomes/common-ancestry?id1=${melodyData.first.id}&id2=${melodyData.second.id}`;
    console.log(`Fetching common ancestry from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    console.log("Ancestry response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response from ancestry API:", errorText);
      throw new Error(`Failed to fetch ancestry: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log("Ancestry data received:", data);
    
    // Add explicit checks on the data structure
    if (data && typeof data === 'object') {
      console.log("Data structure check: hasCommonAncestor property exists:", 'hasCommonAncestor' in data);
      if ('hasCommonAncestor' in data && data.hasCommonAncestor) {
        console.log("Common ancestor data exists:", !!data.commonAncestor);
      }
    }
    
    setAncestryInfo(data);
  } catch (err) {
    console.error("Error fetching common ancestry:", err);
    setAncestryInfo({ 
      hasCommonAncestor: false, 
      error: err.message 
    });
  }
};

// Keep the old function for compatibility, but have it use the new one
const fetchCommonAncestry = async () => {
  if (!melodies.first || !melodies.second) {
    console.log("Cannot fetch ancestry: melodies not loaded");
    return;
  }
  
  await fetchCommonAncestryWithData(melodies);
};

  // Add this effect to handle URL parameters

  useEffect(() => {
    // Extract melody IDs from URL parameters if present
    const searchParams = new URLSearchParams(window.location.search);
    const firstId = searchParams.get('first');
    const secondId = searchParams.get('second');
    
    if (firstId) {
      setMelodyIds(prev => ({ ...prev, first: firstId }));
    }
    if (secondId) {
      setMelodyIds(prev => ({ ...prev, second: secondId }));
    }
    
    // If both IDs are present, fetch the genomes automatically
    if (firstId && secondId) {
      fetchGenomes();
    }
  }, []);

  return (
    <div className={`compare-page ${darkMode ? 'dark-mode' : ''}`}>
      {/* Replace the header with the Navigation component */}
      <Navigation 
        user={user} 
      />

      {/* MAIN CONTENT */}
      <main className="compare-content">
        <h1 className="page-title">
          <i className="fas fa-balance-scale"></i> Compare Melodies
        </h1>

        <div className="input-section">
          <div className="input-group">
            <label htmlFor="first-melody">First Melody ID:</label>
            <div className="input-with-button">
              <input
                type="text"
                id="first-melody"
                value={melodyIds.first}
                onChange={(e) => setMelodyIds({ ...melodyIds, first: e.target.value })}
                placeholder="Enter first genome ID"
              />
              <button 
                className="browse-btn" 
                onClick={() => {
                  setSelectorType('first');
                  setShowMelodySelector(true);
                }}
              >
                <i className="fas fa-search"></i> Browse
              </button>
            </div>
          </div>

          <div className="input-group">
            <label htmlFor="second-melody">Second Melody ID:</label>
            <div className="input-with-button">
              <input
                type="text"
                id="second-melody"
                value={melodyIds.second}
                onChange={(e) => setMelodyIds({ ...melodyIds, second: e.target.value })}
                placeholder="Enter second genome ID"
              />
              <button 
                className="browse-btn" 
                onClick={() => {
                  setSelectorType('second');
                  setShowMelodySelector(true);
                }}
              >
                <i className="fas fa-search"></i> Browse
              </button>
            </div>
          </div>

          <button 
            className="compare-btn" 
            onClick={fetchGenomes} 
            disabled={loading || !melodyIds.first || !melodyIds.second}
          >
            {loading ? (
              <>
                <div className="spinner-small"></div>
                Loading...
              </>
            ) : (
              <>
                <i className="fas fa-balance-scale"></i> Compare
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="error-message">
            <i className="fas fa-exclamation-triangle"></i> 
            <div>
              <p>{error}</p>
              <p className="error-hint">
                Try using the Browse button to select from your saved melodies, or check that the ID exists.
              </p>
            </div>
          </div>
        )}

        {melodies.first && melodies.second && (
          <div className="comparison-section">
            <div className="play-controls">
              <button 
                className={`play-both-btn ${isPlaying ? 'playing' : ''}`}
                onClick={playComparison}
                disabled={!samplerLoaded}
              >
                {isPlaying ? (
                  <>
                    <i className="fas fa-stop"></i> Stop Playback
                  </>
                ) : (
                  <>
                    <i className="fas fa-play"></i> {samplerLoaded ? 'Play Both Melodies' : 'Loading sounds...'}
                  </>
                )}
              </button>
            </div>

            {ancestryInfo && (
              <div className={`ancestry-section ${ancestryInfo.hasCommonAncestor ? 'has-ancestor' : 'no-ancestor'}`}>
                <div className="ancestry-info">
                  <i className={ancestryInfo.hasCommonAncestor ? 'fas fa-link' : 'fas fa-unlink'}></i>
                  {ancestryInfo.hasCommonAncestor ? (
                    <>
                      <p>These melodies share a common ancestor (ID: {ancestryInfo.commonAncestor.id}) from generation {ancestryInfo.commonAncestor.generation}</p>
                      <button className="view-ancestor-btn" onClick={() => navigate(`/compare?first=${ancestryInfo.commonAncestor.id}&second=${melodyIds.first}`)}>
                        <i className="fas fa-code-branch"></i> Compare with Common Ancestor
                      </button>
                    </>
                  ) : (
                    <p>{ancestryInfo.message || "These melodies don't share a common ancestor or are from different experiments."}</p>
                  )}
                </div>
                
                
                
                {/* Explicitly check the condition again */}
                {ancestryInfo.hasCommonAncestor && <p>Tree should be rendered below...</p>}
                
                {/* Add the tree visualization if there's a common ancestor */}
                {ancestryInfo.hasCommonAncestor && (
                  <AncestryTree 
                    ancestryInfo={ancestryInfo}
                    melodyIds={melodyIds}
                  />
                )}
                
                
              </div>
            )}

            <div className="melodies-comparison">
              <div className="melody-column">
                <div className="melody-heading">
                  <h3>Melody 1 (ID: {melodies.first.id})</h3>
                  <div className="melody-info">
                    <span><i className="fas fa-layer-group"></i> Gen {melodies.first.generation}</span>
                    <span><i className="fas fa-star"></i> Score: {Math.round(melodies.first.score)}/100</span>
                  </div>
                </div>
                <StickRoll 
                  notes={genomeToNotes(melodies.first.data)}
                  playingIndex={playingIndices.first}
                  otherNotes={genomeToNotes(melodies.second.data)}
                />
                
                <div className="notes-data">
                  <div className="notes-data-header">
                    <h4>Note Details</h4>
                    <button 
                      className="toggle-data-btn"
                      onClick={() => setShowFirstData(!showFirstData)}
                    >
                      {showFirstData ? <i className="fas fa-chevron-up"></i> : <i className="fas fa-chevron-down"></i>}
                    </button>
                  </div>
                  {showFirstData && (
                    <pre className="notes-json">{JSON.stringify(genomeToNotes(melodies.first.data), null, 2)}</pre>
                  )}
                </div>
              </div>

              <div className="melody-column">
                <div className="melody-heading">
                  <h3>Melody 2 (ID: {melodies.second.id})</h3>
                  <div className="melody-info">
                    <span><i className="fas fa-layer-group"></i> Gen {melodies.second.generation}</span>
                    <span><i className="fas fa-star"></i> Score: {Math.round(melodies.second.score)}/100</span>
                  </div>
                </div>
                <StickRoll 
                  notes={genomeToNotes(melodies.second.data)}
                  playingIndex={playingIndices.second}
                  otherNotes={genomeToNotes(melodies.first.data)}
                />
                
                <div className="notes-data">
                  <div className="notes-data-header">
                    <h4>Note Details</h4>
                    <button 
                      className="toggle-data-btn"
                      onClick={() => setShowSecondData(!showSecondData)}
                    >
                      {showSecondData ? <i className="fas fa-chevron-up"></i> : <i className="fas fa-chevron-down"></i>}
                    </button>
                  </div>
                  {showSecondData && (
                    <pre className="notes-json">{JSON.stringify(genomeToNotes(melodies.second.data), null, 2)}</pre>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
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

      {showMelodySelector && <MelodySelector />}
    </div>
  );
};

export default Compare;