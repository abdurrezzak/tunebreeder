import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import './HomePage.css';
import ExperimentSelection from './components/ExperimentSelection';

// --- MelodyCard Component ---
// Displays a saved melody using useMemo at the top level.
const MelodyCard = ({ melody, isPlaying, currentPlayingId, stopPlaying, playMelody }) => {
  const barHeights = useMemo(
    () => Array.from({ length: 8 }, () => 10 + Math.random() * 30),
    [melody.id]
  );

  return (
    <div className="melody-card">
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
      <button
        className={`play-btn ${isPlaying && currentPlayingId === melody.id ? 'playing' : ''}`}
        onClick={() =>
          isPlaying && currentPlayingId === melody.id
            ? stopPlaying()
            : playMelody(melody.genome.data, melody.id)
        }
      >
        {isPlaying && currentPlayingId === melody.id ? (
          <>
            <i className="fas fa-stop"></i> Stop
          </>
        ) : (
          <>
            <i className="fas fa-play"></i> Play
          </>
        )}
      </button>
    </div>
  );
};

const HomePage = () => {
  // --- Test Melody (Für Elise, simplified) ---
  const famousMelody = [
    { pitch: 76, duration: 0.5, velocity: 80 },
    { pitch: 75, duration: 0.5, velocity: 80 },
    { pitch: 76, duration: 0.5, velocity: 80 },
    { pitch: 75, duration: 0.5, velocity: 80 },
    { pitch: 76, duration: 0.5, velocity: 80 },
    { pitch: 71, duration: 0.5, velocity: 80 },
    { pitch: 74, duration: 0.5, velocity: 80 },
    { pitch: 72, duration: 0.5, velocity: 80 },
    { pitch: 69, duration: 0.75, velocity: 80 },
    { pitch: 69, duration: 0.5, velocity: 80 },
    { pitch: 60, duration: 0.5, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 69, duration: 1.0, velocity: 80 },
    { pitch: 71, duration: 0.5, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 68, duration: 0.5, velocity: 80 },
    { pitch: 71, duration: 1.0, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 60, duration: 0.5, velocity: 80 },
    { pitch: 59, duration: 0.5, velocity: 80 },
    { pitch: 57, duration: 1.0, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 65, duration: 0.5, velocity: 80 },
    { pitch: 67, duration: 0.5, velocity: 80 },
    { pitch: 67, duration: 0.5, velocity: 80 },
    { pitch: 65, duration: 0.5, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 62, duration: 0.5, velocity: 80 },
    { pitch: 60, duration: 0.5, velocity: 80 },
    { pitch: 60, duration: 0.5, velocity: 80 },
    { pitch: 62, duration: 0.5, velocity: 80 },
    { pitch: 64, duration: 0.5, velocity: 80 },
    { pitch: 62, duration: 0.75, velocity: 80 },
    { pitch: 60, duration: 0.25, velocity: 80 },
    { pitch: 60, duration: 1.0, velocity: 80 }
  ];

  // --- State Variables ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentGenome, setCurrentGenome] = useState(null);
  const [savedMelodies, setSavedMelodies] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [latestPlaylist, setLatestPlaylist] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isMutating, setIsMutating] = useState(false);
  const [userRating, setUserRating] = useState(null);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [samplerLoaded, setSamplerLoaded] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [showExperimentSelection, setShowExperimentSelection] = useState(true);

  // --- Refs ---
  const audioContextRef = useRef(null);
  const currentNoteRef = useRef(0);
  const samplerRef = useRef(null);

  // --- Dark Mode Toggle ---
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [darkMode]);

  // --- Tone.Transport Cleanup ---
  useEffect(() => {
    return () => {
      Tone.Transport.cancel();
      Tone.Transport.stop();
    };
  }, []);

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

  // --- API Fetch Functions ---
  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/leaderboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch leaderboard");
      const data = await response.json();
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLatestPlaylist = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/melody/latest', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch latest playlist");
      const data = await response.json();
      setLatestPlaylist(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchLatestPlaylist();
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const response = await fetch('http://localhost:8000/api/users/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch user data');
      }
      const userData = await response.json();
      setUser(userData);
      if (window.location.search.includes('testfamous')) {
        setCurrentGenome({ id: 999, generation: 0, score: 100, data: famousMelody });
      } else {
        fetchCurrentGenome();
      }
      fetchSavedMelodies();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchCurrentGenome = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/genome/current', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch current genome');
      const genomeData = await response.json();
      setCurrentGenome(genomeData);
      setSelectedIndices([]);
    } catch (err) {
      console.error('Error fetching genome:', err);
      alert('Error fetching current genome: ' + err.message);
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
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  // --- Audio Playback Functions ---
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

  // Improved playMelody using Tone.Transport for accurate timing.
  // This function is used for both the current melody and external melodies.
  const playMelody = async (genomeData, melodyId = null) => {
    stopPlaying();
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
        console.log("Tone.js audio context started");
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
    
    // Update global state for playback.
    setIsPlaying(true);
    setCurrentPlayingId(melodyId);
    currentNoteRef.current = 0;
    
    // For the current genome, we want to show progress.
    // For external melodies, playingIndex will not be used in the middle column.
    if (melodyId === currentGenome?.id) {
      setPlayingIndex(0);
    }
    
    Tone.Transport.cancel();
    Tone.Transport.stop();
    let cumulativeTime = 0;
    notes.forEach((note, index) => {
      Tone.Transport.scheduleOnce(() => {
        if (melodyId === currentGenome?.id) {
          setPlayingIndex(index);
        }
        playNote(note);
      }, cumulativeTime);
      cumulativeTime += note.duration;
    });
    Tone.Transport.scheduleOnce(() => {
      stopPlaying();
      Tone.Transport.stop();
    }, cumulativeTime);
    Tone.Transport.start();
  };

  const stopPlaying = () => {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    setIsPlaying(false);
    setPlayingIndex(-1);
    setCurrentPlayingId(null);
  };

  // --- Mutation and Save Functions ---
  const submitMutation = async (mutatedGenomeArray, score) => {
    const token = localStorage.getItem('token');
    const mutationData = JSON.stringify(mutatedGenomeArray);
    const response = await fetch(`http://localhost:8000/api/genome/${currentGenome.id}/mutate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        genome_id: currentGenome.id,
        mutation_data: mutationData,
        score: score,
      }),
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to mutate genome: ${errorText}`);
    }
    return await response.json();
  };

  const handleAdvancedMutation = async (mutatedGenome) => {
    if (!currentGenome || !userRating || !scoreSubmitted) {
      alert('Please rate the melody before mutating');
      return;
    }
    try {
      setIsMutating(true);
      await submitMutation(mutatedGenome, userRating);
      setUserRating(null);
      setScoreSubmitted(false);
      setSelectedIndices([]);
      await fetchCurrentGenome();
      fetchLeaderboard();
      alert('Mutation submitted successfully!');
    } catch (err) {
      console.error('Error mutating genome:', err);
      alert(`Mutation failed: ${err.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  const mutateGenome = async () => {
    if (!currentGenome || !userRating || !scoreSubmitted) {
      alert('Please rate the melody before mutating');
      return;
    }
    try {
      setIsMutating(true);
      const genomeArray = genomeToNotes(currentGenome.data);
      const mutatedGenome = genomeArray.map((gene) => {
        const pitch = gene.pitch || Math.round(gene.frequency || 60);
        const duration = gene.duration || 0.5;
        const velocity = gene.velocity || 80;
        return {
          pitch: pitch + (Math.floor(Math.random() * 7) - 3),
          duration: [0.25, 0.5, 1, 2].includes(duration) ? duration : 0.5,
          velocity: Math.min(100, Math.max(60, velocity + (Math.floor(Math.random() * 11) - 5))),
        };
      });
      await submitMutation(mutatedGenome, userRating);
      setUserRating(null);
      setScoreSubmitted(false);
      await fetchCurrentGenome();
      fetchLeaderboard();
      alert('Mutation submitted successfully!');
    } catch (err) {
      console.error('Error mutating genome:', err);
      alert(`Mutation failed: ${err.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  const saveMelody = async () => {
    if (!currentGenome) return;
    const name = prompt('Name your melody:');
    if (!name) return;
    const description = prompt('Add a description (optional):');
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/melody/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genome_id: currentGenome.id,
          name,
          description: description || '',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to save melody');
      }
      alert('Melody saved successfully!');
      fetchSavedMelodies();
      fetchLatestPlaylist();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleRateGenome = (rating) => {
    setUserRating(rating);
    setScoreSubmitted(true);
  };

  const handleToggleNote = (index) => {
    setSelectedIndices((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  const handleSelectGenome = (genome) => {
    setCurrentGenome(genome);
    setShowExperimentSelection(false);
  };

  if (loading && !user) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading your musical universe...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="error-container">
        <h2>Oops! Something went wrong</h2>
        <p>{error}</p>
        <button className="primary-btn" onClick={() => (window.location.href = '/login')}>
          Go back to login
        </button>
      </div>
    );
  }

  return (
    <div className={`home-page ${darkMode ? 'dark-mode' : ''}`}>
      {/* HEADER */}
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <i className="fas fa-music"></i>
          </div>
          <h1>TuneBreeder</h1>
        </div>
        <div className="user-controls">
          <button className="theme-toggle" onClick={toggleDarkMode}>
            {darkMode ? <i className="fas fa-sun"></i> : <i className="fas fa-moon"></i>}
          </button>
          <div className="user-info">
            <span>
              <i className="fas fa-user"></i> {user?.username}
            </span>
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="app-content">
        {showExperimentSelection ? (
          <ExperimentSelection onSelectGenome={handleSelectGenome} />
        ) : (
          <div className="three-column-layout">
            {/* Left Column: Saved Melodies and Leaderboard */}
            <div className="left-column">
              <section className="saved-melodies">
                <h2>
                  <span className="section-icon">💾</span> Your Saved Melodies
                </h2>
                {savedMelodies.length > 0 ? (
                  <div className="melodies-grid">
                    {savedMelodies.map((melody) => (
                      <MelodyCard
                        key={melody.id}
                        melody={melody}
                        isPlaying={isPlaying}
                        currentPlayingId={currentPlayingId}
                        stopPlaying={stopPlaying}
                        playMelody={playMelody}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="no-melodies">
                    <i className="fas fa-music melody-icon"></i>
                    <p>You haven't saved any melodies yet.</p>
                    <p>Start by exploring and saving melodies you like!</p>
                  </div>
                )}
              </section>

              {/* Leaderboard Section */}
              <section className="leaderboard">
                <h2>
                  <span className="section-icon">🏆</span> Leaderboard
                </h2>
                <div className="leaderboard-content">
                  {leaderboard.length > 0 ? (
                    leaderboard.map((entry, index) => (
                      <div key={entry.id} className="leaderboard-entry">
                        <div className="leaderboard-rank">#{index + 1}</div>
                        <div className="user-avatar">
                          {entry.username.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="leaderboard-info">
                          <div className="leaderboard-name">{entry.username}</div>
                          <div className="leaderboard-stats">
                            <i className="fas fa-lightbulb contribution-icon"></i>
                            <span className="contribution-count">{entry.contribution_count}</span> contributions
                          </div>
                        </div>
                        {index < 3 && (
                          <div className={`trophy trophy-${index + 1}`}>
                            {index === 0 ? (
                              <i className="fas fa-crown gold"></i>
                            ) : index === 1 ? (
                              <i className="fas fa-medal silver"></i>
                            ) : (
                              <i className="fas fa-award bronze"></i>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p>
                      <i className="fas fa-hourglass-half"></i> No contributions yet.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* Middle Column: Current Melody */}
            <div className="middle-column">
              <section className="current-genome">
                <h2>Current Melody</h2>
                <div className="genome-card">
                  {currentGenome ? (
                    <>
                      <div className="genome-actions">
                        <button className="back-btn" onClick={() => setShowExperimentSelection(true)}>
                          <i className="fas fa-chevron-left"></i> Back to Experiments
                        </button>
                      </div>

                      <GenomeTitle genome={currentGenome} />

                      <div className="genome-info">
                        <p>
                          <i className="fas fa-layer-group"></i> Generation: {currentGenome.generation}
                        </p>
                        <p>
                          <i className="fas fa-chart-bar"></i> Score: {Math.round(currentGenome.score)}/100
                        </p>
                      </div>

                      {/* Only show StickRoll progress if the current genome is playing */}
                      <StickRoll
                        notes={genomeToNotes(currentGenome.data)}
                        playingIndex={currentPlayingId === currentGenome.id ? playingIndex : -1}
                        selectedIndices={selectedIndices}
                        onToggleNote={handleToggleNote}
                      />

                      <div className="genome-controls">
                        {/* Play and Save buttons in a flex container */}
                        <div className="play-save-container" style={{ display: "flex", gap: "1rem" }}>
                          <button
                            className={`action-btn play ${isPlaying && currentPlayingId === currentGenome.id ? 'playing' : ''}`}
                            onClick={() =>
                              isPlaying && currentPlayingId === currentGenome.id
                                ? stopPlaying()
                                : playMelody(currentGenome.data, currentGenome.id)
                            }
                            disabled={!samplerLoaded}
                          >
                            {isPlaying && currentPlayingId === currentGenome.id ? (
                              <>
                                <i className="fas fa-stop"></i> Stop
                              </>
                            ) : (
                              <>
                                <i className="fas fa-play"></i> {samplerLoaded ? 'Play' : 'Loading sounds...'}
                              </>
                            )}
                          </button>
                          <button className="action-btn save" onClick={saveMelody}>
                            <i className="fas fa-heart"></i> Save
                          </button>
                        </div>

                        {/* Rate this melody appears before advanced mutation controls */}
                        <ScoreSlider onRate={handleRateGenome} initialValue={userRating || 50} />
                        {userRating !== null && (
                          <p className="user-rating">Your rating: {userRating}/100</p>
                        )}

                        <MutationControls
                          genome={currentGenome}
                          selectedIndices={selectedIndices}
                          onMutate={handleAdvancedMutation}
                        />

                        <button
                          className="action-btn mutate-random"
                          onClick={mutateGenome}
                          disabled={!scoreSubmitted || isMutating}
                        >
                          <i className="fas fa-random"></i> Random Mutate (All)
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="no-genome">
                      <p>No melody available at the moment</p>
                      <button className="action-btn" onClick={() => setShowExperimentSelection(true)}>
                        Return to Experiment Selection
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Right Column: Latest Community Melodies */}
            <div className="right-column">
              {/* Latest Community Melodies Section */}
              <section className="latest-playlist">
                <h2>
                  <span className="section-icon">📻</span> Latest Community Melodies
                </h2>
                <div className="playlist-container">
                  {latestPlaylist.length > 0 ? (
                    <div className="playlist-tracks">
                      {latestPlaylist.map((melody) => (
                        <div key={melody.id} className="playlist-track">
                          <div
                            className="track-play-btn"
                            onClick={() => {
                              if (isPlaying && currentPlayingId === melody.id) {
                                stopPlaying();
                              } else {
                                playMelody(melody.genome.data, melody.id);
                              }
                            }}
                          >
                            {isPlaying && currentPlayingId === melody.id ? (
                              <div className="equalizer">
                                <span></span>
                                <span></span>
                                <span></span>
                                <span></span>
                              </div>
                            ) : (
                              <i className="fas fa-play"></i>
                            )}
                          </div>
                          <div className="track-info">
                            <div className="track-title">{melody.name}</div>
                            <div className="track-artist">
                              <i className="fas fa-user"></i> {melody.username}
                            </div>
                          </div>
                          <div className="track-meta">
                            <span className="track-generation">
                              <i className="fas fa-dna"></i> Gen {melody.genome.generation}
                            </span>
                            <span className="track-rating">
                              <span className="rating-value">{Math.round(melody.genome.score)}</span>
                              <i className="fas fa-star rating-icon"></i>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-playlist">
                      <i className="fas fa-music empty-playlist-icon"></i>
                      <p>No melodies have been saved yet.</p>
                      <p>Be the first to save a melody to the community playlist!</p>
                    </div>
                  )}
                </div>
              </section>
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
    </div>
  );
};

// --- Sub-Components ---

const GenomeTitle = ({ genome }) => (
  <div className="genome-title">
    <h3>
      Generation {genome.generation} - Genome {genome.id}
    </h3>
  </div>
);

/* 
  New StickRoll component that displays notes in a flex-wrapped container.
  The notes are arranged line by line (vertically) instead of one long horizontal line.
*/
const StickRoll = ({ notes = [], playingIndex, selectedIndices, onToggleNote }) => {
  const DURATION_SCALE = 80; // scale factor for width
  const BASE_HEIGHT = 20; // fixed height for each note

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
        // Compute color based on pitch
        const MIN_PITCH = 36;
        const MAX_PITCH = 96;
        const clampedPitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
        const normalizedPitch = (clampedPitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH);
        const hue = 260 + normalizedPitch * 20;
        const saturation = 70 + normalizedPitch * 30;
        const lightness = 30 + (1 - normalizedPitch) * 30;
        const backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const barWidth = duration * DURATION_SCALE;
        const isPlaying = i === playingIndex;
        const isSelected = selectedIndices.includes(i);
        const border = isSelected ? '2px solid rgb(255, 52, 153)' : 'none';

        return (
          <div
            key={i}
            onClick={() => onToggleNote && onToggleNote(i)}
            style={{
              width: `${barWidth}px`,
              height: `${BASE_HEIGHT}px`,
              backgroundColor,
              border,
              borderRadius: "4px",
              cursor: "pointer",
              flexShrink: 0,
              boxShadow: isPlaying ? '0 0 40px rgb(210, 166, 255)' : 'none',
              backgroundColor: isPlaying ? 'hsl(296, 100.00%, 78.00%)' : `hsl(${hue}, ${saturation}%, ${lightness}%)`,
              transition: 'background-color 0.3s, box-shadow 0.3s'
            }}
            title={`Pitch: ${pitch}, Dur: ${duration}, Vel: ${velocity}`}
          />
        );
      })}
    </div>
  );
};

const MutationControls = ({ genome, selectedIndices, onMutate }) => {
  const [mutationType, setMutationType] = useState('pitch');
  const [intensity, setIntensity] = useState(3);

  const handleMutate = () => {
    if (!genome?.data) return;
    const originalData = Array.isArray(genome.data) ? genome.data : JSON.parse(genome.data);
    if (selectedIndices.length === 0) {
      alert("Please select at least one note to mutate by clicking on it in the melody display.");
      return;
    }
    const mutated = originalData.map((note, i) => {
      if (!selectedIndices.includes(i)) return { ...note };
      return applyMutation(note);
    });
    onMutate(mutated);
  };

  const applyMutation = (note) => {
    const pitch = note.pitch || Math.round(note.frequency || 60);
    const duration = note.duration || 0.5;
    const velocity = note.velocity || 80;
    if (mutationType === 'pitch') {
      return { ...note, pitch: pitch + randomShift(intensity) };
    } else if (mutationType === 'duration') {
      const durationOptions = [0.25, 0.5, 1, 2];
      const idx = durationOptions.indexOf(duration);
      let newIdx = idx + randomShiftIndex(intensity);
      if (newIdx < 0) newIdx = 0;
      if (newIdx >= durationOptions.length) newIdx = durationOptions.length - 1;
      return { ...note, duration: durationOptions[newIdx] };
    } else if (mutationType === 'velocity') {
      const newVel = clamp(velocity + randomShift(intensity), 0, 127);
      return { ...note, velocity: newVel };
    } else {
      return {
        pitch: pitch + randomShift(intensity),
        duration: [0.25, 0.5, 1, 2][Math.floor(Math.random() * 4)],
        velocity: clamp(velocity + randomShift(intensity), 0, 127)
      };
    }
  };

  const randomShift = (max) => Math.floor(Math.random() * (max * 2 + 1)) - max;
  const randomShiftIndex = (max) => Math.floor(Math.random() * (max * 2 + 1)) - max;
  const clamp = (val, min, max) => Math.min(max, Math.max(min, val));

  const getMutationIcon = () => {
    switch (mutationType) {
      case 'pitch':
        return '↕️';
      case 'duration':
        return '↔️';
      case 'velocity':
        return '📊';
      default:
        return '🧬';
    }
  };

  return (
    <div className="mutation-controls">
      <div className="mutation-header">
        <h4>Advanced Mutation Controls</h4>
        <div className="selected-count">
          <span className="count">{selectedIndices.length}</span>
          <span className="label">notes selected</span>
        </div>
      </div>

      <p className="mutation-instruction">
        {selectedIndices.length > 0
          ? `${selectedIndices.length} notes selected for mutation`
          : 'Select notes by clicking on the sticks above'}
      </p>

      <div className="mutation-options">
        <div className="control-group">
          <label>Mutation Type:</label>
          <div className="custom-select">
            <select value={mutationType} onChange={(e) => setMutationType(e.target.value)}>
              <option value="pitch">Pitch</option>
              <option value="duration">Duration</option>
              <option value="velocity">Volume</option>
              <option value="all">All Properties</option>
            </select>
            <div className="select-icon">{getMutationIcon()}</div>
          </div>
        </div>

        <div className="control-group">
          <label>Intensity: {intensity}</label>
          <div className="slider-container">
            <input
              type="range"
              min="1"
              max="10"
              value={intensity}
              onChange={(e) => setIntensity(parseInt(e.target.value))}
            />
            <div className="slider-labels">
              <span>Subtle</span>
              <span>Extreme</span>
            </div>
          </div>
        </div>
      </div>

      <button
        className={`action-btn mutate ${selectedIndices.length === 0 ? 'disabled' : ''}`}
        onClick={handleMutate}
        disabled={selectedIndices.length === 0}
      >
        <i className="fas fa-dna"></i> Apply Mutation to Selected Notes
      </button>
    </div>
  );
};

const ScoreSlider = ({ onRate, initialValue = 50 }) => {
  const [score, setScore] = useState(initialValue);
  const handleScoreChange = (e) => {
    const newScore = parseInt(e.target.value);
    setScore(newScore);
  };
  const handleSubmitScore = () => {
    onRate(score);
  };
  return (
    <div className="score-slider-container">
      <div className="score-slider-header">
        <label htmlFor="score-slider">Rate this melody (1-100):</label>
        <div className="score-value">{score}</div>
      </div>
      <div className="slider-with-input">
        <input
          type="range"
          id="score-slider"
          min="1"
          max="100"
          value={score}
          onChange={handleScoreChange}
          className="score-slider"
        />
        <input
          type="number"
          min="1"
          max="100"
          value={score}
          onChange={handleScoreChange}
          className="score-input"
        />
      </div>
      <button className="submit-score-btn" onClick={handleSubmitScore}>
        Submit Rating
      </button>
    </div>
  );
};

export default HomePage;
