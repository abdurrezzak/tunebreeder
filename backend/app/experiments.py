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
    
    print(f"Found {len(genomes_list)} genomes for experiment {experiment_id}" + 
          (f" at generation {generation}" if generation is not None else ""))
    
    if not genomes_list:
        print(f"No genomes available for experiment {experiment_id}" +
              (f" at generation {generation}" if generation is not None else ""))
        return None
        
    # Choose a random genome
    selected_genome = random.choice(genomes_list)
    print(f"Selected genome ID: {selected_genome.id}")
    return selected_genome

def get_random_genome_from_any_experiment(db: Session):
    """Get a random genome from any active experiment's current generation"""
    # Get all active experiments
    experiments = db.query(models.Experiment).filter(models.Experiment.completed == False).all()
    
    # Log available experiments
    print(f"Available active experiments: {len(experiments)}")
    for exp in experiments:
        print(f"Experiment ID: {exp.id}, Name: {exp.name}, Generation: {exp.current_generation}")
    
    if not experiments:
        print("No active experiments found!")
        return None
    
    # Try to find genomes from any experiment's current generation
    random.shuffle(experiments)  # Randomize the order to try
    
    # First pass: try current generation of each experiment
    for experiment in experiments:
        print(f"Trying experiment: {experiment.id} - {experiment.name} (Generation {experiment.current_generation})")
        genome = get_random_genome_from_experiment(db, experiment.id, experiment.current_generation)
        if genome:
            print(f"Found genome ID: {genome.id} from experiment {experiment.id}, generation {experiment.current_generation}")
            return genome
    
    # Second pass: if no genomes in current generations, try earlier generations
    print("No genomes found in current generations, trying previous generations")
    for experiment in experiments:
        # Try up to 5 previous generations
        for gen_offset in range(1, 6):
            prev_gen = experiment.current_generation - gen_offset
            if prev_gen >= 0:  # Don't go below generation 0
                print(f"Trying experiment: {experiment.id} - {experiment.name} (Generation {prev_gen})")
                genome = get_random_genome_from_experiment(db, experiment.id, prev_gen)
                if genome:
                    print(f"Found genome ID: {genome.id} from experiment {experiment.id}, generation {prev_gen}")
                    return genome
    
    # If we still haven't found anything, try to get any genome from the experiments
    print("No genomes found in recent generations, trying any generation")
    for experiment in experiments:
        print(f"Trying any generation for experiment: {experiment.id}")
        genome = get_random_genome_from_experiment(db, experiment.id)  # No generation specified = any generation
        if genome:
            print(f"Found genome ID: {genome.id} from experiment {experiment.id}, generation {genome.generation}")
            return genome
    
    print("No genomes found in any experiment")
    return None

def advance_experiment_generation(db: Session, experiment_id: int):
    """Advance an experiment to the next generation through crossover"""
    try:
        experiment = db.query(models.Experiment).filter(models.Experiment.id == experiment_id).first()
        if not experiment:
            print(f"Experiment {experiment_id} not found")
            return None
        
        print(f"Advancing experiment {experiment_id} from generation {experiment.current_generation}")
        
        # IMPORTANT: Only get genomes from THIS experiment's current generation
        current_gen_genomes = db.query(models.Genome).join(
            models.GenomeExperiment,
            models.GenomeExperiment.genome_id == models.Genome.id
        ).filter(
            models.GenomeExperiment.experiment_id == experiment_id,
            models.GenomeExperiment.generation == experiment.current_generation
        ).all()
        
        print(f"Found {len(current_gen_genomes)} genomes in experiment {experiment_id} generation {experiment.current_generation}")
        
        # Find human-scored genomes
        scored_genomes = [g for g in current_gen_genomes if g.score > 0]
        unscored_genomes = [g for g in current_gen_genomes if g.score == 0]
        
        print(f"Found {len(scored_genomes)} scored genomes and {len(unscored_genomes)} unscored genomes")
        
        if len(scored_genomes) == 0:
            print(f"No human-scored genomes in experiment {experiment_id} generation {experiment.current_generation}")
            return {"status": "pending", "message": "Waiting for at least one human contribution"}
        
        # Calculate heuristic scores for unscored genomes to ensure we have enough diversity
        for genome in unscored_genomes:
            genome.score = genomes.heuristic_score(genome.data)
        
        # Get top genomes for crossover - include all available genomes but sort by score
        all_genomes = scored_genomes + unscored_genomes
        top_genomes = sorted(all_genomes, key=lambda g: g.score, reverse=True)[:genomes.TOP_GENOMES_TO_CROSSOVER]
        
        if len(top_genomes) < 2:
            return {"status": "error", "message": "Not enough genomes for evolution"}
        
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
            # Select two different parents from top genomes
            parent1 = random.choice(top_genomes)
            parent2_candidates = [g for g in top_genomes if g.id != parent1.id]
            
            if not parent2_candidates:
                # If no different parents (unlikely), use a different sampling approach
                # by temporarily removing parent1 from consideration
                temp_genomes = [g for g in top_genomes if g.id != parent1.id]
                if not temp_genomes:
                    temp_genomes = all_genomes
                parent2 = random.choice(temp_genomes)
            else:
                parent2 = random.choice(parent2_candidates)
            
            # Perform crossover
            child_data = genomes.crossover(parent1, parent2)
            
            
                        # Apply a small chance of mutation to the result (10% chance)
            if random.random() < 0.1:
                child_data = genomes.apply_mutation(child_data, num_genes=int(genomes.GENOME_LENGTH * 0.05))


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
            
            print(f"Created new genome {genome.id} for experiment {experiment_id} generation {next_gen} " + 
                  f"with parent1 {parent1.id} and parent2 {parent2.id}")
        
        # Update experiment current generation
        experiment.current_generation = next_gen
        
        # Update best score if applicable
        if top_genomes[0].score > experiment.best_score:
            experiment.best_score = top_genomes[0].score
        
        db.commit()
        
        print(f"Successfully advanced experiment {experiment_id} to generation {next_gen} with {len(new_genomes)} genomes based on {len(scored_genomes)} human-scored genomes")
        
        return {
            "status": "success", 
            "message": f"Advanced to generation {next_gen} with {len(scored_genomes)} human contributions", 
            "new_generation": next_gen,
            "genome_count": len(new_genomes),
            "human_contributions": len(scored_genomes)
        }
    except Exception as e:
        print(f"Error advancing experiment {experiment_id}: {str(e)}")
        # Rollback if there was an error
        db.rollback()
        return {"status": "error", "message": f"Error: {str(e)}"}

