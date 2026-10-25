const TEST_SUPABASE_URL = "https://bvtqtvqvwbqmuewuhipc.supabase.co";

type SupabaseEnvironmentSources = {
  viteUrl?: string | undefined;
  vitePublishableKey?: string | undefined;
  testVitePublishableKey?: string | undefined;
  serverUrl?: string | undefined;
  serverPublishableKey?: string | undefined;
};

export function resolveSupabaseEnvironment(mode: string, sources: SupabaseEnvironmentSources) {
  const isTest = mode === "test" || mode === "testdev";
  const url = isTest ? sources.viteUrl : sources.viteUrl || sources.serverUrl;
  const publishableKey = isTest
    ? sources.testVitePublishableKey
    : sources.vitePublishableKey || sources.serverPublishableKey;

  if (isTest && url !== TEST_SUPABASE_URL) {
    throw new Error("Test mode must use the configured TEST Supabase project URL.");
  }

  if (!url || !publishableKey) {
    const missing = [
      ...(!url ? [isTest ? "VITE_SUPABASE_URL" : "SUPABASE_URL"] : []),
      ...(!publishableKey ? [isTest ? "VITE_SUPABASE_TEST_PUBLISHABLE_KEY" : "SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(", ")}.`);
  }

  return { url, publishableKey };
}