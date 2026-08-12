import { createClient } from "@/lib/supabase/server";
import ShiftCtrlApp from "@/components/ShiftCtrlApp";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return <ShiftCtrlApp userEmail={user?.email} />;
}