def initialize_default_experiments(db: Session):
    """Create default experiments if none exist"""
    exp_count = db.query(models.Experiment).count()
    if exp_count == 0:
        experiments = [
            ("Experiment 1", "A test experiment for development purposes"),
            ("Experiment 2", "Another test experiment for development purposes"),
            ("Experiment 3", "A test experiment for development purposes")
        ]
        
        for name, description in experiments:
            create_experiment(db, name, description)
        
        return True
    return False


def diagnose_and_repair_experiments(db: Session):
    """
    Diagnose experiment issues and repair by:
    1. Finding the highest generation with actual genomes for each experiment
    2. Resetting the experiment's current_generation to that value
    """
    print("Running database diagnosis for experiments...")
    experiments_list = db.query(models.Experiment).filter(models.Experiment.completed == False).all()
    
    for exp in experiments_list:
        print(f"\nDiagnosing Experiment {exp.id} ({exp.name}):")
        print(f"  Current generation counter: {exp.current_generation}")
        
        # Find all generations that have genomes for this experiment
        generations_with_genomes = db.query(models.GenomeExperiment.generation)\
            .filter(models.GenomeExperiment.experiment_id == exp.id)\
            .distinct()\
            .order_by(models.GenomeExperiment.generation.desc())\
            .all()
        
        generations = [g[0] for g in generations_with_genomes]
        print(f"  Generations with genomes: {generations}")
        
        # Count genomes per generation
        for gen in generations:
            count = db.query(models.GenomeExperiment)\
                .filter(
                    models.GenomeExperiment.experiment_id == exp.id,
                    models.GenomeExperiment.generation == gen
                ).count()
            print(f"  - Generation {gen}: {count} genomes")
        
        if not generations:
            print(f"  ERROR: No genomes associated with experiment {exp.id}!")
            # Create initial genomes
            print(f"  Creating initial genomes for experiment {exp.id}")
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
                    experiment_id=exp.id,
                    generation=0
                )
                db.add(genome_experiment)
                initial_genomes.append(genome)
            
            # Reset experiment counter
            exp.current_generation = 0
            print(f"  Reset experiment {exp.id} to generation 0 with {len(initial_genomes)} new genomes")
        elif max(generations) < exp.current_generation:
            # If there's a mismatch between the highest generation with genomes and the experiment counter
            highest_gen = max(generations)
            print(f"  Mismatch: Highest generation with genomes is {highest_gen}, but experiment counter is {exp.current_generation}")
            
            # Get the latest generation with enough genomes
            for gen in sorted(generations, reverse=True):
                count = db.query(models.GenomeExperiment)\
                    .filter(
                        models.GenomeExperiment.experiment_id == exp.id,
                        models.GenomeExperiment.generation == gen
                    ).count()
                if count >= 5:  # Minimum threshold for a valid generation
                    exp.current_generation = gen
                    print(f"  Reset experiment {exp.id} current_generation to {gen}")
                    break
            else:
                # If no generation has enough genomes, reset to 0
                exp.current_generation = 0
                print(f"  Reset experiment {exp.id} current_generation to 0")
    
    db.commit()
    print("\nDiagnosis and repair completed.")