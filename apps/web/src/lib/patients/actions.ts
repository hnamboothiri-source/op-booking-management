"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { requireCan } from "../session";
import { writeAudit } from "../audit";

export interface PatientHit {
  mrd: string;
  name: string;
  phone: string | null;
  place: string | null;
}

/** HIS-style lookup by MRD, name, or phone. */
export async function searchPatients(query: string): Promise<PatientHit[]> {
  await requireCan("patients", "view");
  const q = query.trim();
  if (!q) return [];
  const rows = await prisma.patient.findMany({
    where: {
      OR: [
        { mrd: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
      ],
    },
    take: 25,
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ mrd: r.mrd, name: r.name, phone: r.phone, place: r.place }));
}

function genMrd(): string {
  // Local stand-in for an HIS-issued MRN.
  return `MRD-${Date.now().toString().slice(-8)}`;
}

export async function createPatient(fd: FormData): Promise<void> {
  const user = await requireCan("patients", "create");
  const name = fd.get("name")?.toString().trim();
  if (!name) throw new Error("Name is required");
  const mrd = fd.get("mrd")?.toString().trim() || genMrd();

  const str = (k: string) => {
    const v = fd.get(k)?.toString().trim();
    return v ? v : null;
  };

  await prisma.patient.create({
    data: {
      mrd,
      name,
      phone: str("phone"),
      whatsapp: str("whatsapp"),
      email: str("email"),
      place: str("place"),
      address: str("address"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gender: (str("gender") as any) ?? undefined,
      occupation: str("occupation"),
      languagePref: str("languagePref"),
      firstVisitSource: str("firstVisitSource"),
    },
  });
  await writeAudit({ actorId: user.id, action: "patient.create", entity: "patient", entityId: mrd, after: { name, mrd } });
  revalidatePath("/patients");
  redirect(`/patients/${encodeURIComponent(mrd)}`);
}

export async function addPatientDocument(patientMrd: string, fd: FormData): Promise<void> {
  const user = await requireCan("patients", "edit");
  const label = fd.get("label")?.toString().trim();
  const url = fd.get("url")?.toString().trim();
  if (!label || !url) throw new Error("Label and URL are required");
  const created = await prisma.patientDocument.create({ data: { patientMrd, label, url } });
  await writeAudit({ actorId: user.id, action: "patient.document.add", entity: "patient_document", entityId: created.id, after: { label } });
  revalidatePath(`/patients/${encodeURIComponent(patientMrd)}`);
}

export async function deletePatientDocument(id: string, patientMrd: string): Promise<void> {
  const user = await requireCan("patients", "edit");
  await prisma.patientDocument.delete({ where: { id } });
  await writeAudit({ actorId: user.id, action: "patient.document.delete", entity: "patient_document", entityId: id });
  revalidatePath(`/patients/${encodeURIComponent(patientMrd)}`);
}
