import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import * as Tone from 'tone';
import './HomePage.css';
import ExperimentSelection from './components/ExperimentSelection';
import Navigation from './components/Navigation';
import { ThemeContext } from './context/ThemeContext';

// Define a famous melody (Für Elise, simplified)
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

const apiUrl = process.env.REACT_APP_API_URL || "http://localhost:8000";

const HomePage = () => {
  const { darkMode } = useContext(ThemeContext);
  // --- State Variables ---
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentGenome, setCurrentGenome] = useState(null);
  const [savedMelodies, setSavedMelodies] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [latestPlaylist, setLatestPlaylist] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isMutating, setIsMutating] = useState(false);
  const [userRating, setUserRating] = useState(null);
  const [scoreSubmitted, setScoreSubmitted] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [samplerLoaded, setSamplerLoaded] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [showExperimentSelection, setShowExperimentSelection] = useState(true);
  const [userContributions, setUserContributions] = useState({});
  const [countdownActive, setCountdownActive] = useState(false);
  const [isFinalPiece, setIsFinalPiece] = useState(false);

  // Countdown states
  const [nextUpdateTime, setNextUpdateTime] = useState(null);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownTime, setCountdownTime] = useState('');

  // --- Refs ---
  const currentNoteRef = useRef(0);
  const samplerRef = useRef(null);

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
      const response = await fetch(`${apiUrl}/api/leaderboard`, {
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
      const response = await fetch(`${apiUrl}/api/melody/latest`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch latest playlist");
      const data = await response.json();
      setLatestPlaylist(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }
      const response = await fetch(`${apiUrl}/api/users/me`, {
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

  const fetchCurrentGenome = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${apiUrl}/api/genome/current`, {
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
      const response = await fetch(`${apiUrl}/api/melody/saved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch saved melodies');
      const melodiesData = await response.json();
      setSavedMelodies(melodiesData);
    } catch (err) {
      console.error('Error fetching saved melodies:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    fetchLatestPlaylist();
  }, []);

  useEffect(() => {
    fetchUserData();
  }, []);

  // Add this useEffect to load contributions from localStorage
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // Load previously saved contributions from localStorage
    const storedContributions = localStorage.getItem('userContributions');
    if (storedContributions) {
      try {
        const parsed = JSON.parse(storedContributions);
        setUserContributions(prevState => ({
          ...prevState,
          ...parsed
        }));
      } catch (err) {
        console.error('Error parsing stored contributions:', err);
      }
    }
  }, []);

  // --- Countdown Timer useEffect ---
  // (This effect is no longer used to update a countdown, but you may still update nextUpdateTime as needed)
  useEffect(() => {
    let interval;
    if (countdownActive && nextUpdateTime) {
      // Previously we updated a live countdown.
      // Now we don't need to update the display continuously.
      // You may remove this effect if you no longer want any updates.
      setCountdownTime(nextUpdateTime.toLocaleTimeString());
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [countdownActive, nextUpdateTime]);

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

  // --- Play Melody Function ---
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
    setIsPlaying(true);
    setCurrentPlayingId(melodyId);
    currentNoteRef.current = 0;
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

  const submitMutation = async (mutatedGenomeArray, score) => {
    try {
      const token = localStorage.getItem('token');
      const mutationData = JSON.stringify(mutatedGenomeArray);
      const response = await fetch(`${apiUrl}/api/genome/${currentGenome.id}/mutate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          genome_id: currentGenome.id,
          mutation_data: mutationData,
          score: score,
        }),
      });
  
      if (!response.ok) {
        // Special handling for already contributed error (409 Conflict)
        if (response.status === 409) {
          const errorData = await response.json();
          
          // Record the contribution in localStorage
          if (errorData.experiment_id && errorData.generation) {
            const contributionKey = `${errorData.experiment_id}_${errorData.generation}`;
            const storedContributions = JSON.parse(localStorage.getItem('userContributions') || '{}');
            storedContributions[contributionKey] = true;
            localStorage.setItem('userContributions', JSON.stringify(storedContributions));
            
            // Update state
            setUserContributions(prev => ({
              ...prev,
              [contributionKey]: true
            }));
          }
          
          // Set countdown information with fallback if needed
          if (errorData.next_update) {
            let nextUpdate = new Date(errorData.next_update);
            if (nextUpdate <= new Date()) {
              nextUpdate = new Date(Date.now() + 180000);
            }
            setNextUpdateTime(nextUpdate);
          }
          setCountdownActive(true);
          
          // Show appropriate message
          throw new Error("You've already contributed to this experiment's generation");
        }
        
        const errorText = await response.text();
        throw new Error(`Failed to mutate genome: ${errorText}`);
      }
      
      const data = await response.json();
      
      // Track that the user has contributed to this experiment's generation
      if (currentGenome && currentGenome.experiment_id) {
        const contributionKey = `${currentGenome.experiment_id}_${currentGenome.generation}`;
        
        // Update in state
        setUserContributions(prev => ({
          ...prev,
          [contributionKey]: true
        }));
        
        // Also store in localStorage for persistence
        const storedContributions = JSON.parse(localStorage.getItem('userContributions') || '{}');
        storedContributions[contributionKey] = true;
        localStorage.setItem('userContributions', JSON.stringify(storedContributions));
      }
      
      // Set countdown information with fallback if needed
      let nextUpdate = new Date(data.next_update);
      if (nextUpdate <= new Date()) {
        nextUpdate = new Date(Date.now() + 180000);
      }
      setNextUpdateTime(nextUpdate);
      setCountdownActive(true);
      return data;
    } catch (err) {
      console.error('Error in submitMutation:', err);
      throw err;
    }
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
    } catch (err) {
      console.error('Error mutating genome:', err);
      alert(`Mutation failed: ${err.message}`);
    } finally {
      setIsMutating(false);
    }
  };

  // Update the mutateGenome function to use conservative mutations
  const mutateGenome = async () => {
    if (!currentGenome || !userRating || !scoreSubmitted) {
      alert('Please rate the melody before mutating');
      return;
    }
    try {
      setIsMutating(true);
      const genomeArray = genomeToNotes(currentGenome.data);
      
      // Apply conservative mutations to only a few random notes
      const mutatedGenome = [...genomeArray]; // Create a copy
      
      // Select a small number of notes to mutate (2-5)
      const numNotesToMutate = Math.floor(Math.random() * 4) + 2; // 2 to 5 notes
      const notesToMutate = [];
      
      while (notesToMutate.length < numNotesToMutate) {
        const idx = Math.floor(Math.random() * genomeArray.length);
        if (!notesToMutate.includes(idx)) {
          notesToMutate.push(idx);
        }
      }
      
      // Apply small changes to those notes
      notesToMutate.forEach(idx => {
        const gene = genomeArray[idx];
        const pitch = gene.pitch || Math.round(gene.frequency || 60);
        const velocity = gene.velocity || 80;
        
        // Small pitch change (-2 to +2 semitones)
        const pitchChange = Math.floor(Math.random() * 5) - 2;
        
        // Small velocity change (-5 to +5)
        const velocityChange = Math.floor(Math.random() * 11) - 5;
        
        // Duration might sometimes change but keep the same most of the time
        const duration = gene.duration || 0.5;
        const durations = [0.25, 0.5, 1, 2];
        const currentDurationIdx = durations.indexOf(duration);
        let newDurationIdx = currentDurationIdx;
        
        // Only 20% chance to change duration
        if (Math.random() < 0.2 && currentDurationIdx >= 0) {
          newDurationIdx = Math.max(0, Math.min(durations.length - 1, 
            currentDurationIdx + (Math.random() < 0.5 ? 1 : -1)));
        }
        
        mutatedGenome[idx] = {
          pitch: Math.max(36, Math.min(84, pitch + pitchChange)),
          duration: durations[newDurationIdx],
          velocity: Math.max(60, Math.min(100, velocity + velocityChange))
        };
      });
      
      await submitMutation(mutatedGenome, userRating);
      setUserRating(null);
      setScoreSubmitted(false);
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
      const response = await fetch(`${apiUrl}/api/melody/save`, {
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
      if (!response.ok) throw new Error('Failed to save melody');
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

  // Update handleToggleNote to allow only one selection at a time
  const handleToggleNote = (index) => {
    setSelectedIndices((prev) => {
      // If clicking on an already selected note, deselect it
      if (prev.includes(index)) {
        return [];
      }
      // Otherwise, select just this note (replacing any previous selection)
      return [index];
    });
  };

  // In HomePage.jsx, update the fetchNextUpdateTime function:
  const fetchNextUpdateTime = async (experimentId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Request the contribution status specifically for this experiment
      const contributionCheckUrl = `${apiUrl}/api/experiments/${experimentId}/generation/${currentGenome.generation}/contribution`;
      const contributionResponse = await fetch(contributionCheckUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!contributionResponse.ok) throw new Error('Failed to check contribution status');
      const contributionData = await contributionResponse.json();
      
      // Always ensure we have a valid future time
      let nextTime;
      if (contributionData.next_update) {
        nextTime = new Date(contributionData.next_update);
        // If the provided time is in the past, use a fallback
        if (nextTime <= new Date()) {
          nextTime = new Date(Date.now() + 180000); // 3 minutes from now
          console.log("Using fallback time (server provided time was in the past):", nextTime);
        }
      } else {
        // If no time provided, use a fallback 3 minutes from now
        nextTime = new Date(Date.now() + 180000);
        console.log("Using fallback time (no time provided by server):", nextTime);
      }
      
      setNextUpdateTime(nextTime);
      // Store with experiment-specific key
      localStorage.setItem(`experiment_${experimentId}_next_update`, nextTime.toISOString());
      
    } catch (err) {
      console.error('Error fetching next update time:', err);
      // Always ensure we set a valid future time
      const fallback = new Date();
      fallback.setMinutes(fallback.getMinutes() + 3);
      setNextUpdateTime(fallback);
      localStorage.setItem(`experiment_${experimentId}_next_update`, fallback.toISOString());
    }
  };

  const handleSelectGenome = (genome) => {
    setCurrentGenome(genome);
    setShowExperimentSelection(false);
    
    // Check if the user already contributed to this experiment's generation
    if (genome && genome.experiment_id && genome.generation) {
      const contributionKey = `${genome.experiment_id}_${genome.generation}`;
      
      // Check contributions from state or localStorage
      const storedContributions = JSON.parse(localStorage.getItem('userContributions') || '{}');
      if (userContributions[contributionKey] || storedContributions[contributionKey]) {
        // Update the state if needed
        if (!userContributions[contributionKey]) {
          setUserContributions(prevContribs => ({
            ...prevContribs,
            [contributionKey]: true
          }));
        }
        
        // Activate countdown
        setCountdownActive(true);
        
        // Try to get the stored next update time first
        const storedTime = localStorage.getItem(`experiment_${genome.experiment_id}_next_update`);
        if (storedTime) {
          const nextTime = new Date(storedTime);
          // Only use the stored time if it's in the future
          if (nextTime > new Date()) {
            setNextUpdateTime(nextTime);
          } else {
            // If stored time is in the past, fetch the latest from server
            fetchNextUpdateTime(genome.experiment_id);
          }
        } else {
          // No stored time, fetch from server
          fetchNextUpdateTime(genome.experiment_id);
        }
      } else {
        setCountdownActive(false);
      }
    } else {
      setCountdownActive(false);
    }
  };

  const onSelectGenomeWithContribution = (genome, hasContributed, nextUpdateTime = null) => {
    setCurrentGenome(genome);
    setShowExperimentSelection(false);
    
    if (hasContributed && genome.experiment_id) {
      // Update the contribution in state
      const contributionKey = `${genome.experiment_id}_${genome.generation}`;
      setUserContributions(prev => ({
        ...prev,
        [contributionKey]: true
      }));
      
      // Set countdown active
      setCountdownActive(true);
      
      // Set next update time if provided
      if (nextUpdateTime) {
        setNextUpdateTime(nextUpdateTime);
        // Store with experiment-specific key
        localStorage.setItem(`experiment_${genome.experiment_id}_next_update`, nextUpdateTime.toISOString());
      } else {
        // Fetch the next update time if not provided
        fetchNextUpdateTime(genome.experiment_id);
      }
    } else {
      setCountdownActive(false);
    }
  };

  // Add this to your component to handle displaying a final piece
  const handleFinalPiece = (genome) => {
    setCurrentGenome(genome);
    setShowExperimentSelection(false);
    setIsFinalPiece(true);
    
    // Reset other state as needed
    setSelectedIndices([]);
    setUserRating(null);
    setCountdownActive(false);
  };

  // --- Sub-Components ---
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

  const GenomeTitle = ({ genome }) => {
    const [experimentName, setExperimentName] = useState('');
    
    useEffect(() => {
      if (genome && genome.experiment_id) {
        const fetchExperimentName = async () => {
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${apiUrl}/api/experiments/${genome.experiment_id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            
            if (response.ok) {
              const experimentData = await response.json();
              setExperimentName(experimentData.name || `Experiment ${genome.experiment_id}`);
            }
          } catch (err) {
            console.error('Error fetching experiment name:', err);
            setExperimentName(`Experiment ${genome.experiment_id}`);
          }
        };
        
        fetchExperimentName();
      }
    }, [genome]);
    
    return (
      <div className="genome-title">
        <h3>{experimentName || 'Unknown Experiment'}</h3>
        <div className="genome-subtitle">
          <span className="genome-id">Genome ID: {genome.id}</span>
          <span className="genome-generation">Generation: {genome.generation}</span>
        </div>
      </div>
    );
  };

  const StickRoll = ({ notes = [], playingIndex, selectedIndices, onToggleNote }) => {
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
          const noteIsPlaying = i === playingIndex;
          const noteIsSelected = selectedIndices.includes(i);
          const border = noteIsSelected ? '2px solid rgb(255, 52, 153)' : 'none';
          return (
            <div
              key={i}
              onClick={() => onToggleNote && onToggleNote(i)}
              style={{
                width: `${barWidth}px`,
                height: `${BASE_HEIGHT}px`,
                backgroundColor: noteIsPlaying ? 'hsl(296, 100%, 78%)' : backgroundColor,
                border,
                borderRadius: "4px",
                cursor: "pointer",
                flexShrink: 0,
                boxShadow: noteIsPlaying ? '0 0 40px rgb(210, 166, 255)' : 'none',
                transition: 'background-color 0.3s, box-shadow 0.3s'
              }}
              title={`Pitch: ${pitch}, Dur: ${duration}, Vel: ${velocity}`}
            />
          );
        })}
      </div>
    );
  };

  // Update the MutationControls component
  // Simplify the MutationControls component
  const MutationControls = ({ genome, selectedIndices, onMutate }) => {
    const [mutationType, setMutationType] = useState('pitch');
    const [intensity, setIntensity] = useState(2);  // Default to lower intensity for more controlled mutations
    
    // Remove mutation mode state and just use selectedIndices
    
    const handleMutate = () => {
      if (!genome?.data) return;
      const originalData = Array.isArray(genome.data)
        ? genome.data
        : JSON.parse(genome.data);
      
      if (selectedIndices.length === 0) {
        alert("Please select a note to mutate by clicking on it in the melody display.");
        return;
      }
      
      if (selectedIndices.length > 1) {
        alert("Please select only one note at a time. Click notes to deselect them.");
        return;
      }
      
      // We know there's exactly one selected note
      const indexToMutate = selectedIndices[0];
      
      const mutated = originalData.map((note, i) => {
        if (i !== indexToMutate) return { ...note };
        return applyMutation(note);
      });
      
      onMutate(mutated);
    };

    const applyMutation = (note) => {
      const pitch = note.pitch || Math.round(note.frequency || 60);
      const duration = note.duration || 0.5;
      const velocity = note.velocity || 80;
      
      if (mutationType === 'pitch') {
        // More precise pitch control for fine-grained evolution
        const pitchShift = intensity <= 2 ? randomShift(1) : randomShift(intensity); 
        return { ...note, pitch: pitch + pitchShift };
      } else if (mutationType === 'duration') {
        const durationOptions = [0.25, 0.5, 1, 2];
        const idx = durationOptions.indexOf(duration);
        // For very low intensity, only change by at most 1 duration step
        let newIdx = intensity <= 2 ? idx + (Math.random() < 0.5 ? 1 : -1) : idx + randomShiftIndex(intensity);
        if (newIdx < 0) newIdx = 0;
        if (newIdx >= durationOptions.length) newIdx = durationOptions.length - 1;
        return { ...note, duration: durationOptions[newIdx] };
      } else if (mutationType === 'velocity') {
        // More precise velocity control
        const velocityShift = intensity <= 2 ? randomShift(5) : randomShift(intensity * 5);
        const newVel = clamp(velocity + velocityShift, 60, 100);
        return { ...note, velocity: newVel };
      } else {
        // For "all" type, still make small changes
        return {
          pitch: pitch + (intensity <= 2 ? randomShift(1) : randomShift(intensity)),
          duration: duration, // Keep same duration for conservative mutation
          velocity: clamp(velocity + randomShift(intensity), 60, 100)
        };
      }
    };

    // Other utility functions remain the same
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
          <h4>Mutation Controls</h4>
        </div>

        <div className="selected-note-info">
          {selectedIndices.length === 0 ? (
            <div className="mutation-instruction">
              <i className="fas fa-arrow-up"></i> Click on a note above to select it for mutation
            </div>
          ) : selectedIndices.length === 1 ? (
            <div className="selected-count">
              <span className="count">1</span>
              <span className="label">note selected (index: {selectedIndices[0]})</span>
            </div>
          ) : (
            <div className="too-many-selected">
              <i className="fas fa-exclamation-triangle"></i> 
              <span>Too many notes selected ({selectedIndices.length}). Please select only one note.</span>
            </div>
          )}
        </div>

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
            <label>Intensity: {intensity} {intensity <= 2 ? '(Minimal)' : ''}</label>
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
          className={`action-btn mutate ${selectedIndices.length !== 1 ? 'disabled' : ''}`}
          onClick={handleMutate}
          disabled={selectedIndices.length !== 1}
        >
          <i className="fas fa-dna"></i> Apply Mutation to Selected Note
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

  const CountdownModal = ({ visible, timeString, onClose }) => {
    if (!visible) return null;
    return (
      <div className="countdown-modal-overlay">
        <div className="countdown-modal">
          <h3><i className="fas fa-check-circle success-icon"></i> Mutation Submitted Successfully!</h3>
          <p className="modal-message">Your contribution will help shape the next generation of melodies.</p>
          
          <div className="next-generation-info">
            <h4>Next Generation Update In</h4>
            <div className="countdown-timer-container">
              <div className="countdown-timer">
                {timeString}
              </div>
            </div>
            <p className="countdown-info">
              The system automatically creates new generations every 3 minutes based on the highest-rated melodies.
            </p>
          </div>
          
          <div className="countdown-actions">
            <button 
              className="action-btn primary-btn"
              onClick={() => window.location.reload()}
            >
              <i className="fas fa-flask"></i> Try Another Experiment
            </button>
            <button 
              className="action-btn secondary-btn"
              onClick={onClose}
            >
              <i className="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  // Updated CountdownDisplay component to show a fixed time instead of a live countdown
  const CountdownDisplay = ({ nextUpdateTime, setShowExperimentSelection }) => {
    // Check if the provided time is valid and in the future
    const now = new Date();
    let displayTime = nextUpdateTime;
    
    // If time is invalid or in the past, generate a time 3 minutes from now
    if (!nextUpdateTime || nextUpdateTime <= now) {
      displayTime = new Date(now.getTime() + 3 * 60 * 1000);
      console.log("Generated fallback time:", displayTime);
    }
    
    // Format the next update time as a fixed string (e.g., HH:MM:SS)
    const fixedTime = displayTime ? displayTime.toLocaleTimeString() : 'Loading...';
    
    // Add information about experiment progress if available
    const progressPercent = currentGenome && 
      currentGenome.max_generations ? 
      Math.round((currentGenome.generation / currentGenome.max_generations) * 100) : 
      Math.round((currentGenome?.generation || 0) / 4 * 100);
    
    return (
      <div className="countdown-display">
        <div className="countdown-content">
          <div className="countdown-header">
            <i className="fas fa-check-circle contribution-icon"></i>
            <h3>You've Already Contributed</h3>
          </div>
          <p className="contribution-thank-you">Thank you for helping shape this generation!</p>
          <div className="next-generation-info">
            <h4>Next Generation Will Be Created At</h4>
            <div className="countdown-timer-container">
              <div className="fixed-time">
                {fixedTime}
              </div>
            </div>
            
            <div className="experiment-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{width: `${progressPercent}%`}}
                ></div>
              </div>
              <div className="progress-text">
                {progressPercent}% complete 
                {currentGenome?.generation >= 3 && (
                  <span className="completion-note"> (Final generation soon!)</span>
                )}
              </div>
            </div>
            
            <p className="countdown-info">
              The system automatically creates new generations based on the highest-rated melodies.
            </p>
          </div>
          <button 
            className="action-btn experiment-btn"
            onClick={() => setShowExperimentSelection(true)}
            disabled={!displayTime}
          >
            <i className="fas fa-flask"></i> Try Another Experiment
          </button>
        </div>
      </div>
    );
};

  // --- Render ---
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
      {/* Replace the header with the Navigation component */}
      <Navigation 
        user={user} 
      />

      {/* MAIN CONTENT */}
      <main className="home-content">
        {showExperimentSelection ? (
          <ExperimentSelection 
            onSelectGenome={handleSelectGenome} 
            onSelectGenomeWithContribution={onSelectGenomeWithContribution} 
          />
        ) : (
          <div className="three-column-layout">
            {/* Left Column: Saved Melodies and Leaderboard */}
            <div className="left-column">
              <section className="leaderboard">
                <h2><span className="section-icon">🏆</span> Leaderboard</h2>
                <div className="leaderboard-content">
                  {leaderboard.length > 0 ? (
                    leaderboard.map((entry, index) => (
                      <div key={entry.id || index} className="leaderboard-entry">
                        <div className="leaderboard-rank">{index + 1}</div>
                        <div className="leaderboard-user">
                          <div className={`trophy trophy-${index + 1}`}>
                            {index === 0 ? (
                              <i className="fas fa-crown gold"></i>
                            ) : index === 1 ? (
                              <i className="fas fa-medal silver"></i>
                            ) : (
                              <i className="fas fa-award bronze"></i>
                            )}
                          </div>
                          <div className="leaderboard-username">{entry.username}</div>
                        </div>
                        <div className="leaderboard-score">{Math.round(entry.score)}</div>
                      </div>
                    ))
                  ) : (
                    <p><i className="fas fa-hourglass-half"></i> No contributions yet.</p>
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
                        <p><i className="fas fa-layer-group"></i> Generation: {currentGenome.generation}</p>
                        <p><i className="fas fa-chart-bar"></i> Score: {Math.round(currentGenome.score)}/100</p>
                      </div>
                      
                      {countdownActive ? (
                        <CountdownDisplay 
                          nextUpdateTime={nextUpdateTime}
                          setShowExperimentSelection={setShowExperimentSelection}
                        />
                      ) : (
                        <>
                          <StickRoll
                            notes={genomeToNotes(currentGenome.data)}
                            playingIndex={currentPlayingId === currentGenome.id ? playingIndex : -1}
                            selectedIndices={selectedIndices}
                            onToggleNote={handleToggleNote}
                          />
                          <div className="genome-controls">
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
                      )}
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
              <section className="latest-playlist">
                <h2><span className="section-icon">📻</span> Latest Community Melodies</h2>
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

      {/* Countdown Modal */}
      <CountdownModal 
        visible={showCountdown}
        timeString={countdownTime}
        onClose={() => setShowCountdown(false)}
      />

      {/* FOOTER */}
      <footer className="app-footer">
        <p>&copy; 5 TuneBreeder - Evolving Music Together</p>
        <div className="footer-links">
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a href="#">About</a>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a href="#">Privacy</a>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a href="#">Terms</a>
          {/* eslint-disable-next-line jsx-a11y/anchor-is-valid */}
          <a href="#">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;

