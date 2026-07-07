ALTER TABLE "agency_team_members" ADD COLUMN "user_id" UUID;
ALTER TABLE "agency_team_members" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "agency_team_members" ADD COLUMN "invited_at" TIMESTAMPTZ;
ALTER TABLE "agency_team_members" ADD COLUMN "deactivated_at" TIMESTAMPTZ;

CREATE UNIQUE INDEX "agency_team_members_user_id_key" ON "agency_team_members"("user_id");

ALTER TABLE "agency_team_members" ADD CONSTRAINT "agency_team_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "agency_team_members_agency_profile_id_email_key"
  ON "agency_team_members"("agency_profile_id", "email");
