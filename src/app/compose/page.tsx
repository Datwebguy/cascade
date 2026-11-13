import { redirect } from "next/navigation";
import { hasSession } from "@/lib/session";
import Cascade from "./Cascade";

export default async function ComposePage() {
  if (!(await hasSession())) redirect("/");
  return <Cascade />;
}
