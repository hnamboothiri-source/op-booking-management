-- AlterTable
ALTER TABLE "doctors" ADD COLUMN     "daily_target" INTEGER;

-- AlterTable
ALTER TABLE "op_bookings" ADD COLUMN     "room_id" TEXT;

-- AddForeignKey
ALTER TABLE "op_bookings" ADD CONSTRAINT "op_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "consultation_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;
