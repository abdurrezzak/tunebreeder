"""Your message

Revision ID: 929e5e919224
Revises: 
Create Date: 2025-03-11 17:15:11.029965

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '929e5e919224'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:    
    op.add_column('genomes', sa.Column('user_scored', sa.Boolean(), nullable=False, server_default=sa.text('0')))


def downgrade() -> None:
    op.drop_column('genomes', 'user_scored')
    # ### end Alembic commands ###
