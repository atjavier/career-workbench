import { revalidatePath } from "next/cache";

export function revalidateCareerWorkspaces() {
  revalidatePath("/");
  revalidatePath("/resume");
  revalidatePath("/resume/profile");
  revalidatePath("/resume/interview");
  revalidatePath("/evidence");
  revalidatePath("/career-assistant");
}

