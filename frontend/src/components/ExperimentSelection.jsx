import React, { useState, useEffect } from 'react';
import '../HomePage.css';

const ExperimentSelection = ({ onSelectGenome, onSelectGenomeWithContribution }) => {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchExperiments();
  }, []);

  const fetchExperiments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/experiments', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch experiments');
      
      const data = await response.json();
      setExperiments(data);
    } catch (err) {
      console.error('Error fetching experiments:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRandomSelect = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/genome/random', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch random genome');
      
      const genomeData = await response.json();
      onSelectGenome(genomeData);
    } catch (err) {
      console.error('Error fetching random genome:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExperimentSelect = async (experimentId, generation) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // First check if user has already contributed to this experiment's generation
      const contributionCheck = await fetch(
        `http://localhost:8000/api/experiments/${experimentId}/generation/${generation}/contribution`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      const contributionStatus = await contributionCheck.json();
      
      if (contributionStatus.has_contributed) {
        // User has already contributed - get the genome anyway but set the countdown state
        const response = await fetch(`http://localhost:8000/api/experiments/${experimentId}/generation/${generation}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) throw new Error('Failed to fetch genome from experiment');
        
        const genomeData = await response.json();
        
        // Ensure we're storing the contribution record in localStorage
        const contributionKey = `${experimentId}_${generation}`;
        const storedContributions = JSON.parse(localStorage.getItem('userContributions') || '{}');
        storedContributions[contributionKey] = true;
        localStorage.setItem('userContributions', JSON.stringify(storedContributions));
        
        // Set next update time in the parent component
        if (contributionStatus.next_update) {
          const nextUpdateTime = new Date(contributionStatus.next_update);
          onSelectGenomeWithContribution(genomeData, true, nextUpdateTime);
        } else {
          onSelectGenomeWithContribution(genomeData, true);
        }
      } else {
        // User hasn't contributed yet - proceed normally
        const response = await fetch(`http://localhost:8000/api/experiments/${experimentId}/generation/${generation}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) throw new Error('Failed to fetch genome from experiment');
        
        const genomeData = await response.json();
        onSelectGenomeWithContribution(genomeData, false);
      }
    } catch (err) {
      console.error('Error selecting experiment:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalPiecePlay = async (experimentId, finalGenomeId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch the final genome data
      const response = await fetch(`http://localhost:8000/api/genomes/${finalGenomeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch final piece');
      
      const genomeData = await response.json();
      
      // Pass the genome to the parent with a special flag indicating it's a final piece
      onSelectGenome({
        ...genomeData,
        isFinalPiece: true,
        experimentId: experimentId
      });
    } catch (err) {
      console.error('Error fetching final piece:', err);
      setError(`Failed to load final piece: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Function to get experiment icon based on name
  const getExperimentIcon = (name) => {
    if (name.toLowerCase().includes('experiment 1')) {
      return <i className="fas fa-flask"></i>;
    } else if (name.toLowerCase().includes('experiment 2')) {
      return <i className="fas fa-atom"></i>;
    } else if (name.toLowerCase().includes('experiment 3')) {
      return <i className="fas fa-vial"></i>;
    } else {
      return <i className="fas fa-microscope"></i>;
    }
  };

  // Function to get experiment description
  const getExperimentDescription = (name) => {
    if (name.toLowerCase().includes('experiment 1')) {
      return "Exploring melodic patterns through evolutionary algorithms";
    } else if (name.toLowerCase().includes('experiment 2')) {
      return "Evolving complex rhythmic structures through genetic selection";
    } else if (name.toLowerCase().includes('experiment 3')) {
      return "Developing advanced harmonic progressions using AI";
    } else {
      return "A musical evolutionary experiment";
    }
  };

  const calculateProgress = (experiment) => {
    const maxGen = experiment.max_generations || 4;
    
    return Math.min(100, Math.round(((experiment.current_generation + 1) / maxGen) * 100));
  };


  if (loading) {
    return (
      <div className="experiment-selection loading">
        <div className="loading-spinner">
          <i className="fas fa-spinner fa-spin"></i>
        </div>
        <p>Loading experiments...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="experiment-selection error">
        <p className="error-message"><i className="fas fa-exclamation-triangle"></i> Error: {error}</p>
        <button className="primary-btn" onClick={fetchExperiments}>
          <i className="fas fa-sync"></i> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="experiment-selection">
      <div className="selection-header">
        <h2><i className="fas fa-dna"></i> Select an Experiment</h2>
        <p>Choose an experiment to contribute to, or pick a random genome to work with.</p>
      </div>
      
      <div className="random-selection-card" onClick={handleRandomSelect}>
        <div className="random-icon">
          <i className="fas fa-dice"></i>
        </div>
        <div className="random-content">
          <h3>Random Selection</h3>
          <p>Get a random genome from any ongoing experiment</p>
        </div>
        <div className="selection-arrow">
          <i className="fas fa-arrow-right"></i>
        </div>
      </div>
      
      <div className="experiments-divider">
        <span>OR CHOOSE AN EXPERIMENT</span>
      </div>
      
      <div className="experiments-list">
        {experiments.length > 0 ? (
          experiments.map(experiment => (
            <div key={experiment.id} className="experiment-card">
              <div className="experiment-header">
                <div className="experiment-title">
                  <span className="experiment-icon">{getExperimentIcon(experiment.name)}</span>
                  <h3>{experiment.name}</h3>
                </div>
                <span className={`experiment-status ${experiment.completed ? 'completed' : 'active'}`}>
                  {experiment.completed ? <><i className="fas fa-check-circle"></i> Completed</> : <><i className="fas fa-sync"></i> Active</>}
                </span>
              </div>
              
              <p className="experiment-description">
                {getExperimentDescription(experiment.name)}
              </p>
              
              <div className="experiment-stats">
                <div className="stat">
                  <span className="stat-label"><i className="fas fa-layer-group"></i> Generation</span>
                  <span className="stat-value">{experiment.current_generation}</span>
                </div>
                <div className="stat">
                  <span className="stat-label"><i className="fas fa-star"></i> Best Score</span>
                  <span className="stat-value">{Math.round(experiment.best_score)}</span>
                </div>
                <div className="stat">
                  <span className="stat-label"><i className="fas fa-users"></i> Contributions</span>
                  <span className="stat-value">{experiment.total_contributions}</span>
                </div>
              </div>
              
                
              
              {!experiment.completed && (
                <button 
                  className="contribute-btn"
                  onClick={() => handleExperimentSelect(experiment.id, experiment.current_generation)}
                >
                  <i className="fas fa-hand-holding-heart"></i> Contribute to This Experiment
                </button>
              )}
              
              {experiment.completed && (
                <div className="experiment-final">
                  <p><i className="fas fa-trophy"></i> Final piece created: <strong>{experiment.final_piece_name || `Experiment ${experiment.id} Result`}</strong></p>
                  <button 
                    className="view-final-btn"
                    onClick={() => handleFinalPiecePlay(experiment.id, experiment.final_genome_id)}
                  >
                    <i className="fas fa-play"></i> Listen to Final Piece
                  </button>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="no-experiments">
            <i className="fas fa-flask fa-3x"></i>
            <p>No active experiments found.</p>
            <p>Please check back later or contact an administrator.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExperimentSelection;