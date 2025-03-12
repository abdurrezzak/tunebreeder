from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
import json
import os
from dotenv import load_dotenv
# Add these imports at the top
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import pytz

from . import models, schemas, auth, database, genomes
from .database import engine
from . import experiments

# Load environment variables
load_dotenv()

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TuneBreeder API")

# Configure CORS
origins = [
    "http://localhost:3000",  # React development server
    "http://localhost:8000",  # FastAPI server if serving frontend
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Authentication endpoints
@app.post("/api/register", response_model=schemas.User)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = auth.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username exists
    username_exists = db.query(models.User).filter(models.User.username == user.username).first()
    if username_exists:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(email=user.email, username=user.username, hashed_password=hashed_password)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/users/me", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_active_user)):
    return current_user

# Genome endpoints
@app.get("/api/genome/current")
def get_current_genome(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a genome for the user to mutate from the current active generation"""
    # Find the current active generation (highest generation number)
    latest_gen = db.query(models.Genome.generation).order_by(models.Genome.generation.desc()).first()
    current_gen = latest_gen[0] if latest_gen else 0
    
    genome = genomes.get_genome_for_user(db, current_gen)
    if not genome:
        raise HTTPException(status_code=404, detail="No genomes available")
    
    # Convert genome data from JSON string to Python dict for response
    genome_dict = {
        "id": genome.id,
        "generation": genome.generation,
        "data": json.loads(genome.data),
        "score": genome.score
    }
    
    return genome_dict

# Modify the existing mutate_genome endpoint

# Store the next scheduled update time
next_scheduled_update = datetime.now(pytz.utc) + timedelta(minutes=1)

@app.post("/api/genome/{genome_id}/mutate")
def mutate_genome(
    genome_id: int,
    mutation: schemas.MutationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Submit a mutation for a genome"""
    # Verify genome exists
    genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
    if not genome:
        raise HTTPException(status_code=404, detail="Genome not found")
    
    # Find which experiment and generation this genome belongs to
    genome_exp = db.query(models.GenomeExperiment).filter(
        models.GenomeExperiment.genome_id == genome_id
    ).first()
    
    if not genome_exp:
        raise HTTPException(status_code=404, detail="Genome not associated with any experiment")
        
    # Check if user has already contributed to this experiment's generation
    existing_contribution = db.query(models.Mutation).join(
        models.GenomeExperiment, 
        models.Mutation.genome_id == models.GenomeExperiment.genome_id
    ).filter(
        models.Mutation.user_id == current_user.id,
        models.GenomeExperiment.experiment_id == genome_exp.experiment_id,
        models.GenomeExperiment.generation == genome_exp.generation
    ).first()
    
    if existing_contribution:
        # Return a specific error code and response for already contributed
        raise HTTPException(
            status_code=409, 
            detail={
                "message": "You have already contributed to this experiment's generation",
                "next_update": next_scheduled_update.isoformat(),
                "experiment_id": genome_exp.experiment_id,
                "generation": genome_exp.generation
            }
        )
    
    # Create the mutation record
    db_mutation = models.Mutation(
        user_id=current_user.id,
        genome_id=genome_id,
        mutation_data=mutation.mutation_data,
        score=mutation.score
    )
    db.add(db_mutation)
    
    # Update the genome with the new mutation
    genome.data = mutation.mutation_data
    genome.score = mutation.score
    
    # Update the user's contribution count
    current_user.contribution_count += 1
    
    # Find which experiment this genome belongs to and check if we need to advance the generation
    genome_exp = db.query(models.GenomeExperiment).filter(
        models.GenomeExperiment.genome_id == genome_id
    ).first()
    
    if genome_exp:
        experiment = db.query(models.Experiment).filter(
            models.Experiment.id == genome_exp.experiment_id
        ).first()
        
        if experiment:
            # Update best score if applicable
            if mutation.score > experiment.best_score:
                experiment.best_score = mutation.score
            
            # Check if all genomes in current generation have been scored
            all_scored = db.query(
                ~db.query(models.GenomeExperiment)
                .join(models.Genome)
                .filter(
                    models.GenomeExperiment.experiment_id == experiment.id,
                    models.GenomeExperiment.generation == experiment.current_generation,
                    models.Genome.score == 0
                ).exists()
            ).scalar()

            
            # If all genomes are scored, automatically advance to next generation
            if all_scored:
                experiments.advance_experiment_generation(db, experiment.id)
    
    db.commit()
    db.refresh(db_mutation)
    
    # Return the next scheduled update time along with the success message
    return {
        "message": "Mutation submitted successfully", 
        "mutation_id": db_mutation.id,
        "next_update": next_scheduled_update.isoformat()
    }

@app.post("/api/melody/save")
def save_melody(
    melody: schemas.SavedMelodyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Save a melody (genome) to user's collection"""
    # Verify genome exists
    genome = db.query(models.Genome).filter(models.Genome.id == melody.genome_id).first()
    if not genome:
        raise HTTPException(status_code=404, detail="Genome not found")
    
    # Create saved melody record
    saved_melody = models.SavedMelody(
        user_id=current_user.id,
        genome_id=melody.genome_id,
        name=melody.name,
        description=melody.description
    )
    db.add(saved_melody)
    db.commit()
    db.refresh(saved_melody)
    
    return {"message": "Melody saved successfully", "melody_id": saved_melody.id}

@app.get("/api/melody/saved")
def get_saved_melodies(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get all melodies saved by the current user"""
    saved_melodies = db.query(models.SavedMelody).\
        filter(models.SavedMelody.user_id == current_user.id).\
        all()
    
    result = []
    for melody in saved_melodies:
        genome = db.query(models.Genome).filter(models.Genome.id == melody.genome_id).first()
        if genome:
            result.append({
                "id": melody.id,
                "name": melody.name,
                "description": melody.description,
                "created_at": melody.created_at,
                "genome": {
                    "id": genome.id,
                    "generation": genome.generation,
                    "data": json.loads(genome.data),
                    "score": genome.score
                }
            })
    
    return result

# Admin endpoints (could be protected by role-based authentication in a real app)
@app.post("/api/admin/generation/next")
def create_next_generation(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Create the next generation of genomes"""
    # Find current generation
    latest_gen = db.query(models.Genome.generation).order_by(models.Genome.generation.desc()).first()
    current_gen = latest_gen[0] if latest_gen else -1
    
    # Generate new genomes
    new_gen = genomes.create_next_generation(db, current_gen)
    
    return {
        "message": f"Created generation {current_gen + 1} with {len(new_gen)} genomes",
        "generation": current_gen + 1
    }

@app.get("/api/admin/generations")
def get_generations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get statistics about all generations"""
    generations = db.query(models.Genome.generation).\
        distinct().\
        order_by(models.Genome.generation).\
        all()
    
    results = []
    for gen in generations:
        gen_num = gen[0]
        genomes_count = db.query(models.Genome).\
            filter(models.Genome.generation == gen_num).\
            count()
        
        avg_score = db.query(models.Genome).\
            filter(models.Genome.generation == gen_num).\
            count()
        
        results.append({
            "generation": gen_num,
            "genome_count": genomes_count,
            "avg_score": avg_score
        })
    
    return results

# Add these new endpoints

@app.get("/api/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
    limit: int = 20
):
    """Get top users ranked by their contribution count (number of mutations)"""
    # Get users with their mutation counts
    user_contributions = db.query(
        models.User.id, 
        models.User.username,
        func.count(models.Mutation.id).label('contribution_count')
    ).outerjoin(
        models.Mutation, 
        models.User.id == models.Mutation.user_id
    ).group_by(
        models.User.id
    ).order_by(
        desc('contribution_count')
    ).limit(limit).all()
    
    # Format the result
    result = []
    for user_id, username, contribution_count in user_contributions:
        result.append({
            "id": user_id,
            "username": username,
            "contribution_count": contribution_count
        })
    
    return result

@app.get("/api/melody/latest")
def get_latest_playlist(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
    limit: int = 20
):
    """Get the latest saved melodies from all users"""
    latest_melodies = db.query(
        models.SavedMelody,
        models.User.username
    ).join(
        models.User,
        models.SavedMelody.user_id == models.User.id
    ).order_by(
        models.SavedMelody.created_at.desc()
    ).limit(limit).all()
    
    result = []
    for melody, username in latest_melodies:
        # Get the associated genome
        genome = db.query(models.Genome).filter(models.Genome.id == melody.genome_id).first()
        if genome:
            result.append({
                "id": melody.id,
                "name": melody.name,
                "description": melody.description,
                "created_at": melody.created_at,
                "username": username,
                "genome": {
                    "id": genome.id,
                    "generation": genome.generation,
                    "data": json.loads(genome.data),
                    "score": genome.score
                }
            })
    
    return result

# Add these new endpoints

@app.get("/api/experiments")
def get_experiments(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user),
    skip: int = 0, 
    limit: int = 100
):
    """Get all experiments"""
    return experiments.get_all_experiments(db, skip, limit)

@app.get("/api/experiments/{experiment_id}")
def get_experiment(
    experiment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a specific experiment by ID"""
    experiment = experiments.get_experiment(db, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return experiment

@app.get("/api/experiments/{experiment_id}/generation/{generation}")
def get_genome_from_experiment(
    experiment_id: int,
    generation: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a random genome from specified experiment and generation"""
    # First check if the experiment exists
    experiment = db.query(models.Experiment).filter(models.Experiment.id == experiment_id).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Check if generation is valid
    if generation < 0 or generation > experiment.current_generation:
        raise HTTPException(status_code=400, detail=f"Invalid generation. Current generation is {experiment.current_generation}")
    
    # Get a random genome
    genome = experiments.get_random_genome_from_experiment(db, experiment_id, generation)
    if not genome:
        raise HTTPException(status_code=404, detail="No genomes available for this experiment and generation")
    
    # Convert genome data from JSON string to Python dict for response
    genome_dict = {
        "id": genome.id,
        "generation": genome.generation,
        "data": json.loads(genome.data),
        "score": genome.score,
        "experiment_id": experiment_id,
        "experiment_name": experiment.name
    }
    
    return genome_dict

@app.get("/api/genome/random")
def get_random_genome(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a random genome from any active experiment"""
    print(f"User {current_user.id} ({current_user.username}) requesting random genome")
    
    genome = experiments.get_random_genome_from_any_experiment(db)
    if not genome:
        print("No genomes available from any experiment")
        raise HTTPException(status_code=404, detail="No genomes available")
    
    # Get experiment info
    genome_exp = db.query(models.GenomeExperiment).filter(
        models.GenomeExperiment.genome_id == genome.id
    ).first()
    
    if not genome_exp:
        print(f"Genome {genome.id} not associated with any experiment")
        raise HTTPException(status_code=404, detail="Genome not associated with an experiment")
    
    experiment = db.query(models.Experiment).filter(
        models.Experiment.id == genome_exp.experiment_id
    ).first()
    
    # Convert genome data from JSON string to Python dict for response
    try:
        genome_data = json.loads(genome.data)
        
        genome_dict = {
            "id": genome.id,
            "generation": genome.generation,
            "data": genome_data,
            "score": genome.score,
            "experiment_id": experiment.id,
            "experiment_name": experiment.name
        }
        
        print(f"Successfully returning genome {genome.id} from experiment {experiment.name}")
        return genome_dict
    except json.JSONDecodeError as e:
        print(f"Error decoding genome data: {e}")
        raise HTTPException(status_code=500, detail=f"Invalid genome data format: {str(e)}")



@app.get("/api/genome/{genome_id}/ancestry")
def get_genome_ancestry(
    genome_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a focused ancestry tree for a genome (highest scoring branch only)"""
    # First check if the genome exists
    genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
    if not genome:
        raise HTTPException(status_code=404, detail="Genome not found")
    
    # Initialize the response structure
    ancestry = {
        "nodes": [],
        "edges": []
    }
    
    # Add the requested genome to nodes
    try:
        ancestry["nodes"].append({
            "id": genome.id,
            "generation": genome.generation,
            "score": genome.score,
            "data": json.loads(genome.data)
        })
    except json.JSONDecodeError:
        print(f"Error decoding genome data for genome {genome.id}")
        raise HTTPException(status_code=500, detail="Error decoding genome data")
    
    # Track processed genomes to avoid duplicates
    processed_genomes = set([genome.id])
    
    # Function to recursively add ancestors of the highest scoring parent
    def add_highest_scoring_ancestor(current_genome, max_depth=3, current_depth=0):
        if current_depth >= max_depth:
            return
        
        # Check if this genome has parents
        if not current_genome.parent1_id and not current_genome.parent2_id:
            return
        
        # Get both parents if they exist
        parent1 = None
        parent2 = None
        
        if current_genome.parent1_id:
            parent1 = db.query(models.Genome).filter(models.Genome.id == current_genome.parent1_id).first()
        
        if current_genome.parent2_id:
            parent2 = db.query(models.Genome).filter(models.Genome.id == current_genome.parent2_id).first()
        
        # Determine which parent has higher score
        higher_parent = None
        other_parent = None
        
        if parent1 and parent2:
            if parent1.score >= parent2.score:  # Parent1 is higher or equal
                higher_parent = parent1
                other_parent = parent2
            else:  # Parent2 is higher
                higher_parent = parent2
                other_parent = parent1
        elif parent1:
            higher_parent = parent1
        elif parent2:
            higher_parent = parent2
        
        # Add both parents to the tree
        for parent in [higher_parent, other_parent]:
            if not parent:
                continue
                
            if parent.id not in processed_genomes:
                processed_genomes.add(parent.id)
                try:
                    ancestry["nodes"].append({
                        "id": parent.id,
                        "generation": parent.generation,
                        "score": parent.score,
                        "data": json.loads(parent.data),
                        "is_main_branch": parent == higher_parent  # Flag the main branch
                    })
                    ancestry["edges"].append({
                        "from_id": parent.id,
                        "to_id": current_genome.id,
                        "from_generation": parent.generation,
                        "to_generation": current_genome.generation,
                        "score": parent.score,
                        "is_main_branch": parent == higher_parent
                    })
                except json.JSONDecodeError:
                    print(f"Error decoding data for parent genome {parent.id}")
        
        # Only continue recursion with the higher scoring parent
        if higher_parent:
            add_highest_scoring_ancestor(higher_parent, max_depth, current_depth + 1)
    
    # Start adding ancestors from the requested genome
    add_highest_scoring_ancestor(genome)
    
    return ancestry

# Initialize database with genomes if empty
@app.on_event("startup")
def startup_event():
    db = database.SessionLocal()
    try:
        # Initialize experiments if none exist
        experiments.initialize_default_experiments(db)
        
        # Diagnose and repair existing experiments
        experiments.diagnose_and_repair_experiments(db)
        
        # Check if we have any genomes (keep existing code)
        if db.query(models.Genome).count() == 0:
            genomes.initialize_genomes(db)
    finally:
        db.close()


# Add this new endpoint after the existing genome endpoints

@app.get("/api/genome/{genome_id}")
def get_genome_by_id(
    genome_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a specific genome by ID"""
    # First check if the genome exists
    genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
    if not genome:
        raise HTTPException(status_code=404, detail=f"Genome with ID {genome_id} not found")
    
    # Convert genome data from JSON string to Python dict for response
    try:
        genome_data = json.loads(genome.data)
        
        genome_dict = {
            "id": genome.id,
            "generation": genome.generation,
            "data": genome_data,
            "score": genome.score,
            "parent1_id": genome.parent1_id,
            "parent2_id": genome.parent2_id,
        }
        
        # Get experiment info if available
        genome_exp = db.query(models.GenomeExperiment).filter(
            models.GenomeExperiment.genome_id == genome.id
        ).first()
        
        if genome_exp:
            experiment = db.query(models.Experiment).filter(
                models.Experiment.id == genome_exp.experiment_id
            ).first()
            if experiment:
                genome_dict["experiment_id"] = experiment.id
                genome_dict["experiment_name"] = experiment.name
        
        return genome_dict
    except json.JSONDecodeError as e:
        print(f"Error decoding genome data for genome {genome_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Invalid genome data format for genome {genome_id}: {str(e)}")




from apscheduler.schedulers.background import BackgroundScheduler
import traceback
# Add these imports at the top
from datetime import datetime, timedelta
import pytz

def periodic_generation_update():
    global next_scheduled_update
    
    print(f"Running periodic generation update at {datetime.now(pytz.utc)}")

    # Obtain a session from the dependency generator
    db = next(get_db())
    try:
        experiments_list = db.query(models.Experiment).filter(models.Experiment.completed == False).all()
        print(f"Found {len(experiments_list)} active experiments")
        
        for exp in experiments_list:
            print(f"Processing experiment {exp.id} (generation {exp.current_generation})")
            
            # IMPORTANT: Use the experiment-specific function to advance the generation
            # This ensures proper isolation between experiments
            result = experiments.advance_experiment_generation(db, exp.id)
            print(f"Result for experiment {exp.id}: {result}")
            
    except Exception as e:
        print("Error in periodic_generation_update:", e)
        traceback.print_exc()
    finally:
        db.close()

# Set up the scheduler to run every 2 minutes
scheduler = BackgroundScheduler()
scheduler.add_job(periodic_generation_update, 'interval', minutes=1)
scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.shutdown()

@app.get("/api/experiments/{experiment_id}/generation/{generation}/contribution")
def check_user_contribution(
    experiment_id: int,
    generation: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Check if the current user has already contributed to this experiment's generation"""
    # Check for existing contribution
    existing_contribution = db.query(models.Mutation).join(
        models.GenomeExperiment, 
        models.Mutation.genome_id == models.GenomeExperiment.genome_id
    ).filter(
        models.Mutation.user_id == current_user.id,
        models.GenomeExperiment.experiment_id == experiment_id,
        models.GenomeExperiment.generation == generation
    ).first()
    
    if existing_contribution:
        return {
            "has_contributed": True,
            "next_update": next_scheduled_update.isoformat()
        }
    
    return {"has_contributed": False}
