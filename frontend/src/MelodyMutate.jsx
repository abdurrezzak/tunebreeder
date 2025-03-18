// MelodyMutate.jsx
import React, { useState, useEffect, useRef, useContext } from 'react';
import * as Tone from 'tone';
import Navigation from './components/Navigation';
import StickRoll from './StickRoll';
import './MelodyMutate.css';
import { ThemeContext } from './context/ThemeContext';
import { useLocation, useNavigate } from 'react-router-dom';

const MelodyMutate = () => {
  const { darkMode } = useContext(ThemeContext);
  const location = useLocation();
  const navigate = useNavigate(); // Replace useHistory with useNavigate
  const genomeFromState = location.state?.genome;
  const [currentGenome, setCurrentGenome] = useState(genomeFromState);
  const [userRating, setUserRating] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingIndex, setPlayingIndex] = useState(-1);
  const [isMutating, setIsMutating] = useState(false);
  const [samplerLoaded, setSamplerLoaded] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState([]);
  const [mutationStrength, setMutationStrength] = useState(50);
  
  const samplerRef = useRef(null);
  
  // Initialize Tone.js Sampler
  useEffect(() => {
    if (samplerRef.current) {
      samplerRef.current.dispose();
    }
    
    samplerRef.current = new Tone.Sampler({
      urls: {
        "A0": "A0.mp3",
        "C1": "C1.mp3",
        "F1": "F1.mp3",
        "A1": "A1.mp3",
        "C2": "C2.mp3",
        "F2": "F2.mp3",
        "A2": "A2.mp3",
        "C3": "C3.mp3",
        "F3": "F3.mp3",
        "A3": "A3.mp3",
        "C4": "C4.mp3",
        "F4": "F4.mp3",
        "A4": "A4.mp3"
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
  
  // Fallback synth in case samples don't load
  const createFallbackSynth = () => {
    samplerRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
    samplerRef.current.set({
      envelope: { attack: 0.02, decay: 0.1, sustain: 0.3, release: 1 }
    });
    setSamplerLoaded(true);
  };
  
  // MIDI to Note name conversion
  const midiToNote = (midi) => {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const octave = Math.floor(midi / 12) - 1;
    return `${noteNames[midi % 12]}${octave}`;
  };
  
  // Parse genome data to notes
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
  
  // Play a single note
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
  
  // Play the entire melody
  const playMelody = async () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    
    if (!currentGenome) return;
    
    try {
      if (Tone.context.state !== "running") {
        await Tone.start();
      }
    } catch (err) {
      console.error("Error starting Tone.js", err);
      return;
    }
    
    const notes = genomeToNotes(currentGenome.data);
    if (!notes.length) return;
    
    setIsPlaying(true);
    Tone.Transport.cancel();
    Tone.Transport.stop();
    
    let cumulativeTime = 0;
    notes.forEach((note, i) => {
      Tone.Transport.scheduleOnce(() => {
        setPlayingIndex(i);
        playNote(note);
      }, cumulativeTime);
      cumulativeTime += note.duration;
    });
    
    Tone.Transport.scheduleOnce(() => {
      stopPlayback();
    }, cumulativeTime);
    
    Tone.Transport.start();
  };
  
  // Stop playback
  const stopPlayback = () => {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    setIsPlaying(false);
    setPlayingIndex(-1);
  };
  
  // Toggle note selection for mutation
  const handleToggleNote = (index) => {
    setSelectedIndices(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };
  
  // Rate the current melody
  const handleRateGenome = async () => {
    if (!userRating) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/genome/${currentGenome.id}/rate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ score: userRating })
      });
      
      if (!response.ok) throw new Error('Failed to rate genome');
      
      alert('Rating submitted successfully!');
    } catch (err) {
      console.error('Error rating genome:', err);
      alert('Failed to submit rating. Please try again.');
    }
  };
  
  // Apply mutation to the current genome
  const handleMutate = async () => {
    if (!currentGenome) return;
    
    setIsMutating(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/genome/mutate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          genome_id: currentGenome.id,
          selected_indices: selectedIndices,
          mutation_strength: mutationStrength / 100
        })
      });
      
      if (!response.ok) throw new Error('Failed to mutate genome');
      
      const mutatedGenome = await response.json();
      setCurrentGenome(mutatedGenome);
      setSelectedIndices([]);
      alert('Mutation applied successfully!');
    } catch (err) {
      console.error('Error mutating genome:', err);
      alert('Failed to apply mutation. Please try again.');
    } finally {
      setIsMutating(false);
    }
  };
  
  // Redirect back if no genome is available
  useEffect(() => {
    if (!currentGenome) {
      navigate('/dashboard'); // Updated from history.push
    }
  }, [currentGenome, navigate]);

  return (
    <div className={`melody-mutate-page ${darkMode ? 'dark-mode' : ''}`}>
      <Navigation />
      <main className="mutate-content">
        <div className="genome-display">
          <h2>Current Melody</h2>
          <StickRoll
            notes={genomeToNotes(currentGenome?.data || [])}
            playingIndex={playingIndex}
            selectedIndices={selectedIndices}
            onToggleNote={handleToggleNote}
          />
          <div className="play-save-container">
            <button
              className={`action-btn play ${isPlaying ? 'playing' : ''}`}
              onClick={playMelody}
              disabled={!samplerLoaded}
            >
              {isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>
        </div>
        
        <div className="mutation-section">
          <h2>Mutate Melody</h2>
          <p className="instruction">Click on notes in the melody to select them for mutation</p>
          
          <div className="mutation-controls">
            <div className="control-group">
              <label>Mutation Strength</label>
              <input
                type="range"
                min="1"
                max="100"
                value={mutationStrength}
                onChange={(e) => setMutationStrength(parseInt(e.target.value))}
                className="slider"
              />
              <span className="strength-value">{mutationStrength}%</span>
            </div>
            
            <button 
              className="action-btn mutate"
              onClick={handleMutate}
              disabled={isMutating || selectedIndices.length === 0}
            >
              {isMutating ? 'Applying Mutation...' : 'Apply Mutation'}
            </button>
          </div>
        </div>
        
        <div className="rating-section">
          <h2>Rate This Melody</h2>
          <div className="rating-slider-container">
            <input
              type="range"
              min="1"
              max="100"
              value={userRating || 50}
              onChange={(e) => setUserRating(parseInt(e.target.value))}
              className="rating-slider"
            />
            <div className="rating-value">{userRating || 0}/100</div>
          </div>
          <button 
            className="action-btn rate"
            onClick={handleRateGenome}
            disabled={!userRating}
          >
            Submit Rating
          </button>
        </div>
      </main>
    </div>
  );
};

export default MelodyMutate;
