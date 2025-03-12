from sqlalchemy.orm import Session
import json
import random
import os
from dotenv import load_dotenv
from . import models

# Load environment variables
load_dotenv()

GENOME_LENGTH = int(os.getenv("GENOME_LENGTH", 64))
INITIAL_GENOME_COUNT = int(os.getenv("INITIAL_GENOME_COUNT", 10))
TOP_GENOMES_TO_CROSSOVER = int(os.getenv("TOP_GENOMES_TO_CROSSOVER", 5))
GENES_TO_MUTATE = int(os.getenv("GENES_TO_MUTATE", 4))

def create_random_genome():
    """Create a random musical genome"""
    genome = []
    for _ in range(GENOME_LENGTH):
        gene = {
            "pitch": random.randint(36, 84),  # C2 to C6 range
            "duration": random.choice([0.25, 0.5, 1, 2]),  # Quarter, half, whole notes
            "velocity": random.randint(60, 100)  # Volume/intensity
        }
        genome.append(gene)
    return json.dumps(genome)


def initialize_genomes(db: Session):
    """Create initial random genomes for the first generation"""
    new_genomes = []
    for _ in range(INITIAL_GENOME_COUNT):
        genome_data = create_random_genome()
        genome = models.Genome(
            generation=0,
            data=genome_data,
            score=0.0,
            user_scored=False  # Genome not scored by a user
        )
        db.add(genome)
        print(genome.data)
        new_genomes.append(genome)
    
    db.commit()
    for genome in new_genomes:
        db.refresh(genome)
    
    return new_genomes

def get_top_genomes(db: Session, generation: int, count: int = TOP_GENOMES_TO_CROSSOVER):
    """Get the top scoring genomes from a generation"""
    return db.query(models.Genome).\
        filter(models.Genome.generation == generation).\
        order_by(models.Genome.score.desc()).\
        limit(count).all()

def crossover(parent1: models.Genome, parent2: models.Genome):
    """Create a new genome by crossing over two parent genomes"""
    parent1_data = json.loads(parent1.data)
    parent2_data = json.loads(parent2.data)
    
    # Simple crossover: take first half from parent1, second half from parent2
    crossover_point = len(parent1_data) // 2
    child_data = parent1_data[:crossover_point] + parent2_data[crossover_point:]
    
    return json.dumps(child_data)

# Update the create_next_generation function with a more conservative mutation approach

def create_next_generation(db: Session, current_generation: int):
    """Create the next generation of genomes through crossover with very conservative mutations"""
    top_genomes = get_top_genomes(db, current_generation)
    
    if len(top_genomes) < 2:
        # If we don't have at least 2 genomes, we can't do proper crossover
        return []
    
    new_genomes = []
    next_gen = current_generation + 1
    
    # Create offspring through crossover of top genomes
    for i in range(INITIAL_GENOME_COUNT):
        # Select two different parents from the top genomes
        parent1 = random.choice(top_genomes)
        parent2_candidates = [g for g in top_genomes if g.id != parent1.id]
        
        # Ensure we have a distinct parent2
        if not parent2_candidates:
            temp_genomes = [g for g in top_genomes if g.id != parent1.id]
            parent2 = random.choice(temp_genomes) if temp_genomes else random.choice(top_genomes)
        else:
            parent2 = random.choice(parent2_candidates)
        
        # Perform crossover to create child
        child_data = crossover(parent1, parent2)
        
        # Apply a very low chance of mutation (0.1% chance per gene)
        # This is the key change - using a per-gene mutation probability instead of whole genome
        child_genome = json.loads(child_data)
        for gene_idx in range(len(child_genome)):
            # 0.1% chance to mutate each gene (note)
            if random.random() < 0.001:  # 0.1% probability
                # If a gene is selected for mutation, apply a very small change
                gene = child_genome[gene_idx]
                
                # Pitch: change by at most 1-2 semitones
                if random.random() < 0.33:  # One third chance to mutate pitch
                    pitch_change = random.choice([-2, -1, 1, 2])
                    new_pitch = gene["pitch"] + pitch_change
                    # Keep within reasonable range
                    gene["pitch"] = max(36, min(84, new_pitch))
                
                # Duration: only change between adjacent values
                elif random.random() < 0.66:  # One third chance to mutate duration
                    durations = [0.25, 0.5, 1, 2]
                    current_idx = durations.index(gene["duration"]) if gene["duration"] in durations else 1
                    new_idx = max(0, min(len(durations) - 1, current_idx + random.choice([-1, 1])))
                    gene["duration"] = durations[new_idx]
                
                # Velocity: change by at most 5
                else:  # One third chance to mutate velocity
                    velocity_change = random.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])
                    new_velocity = gene["velocity"] + velocity_change
                    # Keep within reasonable range
                    gene["velocity"] = max(60, min(100, new_velocity))
        
        # Convert back to string
        child_data = json.dumps(child_genome)
        
        genome = models.Genome(
            generation=next_gen,
            data=child_data,
            score=0.0,
            user_scored=False,
            parent1_id=parent1.id,
            parent2_id=parent2.id
        )
        db.add(genome)
        new_genomes.append(genome)
    
    db.commit()
    for genome in new_genomes:
        db.refresh(genome)
    
    return new_genomes

