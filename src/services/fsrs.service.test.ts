import { describe, it, expect } from "vitest";
import { fsrsService } from "./fsrs.service";
import { Rating } from "@/lib/types";

describe("FSRSService", () => {
  describe("computeRating", () => {
    it("should return GOOD for correct answers", () => {
      expect(fsrsService.computeRating(true)).toBe(Rating.GOOD);
    });

    it("should return AGAIN for incorrect answers", () => {
      expect(fsrsService.computeRating(false)).toBe(Rating.AGAIN);
    });
  });

  describe("capResponseTime", () => {
    it("should not cap response time under 2 minutes", () => {
      expect(fsrsService.capResponseTime(5000)).toBe(5000);
      expect(fsrsService.capResponseTime(60000)).toBe(60000);
      expect(fsrsService.capResponseTime(119999)).toBe(119999);
    });

    it("should cap response time at 2 minutes", () => {
      expect(fsrsService.capResponseTime(120000)).toBe(120000);
    });

    it("should cap response time over 2 minutes", () => {
      expect(fsrsService.capResponseTime(300000)).toBe(120000);
      expect(fsrsService.capResponseTime(1000000)).toBe(120000);
    });

    it("should handle zero response time", () => {
      expect(fsrsService.capResponseTime(0)).toBe(0);
    });

    it("should handle negative response time", () => {
      expect(fsrsService.capResponseTime(-1000)).toBe(-1000);
    });
  });
});
