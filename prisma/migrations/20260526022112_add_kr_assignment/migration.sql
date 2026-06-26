-- CreateTable
CREATE TABLE "KRAssignment" (
    "id" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assignmentId" TEXT NOT NULL,
    "keyResultId" TEXT NOT NULL,

    CONSTRAINT "KRAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KRAssignment_assignmentId_keyResultId_key" ON "KRAssignment"("assignmentId", "keyResultId");

-- AddForeignKey
ALTER TABLE "KRAssignment" ADD CONSTRAINT "KRAssignment_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ObjectiveAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KRAssignment" ADD CONSTRAINT "KRAssignment_keyResultId_fkey" FOREIGN KEY ("keyResultId") REFERENCES "KeyResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
