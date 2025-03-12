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

def create_next_generation(db: Session, current_generation: int):
    """Create the next generation of genomes through crossover"""
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
        
        # Ensure we have a distinct parent2 by using different selection strategy if needed
        if not parent2_candidates:
            # Create a temporary list excluding parent1
            temp_genomes = [g for g in top_genomes if g.id != parent1.id]
            # If no different parents (should not happen if we have at least 2 genomes)
            # then select any other genome
            parent2 = random.choice(temp_genomes) if temp_genomes else random.choice(top_genomes)
        else:
            parent2 = random.choice(parent2_candidates)
        
        # Perform crossover to create child
        child_data = crossover(parent1, parent2)
        
        # Apply a small chance of mutation (10% chance)
        if random.random() < 0.1:
            child_data = apply_mutation(child_data, num_genes=int(GENOME_LENGTH * 0.05))
        
        genome = models.Genome(
            generation=next_gen,
            data=child_data,
            score=0.0,
            user_scored=False,  # Newly created genomes start with heuristic (or unscored) values
            parent1_id=parent1.id,
            parent2_id=parent2.id  # Always store parent2_id
        )
        db.add(genome)
        new_genomes.append(genome)
    
    db.commit()
    for genome in new_genomes:
        db.refresh(genome)
    
    return new_genomes

def apply_mutation(genome_data: str, num_genes: int = GENES_TO_MUTATE):
    """Apply random mutations to a genome"""
    genome = json.loads(genome_data)
    
    # Choose random genes to mutate
    genes_to_mutate = random.sample(range(len(genome)), num_genes)
    
    for gene_idx in genes_to_mutate:
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

def heuristic_score(genome_data: str):
    """
    Compute a heuristic score based on the genome data.
    Here we use the average pitch normalized to a 0-100 range.
    """
    try:
        notes = json.loads(genome_data)
    except Exception:
        return 50.0  # default if error parsing

    if not notes:
        return 50.0

    total = 0
    count = 0
    for note in notes:
        pitch = note.get("pitch", 60)
        total += pitch
        count += 1
    avg_pitch = total / count if count else 60
    # Normalize (assuming MIDI pitch range 0-127)
    normalized = (avg_pitch / 127) * 100
    return normalized
