ALTER TABLE "program" ADD COLUMN "exerciseId" TEXT;
CREATE UNIQUE INDEX "program_userId_exerciseId_key" ON "program"("userId", "exerciseId");

CREATE TABLE "exercise_progress" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "exerciseId" TEXT NOT NULL,
  "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
  "attempts" INTEGER NOT NULL DEFAULT 0, "lastFeedback" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "exercise_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "exercise_progress_userId_exerciseId_key" ON "exercise_progress"("userId", "exerciseId");
CREATE INDEX "exercise_progress_userId_completedAt_idx" ON "exercise_progress"("userId", "completedAt");

CREATE TABLE "lesson_progress" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "lessonId" TEXT NOT NULL,
  "currentExerciseId" TEXT, "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastOpenedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "lesson_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "lesson_progress_userId_lessonId_key" ON "lesson_progress"("userId", "lessonId");
CREATE INDEX "lesson_progress_userId_lastOpenedAt_idx" ON "lesson_progress"("userId", "lastOpenedAt");

CREATE TABLE "exercise_submission" (
  "id" TEXT NOT NULL PRIMARY KEY, "userId" TEXT NOT NULL, "programId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "code" TEXT NOT NULL,
  "filesJson" TEXT NOT NULL DEFAULT '[]', "status" TEXT NOT NULL DEFAULT 'PENDING',
  "feedback" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "gradedAt" DATETIME,
  CONSTRAINT "exercise_submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "exercise_submission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "program" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "exercise_submission_userId_idempotencyKey_key" ON "exercise_submission"("userId", "idempotencyKey");
CREATE INDEX "exercise_submission_userId_exerciseId_createdAt_idx" ON "exercise_submission"("userId", "exerciseId", "createdAt");
