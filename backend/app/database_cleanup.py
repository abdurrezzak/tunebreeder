import logging
from sqlalchemy.orm import Session
from . import models

logger = logging.getLogger(__name__)

def cleanup_orphaned_genomes(db: Session, experiment_id: int):
    """
    Removes genomes from previous generations that have no descendants
    in the current generation and are not saved by any users.
    
    Args:
        db: Database session
        experiment_id: ID of the experiment that just completed a generation
    """
    try:
        # Get the experiment to find its current generation
        experiment = db.query(models.Experiment).filter(
            models.Experiment.id == experiment_id
        ).first()
        
        if not experiment:
            logger.warning(f"Cannot cleanup: Experiment {experiment_id} not found")
            return
        
        # Skip cleanup for early generations (keep first few generations intact)
        if experiment.current_generation < 4:
            logger.info(f"Skipping cleanup for experiment {experiment_id}: only at generation {experiment.current_generation}")
            return
            
        # Get all genomes in this experiment from previous generations (excluding current)
        previous_gen_genomes = db.query(models.Genome).join(
            models.GenomeExperiment,
            models.GenomeExperiment.genome_id == models.Genome.id
        ).filter(
            models.GenomeExperiment.experiment_id == experiment_id,
            models.GenomeExperiment.generation < experiment.current_generation
        ).all()
        
        if not previous_gen_genomes:
            logger.info(f"No previous generation genomes found for experiment {experiment_id}")
            return
            
        # Identify genomes that need to be preserved
        preserved_genome_ids = set()
        
        # 1. Find genomes that are ancestors of current generation genomes
        current_gen_genomes = db.query(models.Genome).join(
            models.GenomeExperiment,
            models.GenomeExperiment.genome_id == models.Genome.id
        ).filter(
            models.GenomeExperiment.experiment_id == experiment_id,
            models.GenomeExperiment.generation == experiment.current_generation
        ).all()
        
        # Recursively find all ancestors
        def collect_ancestors(genome_id, ancestors_set):
            if not genome_id or genome_id in ancestors_set:
                return
                
            ancestors_set.add(genome_id)
            
            # Get the genome to find its parents
            genome = db.query(models.Genome).filter(models.Genome.id == genome_id).first()
            if not genome:
                return
                
            # Add parents to ancestors
            if genome.parent1_id:
                collect_ancestors(genome.parent1_id, ancestors_set)
            if genome.parent2_id:
                collect_ancestors(genome.parent2_id, ancestors_set)
        
        # Find all ancestors of current generation genomes
        for genome in current_gen_genomes:
            collect_ancestors(genome.id, preserved_genome_ids)
        
        # 2. Find genomes that are saved by users
        saved_genome_ids = db.query(models.SavedMelody.genome_id).distinct().all()
        preserved_genome_ids.update([g[0] for g in saved_genome_ids])
        
        # Find genomes to delete
        orphaned_genomes = [g for g in previous_gen_genomes if g.id not in preserved_genome_ids]
        
        # Delete orphaned genomes
        deleted_count = 0
        for genome in orphaned_genomes:
            # First delete any experiment associations
            db.query(models.GenomeExperiment).filter(
                models.GenomeExperiment.genome_id == genome.id
            ).delete(synchronize_session=False)
            
            # Then delete the genome
            db.query(models.Genome).filter(models.Genome.id == genome.id).delete(synchronize_session=False)
            deleted_count += 1
        
        db.commit()
        
        logger.info(f"Cleanup completed for experiment {experiment_id}. Deleted {deleted_count} orphaned genomes.")
        return {
            "experiment_id": experiment_id,
            "deleted_count": deleted_count
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error during genome cleanup: {str(e)}")
        return {
            "error": str(e),
            "experiment_id": experiment_id
        }