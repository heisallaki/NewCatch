"""profiles, photos, swipes and matches"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("profiles", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("interests", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "profiles",
        sa.Column("music_genres", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column(
        "profiles",
        sa.Column("looking_for", sa.JSON(), nullable=False, server_default=sa.text("'[]'::json")),
    )
    op.add_column("profiles", sa.Column("favourite_artist", sa.String(100), nullable=True))
    op.add_column(
        "profiles",
        sa.Column("visibility", sa.String(20), nullable=False, server_default="everyone"),
    )
    op.add_column(
        "profiles",
        sa.Column("discovery_scope", sa.String(20), nullable=False, server_default="all"),
    )
    op.add_column(
        "profiles",
        sa.Column("opened_name", sa.String(20), nullable=False, server_default="full_name"),
    )

    op.create_table(
        "photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("filename", sa.String(64), nullable=False, unique=True),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("width", sa.Integer(), nullable=False),
        sa.Column("height", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_photos_user_id", "photos", ["user_id"])

    op.create_table(
        "swipes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("from_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("from_user_id", "to_user_id", name="uq_swipes_pair"),
    )
    op.create_index("ix_swipes_from_user_id", "swipes", ["from_user_id"])
    op.create_index("ix_swipes_to_user_action", "swipes", ["to_user_id", "action"])

    op.create_table(
        "matches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_a_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_b_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_a_id", "user_b_id", name="uq_matches_pair"),
        sa.CheckConstraint("user_a_id < user_b_id", name="ck_matches_order"),
    )
    op.create_index("ix_matches_user_a_id", "matches", ["user_a_id"])
    op.create_index("ix_matches_user_b_id", "matches", ["user_b_id"])


def downgrade() -> None:
    op.drop_table("matches")
    op.drop_table("swipes")
    op.drop_table("photos")
    op.drop_column("profiles", "opened_name")
    op.drop_column("profiles", "discovery_scope")
    op.drop_column("profiles", "visibility")
    op.drop_column("profiles", "favourite_artist")
    op.drop_column("profiles", "looking_for")
    op.drop_column("profiles", "music_genres")
    op.drop_column("profiles", "interests")
    op.drop_column("profiles", "bio")