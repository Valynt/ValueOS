import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Import the functions to test
import {
  formatPortsEnv,
  loadPorts,
  resolvePort,
  writePortsEnvFile,
} from "../../scripts/dx/ports.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Port Management Functions", () => {
  const mockPorts = {
    frontend: { port: 5173, hmrPort: 24678 },
    backend: { port: 3001 },
    postgres: { port: 5432 },
    redis: { port: 6379 },
    supabase: { apiPort: 54321, studioPort: 54323 },
    edge: { httpPort: 8080, httpsPort: 8443, adminPort: 2019 },
    observability: {
      prometheusPort: 9090,
      grafanaPort: 3000,
      jaegerPort: 16686,
      lokiPort: 3100,
      tempoPort: 3200,
      tempoOtlpGrpcPort: 4317,
      tempoOtlpHttpPort: 4318,
    },
  };

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("resolvePort", () => {
    it("should return fallback for null/undefined/empty", () => {
      expect(resolvePort(null, 3001)).toBe(3001);
      expect(resolvePort(undefined, 3001)).toBe(3001);
      expect(resolvePort("", 3001)).toBe(3001);
    });

    it("should parse valid numbers", () => {
      expect(resolvePort("3000", 3001)).toBe(3000);
      expect(resolvePort(3000, 3001)).toBe(3000);
      expect(resolvePort("  3000  ", 3001)).toBe(3000);
    });

    it("should warn and fallback for invalid strings", () => {
      const result = resolvePort("abc", 3001);
      expect(result).toBe(3001);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid port value "abc"')
      );
    });

    it("should warn and fallback for out of range", () => {
      const result = resolvePort("70000", 3001);
      expect(result).toBe(3001);
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining("out of valid range")
      );
    });

    it("should return valid port within range", () => {
      expect(resolvePort("8080", 3001)).toBe(8080);
      expect(resolvePort("1", 3001)).toBe(1);
      expect(resolvePort("65535", 3001)).toBe(65535);
    });
  });

  describe("formatPortsEnv", () => {
    it("should format ports correctly", () => {
      const formatted = formatPortsEnv(mockPorts);
      expect(formatted).toContain("API_PORT=3001");
      expect(formatted).toContain("VITE_PORT=5173");
      expect(formatted).toContain("POSTGRES_PORT=5432");
      expect(formatted).toContain("CADDY_HTTP_PORT=8080");
      expect(formatted).toContain("PROMETHEUS_PORT=9090");
      expect(formatted).toContain("API_UPSTREAM=http://backend:3001");
      expect(formatted).not.toContain("GRAFANA_ADMIN_PASSWORD=admin"); // Removed hardcoded secret
    });
  });

  describe("loadPorts", () => {
    it("should load and validate ports", () => {
      const spy = jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(JSON.stringify(mockPorts));
      const result = loadPorts();
      expect(result).toEqual(mockPorts);
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Loaded ports configuration")
      );
      spy.mockRestore();
    });

    it("should throw on invalid JSON", () => {
      const spy = jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue("invalid json");
      expect(() => loadPorts()).toThrow();
      spy.mockRestore();
    });

    it("should throw on invalid ports", () => {
      const spy = jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(JSON.stringify({ backend: { port: "invalid" } }));
      expect(() => loadPorts()).toThrow("backend.port must be an integer");
      spy.mockRestore();
    });
  });

  describe("writePortsEnvFile", () => {
    beforeEach(() => {
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(mockPorts));
      jest.spyOn(fs, "writeFileSync").mockImplementation(() => {});
      jest.spyOn(fs, "existsSync").mockReturnValue(false);
      jest.spyOn(fs, "unlinkSync").mockImplementation(() => {});
      jest.spyOn(fs, "statSync").mockReturnValue({ mtime: new Date() });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it("should write ports env file", () => {
      const result = writePortsEnvFile("/tmp/test.env.ports");
      expect(result).toBe("/tmp/test.env.ports");
      expect(fs.writeFileSync).toHaveBeenCalledTimes(2); // lock file and content
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("Wrote ports env file")
      );
    });

    it("should handle file locking", () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ mtime: new Date(Date.now() - 10000) }); // Recent lock

      expect(() => writePortsEnvFile("/tmp/test.env.ports")).toThrow(
        "Port configuration file is locked"
      );
    });

    it("should remove stale locks", () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ mtime: new Date(Date.now() - 60000) }); // Old lock

      writePortsEnvFile("/tmp/test.env.ports");
      expect(fs.unlinkSync).toHaveBeenCalledWith("/tmp/test.env.ports.lock");
    });
  });
});
