import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ locals: { supabase }, fetch }) => {
  const { count: started } = await supabase
    .from("game_results")
    .select("*", { count: "exact", head: true });

  const { count: completed } = await supabase
    .from("game_results")
    .select("*", { count: "exact", head: true })
    .eq("win", true);

  const { data: totalSeconds, error: rpcError } = await supabase.rpc(
    "get_total_sweeping_time",
  );

  if (rpcError) {
    console.error("RPC Error:", rpcError);
  }

  const { data: history } = await supabase
    .from("game_results")
    .select("time, win, mode, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  let contributors = [];
  try {
    const res = await fetch(
      "https://api.github.com/repos/xguot/zsweep/contributors",
    );
    if (res.ok) {
      contributors = await res.json();
    }
  } catch (e) {
    console.error("Failed to fetch contributors", e);
  }

  return {
    stats: {
      started: started || 0,
      completed: completed || 0,
      seconds: totalSeconds || 0,
      game_results: history || [],
    },
    contributors: contributors || [],
  };
};
