-- AlterTable
ALTER TABLE "system_settings" ADD COLUMN     "password_min_length" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "password_no_user_info" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_prevent_common" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_require_letter" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_require_mixed_case" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_require_number" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "password_require_symbol" BOOLEAN NOT NULL DEFAULT false;
