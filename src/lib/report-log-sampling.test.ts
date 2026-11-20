import { afterEach, describe, expect, it, vi } from "vitest";

import { sampleReportLog } from "@/lib/report-log-sampling";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server-side public report log sampling", () => {
  it.each([undefined, "", " ", "invalid", "-1", "1.1", "Infinity"])(
    "uses the 10%% default for %j",
    (value) => {
      vi.stubEnv("REPORT_LOG_SAMPLE_RATE", value);
      vi.spyOn(Math, "random").mockReturnValue(0.05);
      expect(sampleReportLog()).toBe(0.1);
    },
  );

  it("can disable reporting logs without a random draw", () => {
    vi.stubEnv("REPORT_LOG_SAMPLE_RATE", "0");
    const random = vi.spyOn(Math, "random");
    expect(sampleReportLog()).toBeNull();
    expect(random).not.toHaveBeenCalled();
  });

  it("can retain every batch without a random draw", () => {
    vi.stubEnv("REPORT_LOG_SAMPLE_RATE", "1");
    const random = vi.spyOn(Math, "random");
    expect(sampleReportLog()).toBe(1);
    expect(random).not.toHaveBeenCalled();
  });

  it("uses a server-configured fractional sample rate", () => {
    vi.stubEnv("REPORT_LOG_SAMPLE_RATE", "0.25");
    const random = vi.spyOn(Math, "random").mockReturnValue(0.249);
    expect(sampleReportLog()).toBe(0.25);
    random.mockReturnValue(0.25);
    expect(sampleReportLog()).toBeNull();
  });
});
