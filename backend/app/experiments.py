from sqlalchemy.orm import Session
import json
import random
from datetime import datetime
from . import models, genomes
from sqlalchemy import func

def create_experiment(db: Session, name: str, description: str = None, max_generations: int = 1000):
    """Create a new experiment with initial random genomes"""
    # Create the experiment
    experiment = models.Experiment(
        name=name,
        description=description,
        current_generation=0,
        max_generations=max_generations
    )
    db.add(experiment)
    db.flush()  # To get the experiment ID
    
    # Create initial genomes for the experiment
    initial_genomes = []
    for _ in range(genomes.INITIAL_GENOME_COUNT):
        genome_data = genomes.create_random_genome()
        genome = models.Genome(
            generation=0,
            data=genome_data,
            score=0.0
        )
        db.add(genome)
        db.flush()  # To get the genome ID
        
        # Link genome to experiment
        genome_experiment = models.GenomeExperiment(
            genome_id=genome.id,
            experiment_id=experiment.id,
            generation=0
        )
        db.add(genome_experiment)
        initial_genomes.append(genome)
    
    db.commit()
    db.refresh(experiment)
    
    return experiment, initial_genomes

def get_all_experiments(db: Session, skip: int = 0, limit: int = 100):
    """Get all experiments with stats"""
    experiments = db.query(models.Experiment).offset(skip).limit(limit).all()
    
    result = []
    for exp in experiments:
        # Count contributions (mutations) for this experiment
        contributions = db.query(func.count(models.Mutation.id)).join(
            models.GenomeExperiment,
            models.GenomeExperiment.genome_id == models.Mutation.genome_id
        ).filter(
            models.GenomeExperiment.experiment_id == exp.id
        ).scalar()
        
        exp_dict = {
            "id": exp.id,
            "name": exp.name,
            "description": exp.description,
            "current_generation": exp.current_generation,
            "max_generations": exp.max_generations,
            "best_score": exp.best_score,
            "completed": exp.completed,
            "final_piece_name": exp.final_piece_name,
            "created_at": exp.created_at,
            "total_contributions": contributions or 0
        }
        result.append(exp_dict)
    
    return result

def get_experiment(db: Session, experiment_id: int):
    """Get a specific experiment by ID"""
    experiment = db.query(models.Experiment).filter(models.Experiment.id == experiment_id).first()
    if not experiment:
        return None
        
    # Count contributions for this experiment
    contributions = db.query(func.count(models.Mutation.id)).join(
        models.GenomeExperiment,
        models.GenomeExperiment.genome_id == models.Mutation.genome_id
    ).filter(
        models.GenomeExperiment.experiment_id == experiment.id
    ).scalar()
    
    return {
        "id": experiment.id,
        "name": experiment.name,
        "description": experiment.description,
        "current_generation": experiment.current_generation,
        "max_generations": experiment.max_generations,
        "best_score": experiment.best_score,
        "completed": experiment.completed,
        "final_piece_name": experiment.final_piece_name,
        "created_at": experiment.created_at,
        "total_contributions": contributions or 0
    }

def get_random_genome_from_experiment(db: Session, experiment_id: int, generation: int = None):
    """Get a random genome from the specified experiment and generation"""
    query = db.query(models.Genome).join(
        models.GenomeExperiment,
        models.GenomeExperiment.genome_id == models.Genome.id
    ).filter(
        models.GenomeExperiment.experiment_id == experiment_id
    )
    
    # If generation is specified, filter by that generation
    if generation is not None:
        query = query.filter(models.GenomeExperiment.generation == generation)
    
    # Get all matching genomes
    genomes_list = query.all()
    
    if not genomes_list:
        return None
        
    # Choose a random genome
    return random.choice(genomes_list)

