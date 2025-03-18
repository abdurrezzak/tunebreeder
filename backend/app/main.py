from fastapi import FastAPI, Depends, HTTPException, status, Request
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
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from starlette.responses import RedirectResponse
# Add this import for SessionMiddleware
from starlette.middleware.sessions import SessionMiddleware

from . import models, schemas, auth, database, genomes
from .database import engine
from . import experiments
# Import the cleanup function at the top of the file
from .database_cleanup import cleanup_orphaned_genomes

# Add these imports at the top
from fastapi import BackgroundTasks
import secrets
from datetime import datetime, timedelta
from email.message import EmailMessage
import smtplib
from pydantic import EmailStr

# Load environment variables
load_dotenv()

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="TuneBreeder API")

# Add SessionMiddleware (must be before other middleware)
app.add_middleware(
    SessionMiddleware, 
    secret_key=os.getenv("SECRET_KEY", "your_super_secret_key_here_change_this_in_production")
)

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

schedule_time = 3 # minutes


# Configure OAuth for Google
config = Config('.env')  # Load from .env file or environment variables
oauth = OAuth(config)

# Register Google OAuth
oauth.register(
    name='google',
    client_id=os.getenv('GOOGLE_CLIENT_ID'),
    client_secret=os.getenv('GOOGLE_CLIENT_SECRET'),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
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
next_scheduled_update = datetime.now(pytz.utc) + timedelta(minutes=schedule_time)

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
    genome.user_scored = 1  # Add this line to mark the genome as scored by a user
    
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
                    models.Genome.user_scored == 0  # Changed from score == 0
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
            "score": contribution_count
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

import random
@app.get("/api/genome/random")
def get_random_genome(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Get a random genome from any active experiment"""
    print(f"User {current_user.id} ({current_user.username}) requesting random genome")
    
    # Get all active experiments
    active_experiments = db.query(models.Experiment).filter(models.Experiment.completed == False).all()
    
    if not active_experiments:
        raise HTTPException(status_code=404, detail="No active experiments found")
    
    # Filter to experiments where the user hasn't contributed to current generation
    available_experiments = []
    for experiment in active_experiments:
        # Check if user has already contributed to this experiment's generation
        existing_contribution = db.query(models.Mutation).join(
            models.GenomeExperiment, 
            models.Mutation.genome_id == models.GenomeExperiment.genome_id
        ).filter(
            models.GenomeExperiment.experiment_id == experiment.id,
            models.GenomeExperiment.generation == experiment.current_generation,
            models.Mutation.user_id == current_user.id
        ).first()
        
        if not existing_contribution:
            available_experiments.append(experiment)
    
    if not available_experiments:
        raise HTTPException(
            status_code=404, 
            detail="You've already contributed to all available experiments in their current generation"
        )
    
    # Select random experiment from available ones
    selected_experiment = random.choice(available_experiments)
    
    # Get genome from selected experiment
    genome = experiments.get_random_genome_from_experiment(
        db, 
        selected_experiment.id, 
        selected_experiment.current_generation
    )
    
    if not genome:
        raise HTTPException(status_code=404, detail="No genomes available from selected experiment")
    
    # Convert genome data from JSON string to Python dict for response
    try:
        genome_data = json.loads(genome.data)
        
        genome_dict = {
            "id": genome.id,
            "generation": genome.generation,
            "data": genome_data,
            "score": genome.score,
            "experiment_id": selected_experiment.id,
            "experiment_name": selected_experiment.name
        }
        
        print(f"Successfully returning genome {genome.id} from experiment {selected_experiment.name}")
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


# Add more detailed logging to the get_common_ancestry function

# Update the get_common_ancestry function to include ancestry paths

@app.get("/api/genomes/common-ancestry")
def get_common_ancestry(
    id1: int,
    id2: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_active_user)
):
    """Find the lowest common ancestor between two genomes if it exists"""
    print(f"\n----- Looking for common ancestor between genomes {id1} and {id2} -----")
    
    try:
        # Get both genomes first
        genome1 = db.query(models.Genome).filter(models.Genome.id == id1).first()
        genome2 = db.query(models.Genome).filter(models.Genome.id == id2).first()
        
        print(f"Genome1 found: {genome1 is not None}, Genome2 found: {genome2 is not None}")
        
        if not genome1 or not genome2:
            missing_id = id1 if not genome1 else id2
            print(f"Genome with ID {missing_id} not found")
            raise HTTPException(status_code=404, detail=f"Genome with ID {missing_id} not found")
        
        # Check if they're from the same experiment
        genome1_experiment = db.query(models.GenomeExperiment).filter(
            models.GenomeExperiment.genome_id == genome1.id
        ).first()
        
        genome2_experiment = db.query(models.GenomeExperiment).filter(
            models.GenomeExperiment.genome_id == genome2.id
        ).first()
        
        print(f"Genome1 experiment: {genome1_experiment is not None}, Genome2 experiment: {genome2_experiment is not None}")
        
        # If either doesn't belong to an experiment or they're from different experiments
        if (not genome1_experiment or not genome2_experiment):
            print("One or both genomes don't belong to any experiment")
            return {
                "hasCommonAncestor": False,
                "message": "These melodies are from different experiments or populations."
            }
            
        if (genome1_experiment.experiment_id != genome2_experiment.experiment_id):
            print(f"Genomes are from different experiments: {genome1_experiment.experiment_id} vs {genome2_experiment.experiment_id}")
            return {
                "hasCommonAncestor": False,
                "message": "These melodies are from different experiments or populations."
            }
        
        # For first genome, track both ancestors and path to each ancestor
        ancestors_set1 = set()
        paths_to_ancestors = {}  # Dict mapping ancestor_id -> path from genome1
        
        def collect_ancestors_with_paths(genome_id, ancestors_set, current_path=None):
            """Recursively collect ancestors with paths"""
            if current_path is None:
                current_path = []
                
            genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
            if not genome:
                return
            
            # For each parent, record path and continue recursion
            for parent_attr, parent_id in [('parent1_id', genome.parent1_id), ('parent2_id', genome.parent2_id)]:
                if parent_id:
                    parent = db.query(models.Genome).filter(models.Genome.id == parent_id).first()
                    if parent:
                        ancestors_set.add(parent_id)
                        
                        # Store path to this ancestor (copy to avoid shared references)
                        parent_path = current_path.copy()
                        parent_path.append({
                            "id": parent.id,
                            "generation": parent.generation,
                            "score": parent.score
                        })
                        paths_to_ancestors[parent_id] = parent_path
                        
                        # Continue recursion
                        collect_ancestors_with_paths(parent_id, ancestors_set, parent_path)
        
        # Collect ancestors for first genome with paths
        collect_ancestors_with_paths(genome1.id, ancestors_set1)
        print(f"Collected {len(ancestors_set1)} ancestors for genome {id1}")
        
        # Find common ancestor by traversing genome2's ancestry
        common_ancestors = []
        
        # For the second genome, also track paths
        paths_from_genome2 = {}  # Dict mapping ancestor_id -> path from genome2
        
        def find_common_ancestors_with_paths(genome_id, common_ancestors_list, current_path=None):
            """Find common ancestors with paths"""
            if current_path is None:
                current_path = []
                
            if genome_id in ancestors_set1:
                # This is a common ancestor
                genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
                if genome:
                    ancestor_info = {
                        "id": genome.id,
                        "generation": genome.generation,
                        "score": genome.score
                    }
                    common_ancestors_list.append(ancestor_info)
                    
                    # Store path to this common ancestor
                    path_from_genome2 = current_path.copy()
                    path_from_genome2.append(ancestor_info)
                    paths_from_genome2[genome_id] = path_from_genome2
            
            # Continue traversing up
            genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
            if not genome:
                return
            
            # For each parent, record path and continue recursion
            for parent_attr, parent_id in [('parent1_id', genome.parent1_id), ('parent2_id', genome.parent2_id)]:
                if parent_id:
                    parent = db.query(models.Genome).filter(models.Genome.id == parent_id).first()
                    if parent:
                        # Create path entry for this parent
                        parent_path = current_path.copy()
                        parent_path.append({
                            "id": parent.id,
                            "generation": parent.generation,
                            "score": parent.score
                        })
                        
                        # Continue recursion with updated path
                        find_common_ancestors_with_paths(parent_id, common_ancestors_list, parent_path)
        
        # Start with genome2 itself (in case one is ancestor of another)
        genome2_path_entry = {
            "id": genome2.id,
            "generation": genome2.generation,
            "score": genome2.score
        }
        
        if genome2.id in ancestors_set1:
            common_ancestors.append(genome2_path_entry)
            # Special case: genome2 is already in ancestry of genome1
            paths_from_genome2[genome2.id] = [genome2_path_entry]
            print(f"Genome {id2} is directly in the ancestry of genome {id1}")
        else:
            find_common_ancestors_with_paths(genome2.id, common_ancestors, [genome2_path_entry])
        
        # If we found any common ancestors
        if common_ancestors:
            # Sort by generation, highest first (most recent common ancestor)
            common_ancestors.sort(key=lambda x: x["generation"], reverse=True)
            
            # Get the most recent common ancestor
            lca = common_ancestors[0]
            lca_id = lca["id"]
            
            # Construct paths from both genomes to the LCA
            # For genome1, we need to reverse the path since we stored ancestor->genome1 paths
            path1_to_lca = paths_to_ancestors.get(lca_id, [])[::-1]  # Reverse to get genome1->ancestor path
            path2_to_lca = paths_from_genome2.get(lca_id, [])[:-1]  # Exclude LCA as it's returned separately
            
            print(f"Found common ancestor for genomes {id1} and {id2}: {lca_id}")
            print(f"Path length from genome1 to LCA: {len(path1_to_lca)}")
            print(f"Path length from genome2 to LCA: {len(path2_to_lca)}")
            
            return {
                "hasCommonAncestor": True,
                "commonAncestor": lca,
                "allCommonAncestors": common_ancestors,
                "firstGeneration": genome1.generation,
                "secondGeneration": genome2.generation,
                "firstScore": genome1.score,
                "secondScore": genome2.score,
                "firstPath": path1_to_lca,  # Path from genome1 to LCA (excluding endpoints)
                "secondPath": path2_to_lca  # Path from genome2 to LCA (excluding endpoints)
            }
        else:
            return {
                "hasCommonAncestor": False,
                "message": "These melodies share the same experiment but have no common ancestor."
            }
    except Exception as e:
        print(f"Exception in common ancestry endpoint: {str(e)}")
        import traceback
        traceback.print_exc()
        raise



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
            
            result = experiments.advance_experiment_generation(db, exp.id)
            
            cleanup_result = cleanup_orphaned_genomes(db, exp.id)
            if cleanup_result and "deleted_count" in cleanup_result:
                print(f"Cleaned up {cleanup_result['deleted_count']} orphaned genomes from previous generations")

            print(f"Result for experiment {exp.id}: {result}")
            
    except Exception as e:
        print("Error in periodic_generation_update:", e)
        traceback.print_exc()
    finally:
        db.close()

# Set up the scheduler to run every n minutes
scheduler = BackgroundScheduler()
scheduler.add_job(periodic_generation_update, 'interval', minutes=schedule_time)
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

# Google OAuth login route
@app.get('/auth/google/login')
async def google_login(request: Request):
    redirect_uri = request.url_for('google_callback')
    return await oauth.google.authorize_redirect(request, redirect_uri)

# Google OAuth callback route
@app.get('/auth/google/callback')
async def google_callback(request: Request, db: Session = Depends(get_db)):
    token = await oauth.google.authorize_access_token(request)
    user_info = token.get('userinfo')
    if user_info:
        # Check if the user exists
        db_user = auth.get_user(db, email=user_info['email'])
        if not db_user:
            # Create a new user
            db_user = models.User(
                email=user_info['email'],
                username=user_info.get('name', user_info['email'].split('@')[0]),
                hashed_password=auth.get_password_hash(os.urandom(24).hex())  # Random secure password
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        
        # Create access token
        access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": db_user.email}, expires_delta=access_token_expires
        )
        
        # Redirect to frontend with token
        frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:3000')
        return RedirectResponse(
            url=f"{frontend_url}/auth-callback?token={access_token}"
        )
    
    # If we get here, something went wrong
    return RedirectResponse(url="/login?error=Could not authenticate with Google")

@app.post("/auth/forgot-password")
async def forgot_password(
    email_data: schemas.PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Generate a password reset token and send a reset email"""
    user = db.query(models.User).filter(models.User.email == email_data.email).first()
    
    # Always return success regardless of whether the email exists
    # This prevents user enumeration attacks
    if not user:
        return {"message": "If your email is registered, you will receive a password reset link"}
    
    # Generate a secure token
    reset_token = secrets.token_urlsafe(32)
    
    # Set expiration time (e.g., 1 hour from now)
    expires = datetime.utcnow() + timedelta(hours=1)
    
    # Store the reset token in the database
    user.reset_token = reset_token
    user.reset_token_expires = expires
    db.commit()
    
    # Send the reset email as a background task
    background_tasks.add_task(
        send_password_reset_email, 
        email_data.email, 
        reset_token
    )
    
    return {"message": "If your email is registered, you will receive a password reset link"}

def send_password_reset_email(email: str, token: str):
    """Send password reset email with token using MailerSend API directly"""
    reset_url = f"http://localhost:3000/reset-password?token={token}"
    
    try:
        import requests
        import json
        
        # MailerSend credentials - store these in environment variables
        mailersend_api_key = os.getenv("MAILERSEND_API_KEY", "mlsn.73508ecd9eaf7f1a64c59cb054cdada396fd733e836342748c73064db8da2bbe")
        mailersend_from_email = os.getenv("MAILERSEND_FROM_EMAIL", "info@tunebreeder.com")
        
        # MailerSend API endpoint
        url = "https://api.mailersend.com/v1/email"
        
        # Email content
        payload = {
            "from": {
                "email": mailersend_from_email,
                "name": "TuneBreeder Support"
            },
            "to": [
                {
                    "email": email
                }
            ],
            "subject": "TuneBreeder Password Reset",
            "text": f"""
Hello,

You requested a password reset for your TuneBreeder account.

Go to this URL to reset your password: {reset_url}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email.

Regards,
TuneBreeder Team
            """,
            "html": f"""
<html>
    <body>
        <h2>TuneBreeder Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset for your TuneBreeder account.</p>
        <p><a href="{reset_url}" style="display: inline-block; background-color: #4285f4; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">Reset Your Password</a></p>
        <p>Or copy and paste this URL into your browser: {reset_url}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you did not request a password reset, please ignore this email.</p>
        <p>Regards,<br>TuneBreeder Team</p>
    </body>
</html>
            """
        }
        
        # Headers
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {mailersend_api_key}",
            "X-Requested-With": "XMLHttpRequest"
        }
        
        # Send the request
        response = requests.post(url, headers=headers, json=payload)
        
        # Check response
        if response.status_code == 202:
            print(f"Password reset email sent to {email}, status code: {response.status_code}")
        else:
            print(f"Failed to send email. Status code: {response.status_code}, Response: {response.text}")
            
    except Exception as e:
        print(f"Failed to send email: {str(e)}")
        
        # For development purposes, print the reset token to console
        print("\n====== PASSWORD RESET ======")
        print(f"Email: {email}")
        print(f"Reset URL: {reset_url}")
        print(f"Token: {token}")
        print("============================\n")

@app.post("/auth/reset-password")
async def reset_password(
    reset_data: schemas.PasswordReset,
    db: Session = Depends(get_db)
):
    """Reset user password using token"""
    # Find user with this token
    user = db.query(models.User).filter(
        models.User.reset_token == reset_data.token
    ).first()
    
    # Check if token exists and is valid
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    
    # Update the password
    user.hashed_password = auth.get_password_hash(reset_data.new_password)
    
    # Clear the reset token
    user.reset_token = None
    user.reset_token_expires = None
    
    db.commit()
    
    return {"message": "Password updated successfully"}