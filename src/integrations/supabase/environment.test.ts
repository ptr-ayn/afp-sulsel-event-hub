import { describe, expect, it } from "vitest";
import { resolveSupabaseEnvironment } from "@/integrations/supabase/environment";

describe("resolveSupabaseEnvironment", () => {
  it("selects TEST credentials only when the TEST project URL is configured", () => {
    expect(resolveSupabaseEnvironment("test", {
      viteUrl: "https://bvtqtvqvwbqmuewuhipc.supabase.co",
      testVitePublishableKey: "test-publishable-placeholder",
      serverUrl: "https://production.supabase.co",
      serverPublishableKey: "production-publishable-placeholder",
    })).toEqual({
      url: "https://bvtqtvqvwbqmuewuhipc.supabase.co",
      publishableKey: "test-publishable-placeholder",
    });
  });

  it("keeps TEST backend isolation when the dev server uses the testdev mode", () => {
    expect(resolveSupabaseEnvironment("testdev", {
      viteUrl: "https://bvtqtvqvwbqmuewuhipc.supabase.co",
      testVitePublishableKey: "test-publishable-placeholder",
      serverUrl: "https://production.supabase.co",
      serverPublishableKey: "production-publishable-placeholder",
    })).toEqual({
      url: "https://bvtqtvqvwbqmuewuhipc.supabase.co",
      publishableKey: "test-publishable-placeholder",
    });
  });

  it("rejects a production URL in TEST mode instead of falling back", () => {
    expect(() => resolveSupabaseEnvironment("test", {
      viteUrl: "https://production.supabase.co",
      serverUrl: "https://production.supabase.co",
      serverPublishableKey: "production-publishable-placeholder",
    })).toThrow("Test mode must use the configured TEST Supabase project URL.");
  });

  it("requires a TEST-specific publishable key", () => {
    expect(() => resolveSupabaseEnvironment("test", {
      viteUrl: "https://bvtqtvqvwbqmuewuhipc.supabase.co",
      vitePublishableKey: "production-publishable-placeholder",
    })).toThrow("VITE_SUPABASE_TEST_PUBLISHABLE_KEY");
  });

  it("preserves existing production variable resolution outside TEST mode", () => {
    expect(resolveSupabaseEnvironment("production", {
      serverUrl: "https://production.supabase.co",
      serverPublishableKey: "production-publishable-placeholder",
      testVitePublishableKey: "test-publishable-placeholder",
    })).toEqual({
      url: "https://production.supabase.co",
      publishableKey: "production-publishable-placeholder",
    });
  });
});
describe("public config fallback", () => {
  it("falls back to the AFP Sulsel project when no env vars are present outside TEST mode", () => {
    expect(resolveSupabaseEnvironment("production", {})).toEqual({
      url: "https://cwmznvhtrulmnwyvykbn.supabase.co",
      publishableKey: "sb_publishable_yOw___v_4D38q1EusRkYTg_v8mhfrCa",
    });
  });

  it("never falls back in TEST mode", () => {
    expect(() => resolveSupabaseEnvironment("test", {})).toThrow();
  });
});
