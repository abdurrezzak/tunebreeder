from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Add this to track user statistics
    contribution_count = Column(Integer, default=0)
    
    # Relationships
    mutations = relationship("Mutation", back_populates="user")
    saved_melodies = relationship("SavedMelody", back_populates="user")

class Genome(Base):
    __tablename__ = "genomes"

    id = Column(Integer, primary_key=True, index=True)
    generation = Column(Integer)
    data = Column(Text)  # JSON string representation of the genome
    score = Column(Float, default=0.0)
    parent1_id = Column(Integer, ForeignKey("genomes.id"), nullable=True)
    parent2_id = Column(Integer, ForeignKey("genomes.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    mutations = relationship("Mutation", back_populates="genome")
    saved_by = relationship("SavedMelody", back_populates="genome")

class Mutation(Base):
    __tablename__ = "mutations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    genome_id = Column(Integer, ForeignKey("genomes.id"))
    mutation_data = Column(Text)  # JSON string with mutation details
    score = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="mutations")
    genome = relationship("Genome", back_populates="mutations")

class SavedMelody(Base):
    __tablename__ = "saved_melodies"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    genome_id = Column(Integer, ForeignKey("genomes.id"))
    name = Column(String)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="saved_melodies")
    genome = relationship("Genome", back_populates="saved_by")