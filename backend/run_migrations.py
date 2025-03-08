# This is a one-time script to update your database

import sqlalchemy as sa
import alembic.op as op
import sys
import os

# Add the parent directory to sys.path to allow importing from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base, SessionLocal
from app import models

def run_migrations():
    """Add contribution_count to users table if it doesn't exist"""
    # Create a session
    db = SessionLocal()
    try:
        # Check if contribution_count column exists
        inspector = sa.inspect(engine)
        columns = [col['name'] for col in inspector.get_columns('users')]
        
        if 'contribution_count' not in columns:
            # For SQLite, we need to use a different approach than alembic operations
            # since SQLite doesn't support ALTER TABLE ADD COLUMN with non-NULL constraint
            print("Adding contribution_count column to users table")
            
            # Use raw SQL to add the column
            db.execute(sa.text("ALTER TABLE users ADD COLUMN contribution_count INTEGER DEFAULT 0"))
            db.commit()
            
            print("Added contribution_count column to users table")
            
            # Update existing users' contribution counts
            for user in db.query(models.User).all():
                mutation_count = db.query(models.Mutation).filter_by(user_id=user.id).count()
                user.contribution_count = mutation_count
                
            db.commit()
            print("Updated contribution counts for existing users")
        else:
            print("contribution_count column already exists")
            
    except Exception as e:
        db.rollback()
        print(f"Error updating database: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    run_migrations()