# Make the apply_mutation function more conservative

def apply_mutation(genome_data: str, num_genes: int = GENES_TO_MUTATE, conservative: bool = True):
    """
    Apply random mutations to a genome
    
    Args:
        genome_data: JSON string representation of the genome
        num_genes: Number of genes to mutate
        conservative: If True, apply very small mutations
    """
    genome = json.loads(genome_data)
    
    # Choose random genes to mutate
    genes_to_mutate = random.sample(range(len(genome)), min(num_genes, len(genome)))
    
    for gene_idx in genes_to_mutate:
        gene = genome[gene_idx]
        
        if conservative:
            # Conservative mutations
            # Pitch: change by at most 1-2 semitones
            if random.random() < 0.33:
                pitch_change = random.choice([-2, -1, 1, 2])
                new_pitch = gene.get("pitch", 60) + pitch_change
                genome[gene_idx]["pitch"] = max(36, min(84, new_pitch))
            
            # Duration: only change between adjacent values
            elif random.random() < 0.66:
                durations = [0.25, 0.5, 1, 2]
                current_idx = durations.index(gene.get("duration", 0.5)) if gene.get("duration") in durations else 1
                new_idx = max(0, min(len(durations) - 1, current_idx + random.choice([-1, 1])))
                genome[gene_idx]["duration"] = durations[new_idx]
            
            # Velocity: change by at most 5
            else:
                velocity_change = random.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])
                new_velocity = gene.get("velocity", 80) + velocity_change
                genome[gene_idx]["velocity"] = max(60, min(100, new_velocity))
        else:
            # Original behavior for non-conservative mutations
            genome[gene_idx]["pitch"] = random.randint(36, 84)
            genome[gene_idx]["duration"] = random.choice([0.25, 0.5, 1, 2])
            genome[gene_idx]["velocity"] = random.randint(60, 100)
    
    return json.dumps(genome)

def get_genome_for_user(db: Session, generation: int):
    """Assign a genome to a user for mutation"""
    genomes_list = db.query(models.Genome).\
        filter(models.Genome.generation == generation).\
        all()
    
    if not genomes_list:
        if generation == 0:
            genomes_list = initialize_genomes(db)
        else:
            genomes_list = create_next_generation(db, generation - 1)
    
    return random.choice(genomes_list) if genomes_list else None


# Replace the existing heuristic_score function with this enhanced version

