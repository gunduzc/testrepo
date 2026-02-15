import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getInstanceMode,
  getRegistrationMode,
  getAllowedDomains,
  getPrereqEnforcement,
  canCreateContent,
  canBrowseLibrary,
  showClassesUI,
  hasEducatorRole,
} from "./instance-config";

describe("instance-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getInstanceMode", () => {
    it("should default to community", () => {
      delete process.env.INSTANCE_MODE;
      expect(getInstanceMode()).toBe("community");
    });

    it("should return community mode", () => {
      process.env.INSTANCE_MODE = "community";
      expect(getInstanceMode()).toBe("community");
    });

    it("should return publisher mode", () => {
      process.env.INSTANCE_MODE = "publisher";
      expect(getInstanceMode()).toBe("publisher");
    });

    it("should return school mode", () => {
      process.env.INSTANCE_MODE = "school";
      expect(getInstanceMode()).toBe("school");
    });

    it("should handle case-insensitivity", () => {
      process.env.INSTANCE_MODE = "SCHOOL";
      expect(getInstanceMode()).toBe("school");
    });

    it("should fallback to community for invalid values", () => {
      process.env.INSTANCE_MODE = "invalid";
      expect(getInstanceMode()).toBe("community");
    });
  });

  describe("getRegistrationMode", () => {
    it("should default to open", () => {
      delete process.env.REGISTRATION;
      expect(getRegistrationMode()).toBe("open");
    });

    it("should return valid modes", () => {
      process.env.REGISTRATION = "domain";
      expect(getRegistrationMode()).toBe("domain");

      process.env.REGISTRATION = "sso";
      expect(getRegistrationMode()).toBe("sso");

      process.env.REGISTRATION = "invite";
      expect(getRegistrationMode()).toBe("invite");

      process.env.REGISTRATION = "code";
      expect(getRegistrationMode()).toBe("code");
    });
  });

  describe("getAllowedDomains", () => {
    it("should return empty array when not set", () => {
      delete process.env.ALLOWED_DOMAINS;
      expect(getAllowedDomains()).toEqual([]);
    });

    it("should parse comma-separated domains", () => {
      process.env.ALLOWED_DOMAINS = "example.com, test.org, school.edu";
      expect(getAllowedDomains()).toEqual([
        "example.com",
        "test.org",
        "school.edu",
      ]);
    });

    it("should lowercase domains", () => {
      process.env.ALLOWED_DOMAINS = "EXAMPLE.COM";
      expect(getAllowedDomains()).toEqual(["example.com"]);
    });
  });

  describe("getPrereqEnforcement", () => {
    it("should use explicit setting", () => {
      process.env.PREREQ_ENFORCEMENT = "hard";
      expect(getPrereqEnforcement()).toBe("hard");

      process.env.PREREQ_ENFORCEMENT = "soft";
      expect(getPrereqEnforcement()).toBe("soft");

      process.env.PREREQ_ENFORCEMENT = "none";
      expect(getPrereqEnforcement()).toBe("none");
    });

    it("should default to hard for school mode", () => {
      delete process.env.PREREQ_ENFORCEMENT;
      process.env.INSTANCE_MODE = "school";
      expect(getPrereqEnforcement()).toBe("hard");
    });

    it("should default to soft for community/publisher modes", () => {
      delete process.env.PREREQ_ENFORCEMENT;
      process.env.INSTANCE_MODE = "community";
      expect(getPrereqEnforcement()).toBe("soft");

      process.env.INSTANCE_MODE = "publisher";
      expect(getPrereqEnforcement()).toBe("soft");
    });
  });

  describe("canCreateContent", () => {
    it("should allow everyone in community mode", () => {
      process.env.INSTANCE_MODE = "community";
      expect(canCreateContent("STUDENT")).toBe(true);
      expect(canCreateContent("EDUCATOR")).toBe(true);
      expect(canCreateContent("ADMIN")).toBe(true);
    });

    it("should only allow educators/admins in publisher mode", () => {
      process.env.INSTANCE_MODE = "publisher";
      expect(canCreateContent("STUDENT")).toBe(false);
      expect(canCreateContent("EDUCATOR")).toBe(true);
      expect(canCreateContent("ADMIN")).toBe(true);
    });

    it("should only allow educators/admins in school mode", () => {
      process.env.INSTANCE_MODE = "school";
      expect(canCreateContent("STUDENT")).toBe(false);
      expect(canCreateContent("EDUCATOR")).toBe(true);
      expect(canCreateContent("ADMIN")).toBe(true);
    });
  });

  describe("canBrowseLibrary", () => {
    it("should allow everyone in community mode", () => {
      process.env.INSTANCE_MODE = "community";
      expect(canBrowseLibrary("STUDENT", true)).toBe(true);
      expect(canBrowseLibrary("STUDENT", false)).toBe(true);
    });

    it("should allow everyone in publisher mode", () => {
      process.env.INSTANCE_MODE = "publisher";
      expect(canBrowseLibrary("STUDENT", true)).toBe(true);
      expect(canBrowseLibrary("EDUCATOR", false)).toBe(true);
    });

    it("should restrict students in school mode if enrolled", () => {
      process.env.INSTANCE_MODE = "school";
      expect(canBrowseLibrary("STUDENT", true)).toBe(false);
      expect(canBrowseLibrary("STUDENT", false)).toBe(true);
      expect(canBrowseLibrary("EDUCATOR", true)).toBe(true);
      expect(canBrowseLibrary("ADMIN", true)).toBe(true);
    });
  });

  describe("showClassesUI", () => {
    it("should only show classes in school mode", () => {
      process.env.INSTANCE_MODE = "community";
      expect(showClassesUI()).toBe(false);

      process.env.INSTANCE_MODE = "publisher";
      expect(showClassesUI()).toBe(false);

      process.env.INSTANCE_MODE = "school";
      expect(showClassesUI()).toBe(true);
    });
  });

  describe("hasEducatorRole", () => {
    it("should return false for community mode", () => {
      process.env.INSTANCE_MODE = "community";
      expect(hasEducatorRole()).toBe(false);
    });

    it("should return true for publisher/school modes", () => {
      process.env.INSTANCE_MODE = "publisher";
      expect(hasEducatorRole()).toBe(true);

      process.env.INSTANCE_MODE = "school";
      expect(hasEducatorRole()).toBe(true);
    });
  });
});
