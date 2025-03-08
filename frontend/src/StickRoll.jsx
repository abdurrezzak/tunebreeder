import React, { useState, useEffect, useRef } from 'react';

/**
 * A stick/piano-roll style component that:
 *  - Lays out each note horizontally by its "start time" or simply in sequence.
 *  - Uses the note's duration for the bar width.
 *  - Uses the note's pitch for vertical position (or color).
 *  - Highlights the currently playing note in purple.
 *  - Auto-scrolls to keep the active note visible.
 */
const StickRoll = ({ notes = [], playingIndex, selectedIndices = [], onToggleNote }) => {
  // Reference to the container and the active note element
  const containerRef = useRef(null);
  const activeNoteRef = useRef(null);
  
  // Scale factors (tweak as needed):
  const DURATION_SCALE = 80;  // how many px per 1s of duration
  const PITCH_SCALE = 2;      // how many px per pitch step
  const MIN_PITCH = 36;       // your minimum pitch
  const MAX_PITCH = 96;       // your maximum pitch
  const BASE_HEIGHT = 20;     // base bar thickness if you prefer a minimum

  // We'll compute the left offset cumulatively so each note follows the previous one.
  let cumulativeX = 0;
  
  // Auto-scroll when playingIndex changes
  useEffect(() => {
    if (playingIndex >= 0 && containerRef.current && activeNoteRef.current) {
      const container = containerRef.current;
      const activeNote = activeNoteRef.current;
      
      // Calculate the note's position relative to the container
      const noteLeft = activeNote.offsetLeft;
      const noteWidth = activeNote.offsetWidth;
      
      // Determine if the note is outside the visible area
      const containerScrollLeft = container.scrollLeft;
      const containerWidth = container.clientWidth;
      
      // If note is not fully visible, scroll to it
      if (noteLeft < containerScrollLeft || 
          noteLeft + noteWidth > containerScrollLeft + containerWidth) {
        
        // Calculate the scroll position to center the note
        const scrollTo = noteLeft - (containerWidth / 2) + (noteWidth / 2);
        
        // Smooth scroll to the note
        container.scrollTo({
          left: Math.max(0, scrollTo),
          behavior: 'smooth'
        });
      }
    }
  }, [playingIndex]);

  return (
    <div
      ref={containerRef}
      className="stickroll-container"
      style={{
        position: 'relative',
        width: '100%',
        height: '300px',
        border: '1px solid #ccc',
        overflowX: 'auto',
        overflowY: 'hidden',
        background: 'rgba(250, 245, 255, 0.5)' // Light purple background
      }}
    >
      {notes.map((note, i) => {
        const pitch = note.pitch ?? Math.round(note.frequency ?? 60);
        const duration = note.duration ?? 0.5;
        const velocity = note.velocity ?? 80;

        // Convert pitch to purple tones
        // Map pitch to a value between 0-100 for lightness
        const clampedPitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, pitch));
        const normalizedPitch = (clampedPitch - MIN_PITCH) / (MAX_PITCH - MIN_PITCH);
        
        // Purple hue ranges (260-280 are purple tones)
        const hue = 260 + normalizedPitch * 20; // 260-280 range for purples
        const saturation = 70 + normalizedPitch * 30; // 70-100%
        const lightness = 30 + (1 - normalizedPitch) * 30; // 30-60%
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        // The bar's width depends on duration
        const barWidth = duration * DURATION_SCALE;
        const left = cumulativeX;
        cumulativeX += barWidth + 5; // add some spacing

        // The bar's vertical position
        const top = 250 - pitch * PITCH_SCALE;
        const height = BASE_HEIGHT;

        // If the note is playing, highlight in brighter purple
        const isPlaying = i === playingIndex;
        const backgroundColor = isPlaying ? 'rgb(153, 51, 255)' : color;
        
        // Check if this note is selected
        const isSelected = selectedIndices.includes(i);
        const border = isSelected ? '2px solid rgb(255, 105, 180)' : 'none';

        return (
          <div
            key={i}
            ref={isPlaying ? activeNoteRef : null}
            style={{
              position: 'absolute',
              left: `${left}px`,
              top: `${top}px`,
              width: `${barWidth}px`,
              height: `${height}px`,
              backgroundColor,
              border,
              borderRadius: '4px',
              cursor: 'pointer',
              boxShadow: isPlaying ? '0 0 10px rgba(153, 51, 255, 0.8)' : 'none',
              transition: 'background-color 0.3s, box-shadow 0.3s'
            }}
            title={`Pitch: ${pitch}, Dur: ${duration}, Vel: ${velocity}`}
            onClick={() => onToggleNote && onToggleNote(i)}
          />
        );
      })}
    </div>
  );
};

export default StickRoll;
