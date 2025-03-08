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
    # Simple example: create a genome as an array of numbers representing notes or musical features
    genome = []
    for _ in range(GENOME_LENGTH):
        # Generate random notes or musical features
        # Here we're using values between 0-127 (MIDI note range)
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
            score=0.0
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
        return []  # Not enough genomes to create a new generation
    
    new_genomes = []
    next_gen = current_generation + 1
    
    # Create offspring through crossover of top genomes
    for i in range(INITIAL_GENOME_COUNT):
        # Select two different parents from the top genomes
        parent1 = random.choice(top_genomes)
        parent2 = random.choice([g for g in top_genomes if g.id != parent1.id]) if len(top_genomes) > 1 else parent1
        
        child_data = crossover(parent1, parent2)
        
        genome = models.Genome(
            generation=next_gen,
            data=child_data,
            score=0.0,
            parent1_id=parent1.id,
            parent2_id=parent2.id if parent1.id != parent2.id else None
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
        # Randomly modify the gene values
        genome[gene_idx]["pitch"] = random.randint(36, 84)
        genome[gene_idx]["duration"] = random.choice([0.25, 0.5, 1, 2])
        genome[gene_idx]["velocity"] = random.randint(60, 100)
    
    return json.dumps(genome)

def get_genome_for_user(db: Session, generation: int):
    """Assign a genome to a user for mutation"""
    # Get a random genome from the current generation
    genomes = db.query(models.Genome).\
        filter(models.Genome.generation == generation).\
        all()
    
    if not genomes:
        # If no genomes in this generation, initialize new ones or create from previous generation
        if generation == 0:
            genomes = initialize_genomes(db)
        else:
            genomes = create_next_generation(db, generation - 1)
    
    return random.choice(genomes) if genomes else None