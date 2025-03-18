from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Dict, Any, Union
from datetime import datetime

# User schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    contribution_count: int = 0

    class Config:
        orm_mode = True

# Token schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

# Genome schemas
class GenomeBase(BaseModel):
    data: str  # JSON string

class GenomeCreate(GenomeBase):
    generation: int = 0
    parent1_id: Optional[int] = None
    parent2_id: Optional[int] = None

class Genome(GenomeBase):
    id: int
    generation: int
    score: float
    created_at: datetime
    
    class Config:
        orm_mode = True

# Mutation schemas
class MutationBase(BaseModel):
    genome_id: int
    mutation_data: str  # JSON string with changes
    score: float = Field(..., ge=0, le=100)

class MutationCreate(MutationBase):
    pass

class Mutation(MutationBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Saved melody schemas
class SavedMelodyBase(BaseModel):
    genome_id: int
    name: str
    description: Optional[str] = None

class SavedMelodyCreate(SavedMelodyBase):
    pass

class SavedMelody(SavedMelodyBase):
    id: int
    user_id: int
    created_at: datetime
    
    class Config:
        orm_mode = True

# Add these new schemas

class ExperimentBase(BaseModel):
    name: str
    description: Optional[str] = None
    max_generations: int = 1000

class ExperimentCreate(ExperimentBase):
    pass

class ExperimentUpdate(BaseModel):
    current_generation: Optional[int] = None
    best_score: Optional[float] = None
    completed: Optional[bool] = None
    final_piece_name: Optional[str] = None
    final_genome_id: Optional[int] = None

class ExperimentInDB(ExperimentBase):
    id: int
    current_generation: int
    best_score: float
    completed: bool
    final_piece_name: Optional[str] = None
    final_genome_id: Optional[int] = None
    created_at: datetime

    class Config:
        orm_mode = True

class Experiment(ExperimentInDB):
    total_contributions: int = 0


class PasswordResetRequest(BaseModel):
    email: EmailStr
    
class PasswordReset(BaseModel):
    token: str
    new_password: str