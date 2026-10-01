ALTER TABLE "program" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'python';
ALTER TABLE "exercise_submission" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'python';