def get_random_genome_from_any_experiment(db: Session):
    """Get a random genome from any active experiment's current generation"""
    # Get all active experiments
    experiments = db.query(models.Experiment).filter(models.Experiment.completed == False).all()
    
    if not experiments:
        return None
    
    # Choose a random experiment
    experiment = random.choice(experiments)
    
    # Get a random genome from this experiment's current generation
    return get_random_genome_from_experiment(db, experiment.id, experiment.current_generation)

def advance_experiment_generation(db: Session, experiment_id: int):
    """Advance an experiment to the next generation through crossover"""
    experiment = db.query(models.Experiment).filter(models.Experiment.id == experiment_id).first()
    if not experiment:
        return None
    
    # Check if all genomes in current generation have been scored
    current_gen_genomes = db.query(models.Genome).join(
        models.GenomeExperiment,
        models.GenomeExperiment.genome_id == models.Genome.id
    ).filter(
        models.GenomeExperiment.experiment_id == experiment_id,
        models.GenomeExperiment.generation == experiment.current_generation
    ).all()
    
    # Check if any genomes still have score=0 (not rated yet)
    unscored_genomes = [g for g in current_gen_genomes if g.score == 0]
    if unscored_genomes:
        return {"status": "pending", "message": f"{len(unscored_genomes)} genomes still need scoring"}
    
    # Get top genomes for crossover
    top_genomes = db.query(models.Genome).join(
        models.GenomeExperiment,
        models.GenomeExperiment.genome_id == models.Genome.id
    ).filter(
        models.GenomeExperiment.experiment_id == experiment_id,
        models.GenomeExperiment.generation == experiment.current_generation
    ).order_by(
        models.Genome.score.desc()
    ).limit(genomes.TOP_GENOMES_TO_CROSSOVER).all()
    
    if len(top_genomes) < 2:
        return {"status": "error", "message": "Not enough genomes for crossover"}
    
    # Create next generation
    next_gen = experiment.current_generation + 1
    new_genomes = []
    
    # Check if we've reached maximum generations
    if next_gen >= experiment.max_generations:
        # Complete the experiment
        experiment.completed = True
        experiment.final_piece_name = f"Evolved Melody #{experiment.id}"
        experiment.final_genome_id = top_genomes[0].id  # Best genome
        db.commit()
        return {
            "status": "completed", 
            "message": "Experiment completed with max generations", 
            "final_genome_id": top_genomes[0].id,
            "final_score": top_genomes[0].score
        }
    
    # Create offspring through crossover of top genomes
    for _ in range(genomes.INITIAL_GENOME_COUNT):
        # Select two different parents
        parent1 = random.choice(top_genomes)
        parent2 = random.choice([g for g in top_genomes if g.id != parent1.id])
        
        # Do crossover
        child_data = genomes.crossover(parent1, parent2)
        
        # Create new genome
        genome = models.Genome(
            generation=next_gen,
            data=child_data,
            score=0.0,
            parent1_id=parent1.id,
            parent2_id=parent2.id
        )
        db.add(genome)
        db.flush()  # Get the new ID
        
        # Link to experiment
        genome_experiment = models.GenomeExperiment(
            genome_id=genome.id,
            experiment_id=experiment_id,
            generation=next_gen
        )
        db.add(genome_experiment)
        new_genomes.append(genome)
    
    # Update experiment current generation
    experiment.current_generation = next_gen
    
    # Update best score if applicable
    if top_genomes[0].score > experiment.best_score:
        experiment.best_score = top_genomes[0].score
    
    db.commit()
    
    return {
        "status": "success", 
        "message": f"Advanced to generation {next_gen}", 
        "new_generation": next_gen,
        "genome_count": len(new_genomes)
    }

def initialize_default_experiments(db: Session):
    """Create default experiments if none exist"""
    exp_count = db.query(models.Experiment).count()
    if exp_count == 0:
        experiments = [
            ("Experiment 1", "A test experiment for development purposes"),
            ("Experiment 2", "Another test experiment for development purposes  "),
            ("Experiment 3", "Yet another test experiment for development purposes"),
        ]
        
        for name, description in experiments:
            create_experiment(db, name, description)
        
        return True
    return False