def heuristic_score(genome_data: str):
    """
    Compute a heuristic score based on multiple musical attributes:
    - Pitch range (variety of notes)
    - Rhythmic variety (different note durations)
    - Melodic contour (patterns of ups and downs)
    - Musical tension and resolution
    - Balance of consonant/dissonant intervals
    
    Returns a score from 0-100, with higher being better.
    """
    try:
        notes = json.loads(genome_data)
    except Exception as e:
        print(f"Error parsing genome data: {e}")
        return 50.0  # default if error parsing

    if not notes or len(notes) < 2:
        return 50.0  # default for empty or single-note genomes
    
    # Initialize scores for each component (0-20 points each)
    pitch_score = 0
    rhythm_score = 0
    contour_score = 0
    phrase_score = 0
    interval_score = 0
    
    # 1. Pitch range and distribution (20 points)
    pitches = [note.get("pitch", 60) for note in notes]
    pitch_range = max(pitches) - min(pitches)
    
    # Reward a good range (neither too narrow nor too wide)
    if 5 <= pitch_range <= 24:  # About 2 octaves maximum
        pitch_score = 20 * (1 - abs(pitch_range - 12) / 12)
    else:
        pitch_score = 5  # Penalize extremely narrow or wide ranges
    
    # Check for pitch variety (unique pitches)
    unique_pitches = len(set(pitches))
    pitch_score += min(10, unique_pitches) / 2  # Up to 5 points for unique pitches
    
    # 2. Rhythmic variety (20 points)
    durations = [note.get("duration", 0.5) for note in notes]
    unique_durations = len(set(durations))
    
    # Reward for having different note durations (2-5 different durations is ideal)
    if 2 <= unique_durations <= 5:
        rhythm_score = 10 + (unique_durations - 1) * 2
    elif unique_durations > 5:
        rhythm_score = 15  # Still good but might be too complex
    else:
        rhythm_score = 5  # Only one duration is boring
    
    # Check for rhythm patterns (repetition can be pleasing)
    rhythm_patterns = 0
    for i in range(len(durations) - 2):
        if durations[i] == durations[i + 2]:
            rhythm_patterns += 1
    rhythm_score += min(5, rhythm_patterns)
    
    # 3. Melodic contour - patterns of ups and downs (20 points)
    contour = []
    for i in range(1, len(pitches)):
        if pitches[i] > pitches[i-1]:
            contour.append(1)  # Up
        elif pitches[i] < pitches[i-1]:
            contour.append(-1)  # Down
        else:
            contour.append(0)  # Same
    
    # Count direction changes (too many changes = erratic, too few = boring)
    direction_changes = 0
    for i in range(1, len(contour)):
        if contour[i] != contour[i-1] and contour[i-1] != 0:
            direction_changes += 1
    
    # Ideal: some direction changes but not too erratic
    ideal_changes = (len(contour) - 1) / 2
    contour_score = 20 * (1 - abs(direction_changes - ideal_changes) / ideal_changes)
    contour_score = max(5, min(20, contour_score))  # Cap between 5-20
    
    # 4. Phrase structure (20 points)
    # Look for repeated pitch patterns which suggest musical phrases
    phrase_matches = 0
    for pattern_length in range(2, min(5, len(pitches) // 2 + 1)):
        for i in range(len(pitches) - 2 * pattern_length + 1):
            pattern = tuple(pitches[i:i+pattern_length])
            for j in range(i + pattern_length, len(pitches) - pattern_length + 1):
                if tuple(pitches[j:j+pattern_length]) == pattern:
                    phrase_matches += pattern_length
                    break
    
    # Reward some repetition but not too much
    if phrase_matches > 0:
        phrase_score = min(20, phrase_matches * 2)
    
    # 5. Musical intervals (20 points)
    # Calculate the intervals between consecutive notes
    intervals = []
    for i in range(1, len(pitches)):
        intervals.append(abs(pitches[i] - pitches[i-1]))
    
    # Count consonant intervals (unison, perfect 4th, perfect 5th, octave)
    consonant_intervals = sum(1 for i in intervals if i in [0, 5, 7, 12])
    
    # Ideal: mix of consonant and dissonant intervals, with more consonant ones
    consonant_ratio = consonant_intervals / len(intervals) if intervals else 0
    if 0.4 <= consonant_ratio <= 0.8:  # 40-80% consonant is pleasing
        interval_score = 20
    else:
        interval_score = 20 * (1 - abs(consonant_ratio - 0.6) / 0.6)
    
    # Combine all scores (all components equally weighted)
    final_score = (pitch_score + rhythm_score + contour_score + phrase_score + interval_score)
    
    # Normalize to 0-100
    normalized_score = min(100, max(0, final_score))
    
    return normalized_score