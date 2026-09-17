import { describe, it, expect, vi, afterEach } from "vitest";

const startup = vi.hoisted(() => ({
  recover: vi.fn<() => Promise<number>>(),
  listen: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), info: vi.fn() },
}));
vi.mock("./repositories/scans.repository.js", () => ({
  default: { failStaleRunningScans: startup.recover },
}));
vi.mock("./app.js", () => ({ createApp: () => ({ listen: startup.listen }) }));
vi.mock("./config/logger.js", () => ({ default: startup.logger }));

const originalRejections = process.listeners("unhandledRejection");
const originalExceptions = process.listeners("uncaughtException");
afterEach(() => {
  for (const listener of process.listeners("unhandledRejection")) {
    if (!originalRejections.includes(listener))
      process.removeListener("unhandledRejection", listener);
  }
  for (const listener of process.listeners("uncaughtException")) {
    if (!originalExceptions.includes(listener))
      process.removeListener("uncaughtException", listener);
  }
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.resetModules();
});
import express from "express";

describe("Travelog backend", () => {
  it("should load without errors", () => {
    const app = express();
    expect(app).toBeDefined();
    expect(typeof app).toBe("function");
  });

  it("should support middleware registration", () => {
    const app = express();
    // Express 5 exposes request/response handler count via listener tracking
    let captured: unknown;
    app.use((_req, res, next) => {
      captured = { path: _req.path };
      next();
    });
    expect(captured).not.toBeDefined();
  });

  it("waits for recovery before listening and exports the app", async () => {
    let finish!: (count: number) => void;
    startup.recover.mockReturnValueOnce(
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    );
    const loading = import("./index.js");
    await vi.waitFor(() => expect(startup.recover).toHaveBeenCalledOnce());
    expect(startup.listen).not.toHaveBeenCalled();
    finish(2);
    const mod = await loading;
    expect(mod.default).toBeDefined();
    expect(startup.listen).toHaveBeenCalledOnce();
    expect(startup.logger.warn).toHaveBeenCalledWith({ count: 2 }, "server.stale_scans_recovered");
  });

  it("logs recovery failure before continuing startup", async () => {
    const err = new Error("Recovery unavailable");
    startup.recover.mockRejectedValueOnce(err);
    await import("./index.js");
    expect(startup.logger.error).toHaveBeenCalledWith(
      { err },
      "server.stale_scans_recovery_failed",
    );
    expect(startup.listen).toHaveBeenCalledOnce();
    expect(startup.logger.error.mock.invocationCallOrder[0]).toBeLessThan(
      startup.listen.mock.invocationCallOrder[0],
    );
  });

  it("logs unhandled rejections and logs then exits on uncaught exceptions", async () => {
    startup.recover.mockResolvedValueOnce(0);
    await import("./index.js");
    const rejectionHandler = process
      .listeners("unhandledRejection")
      .find((fn) => !originalRejections.includes(fn));
    const exceptionHandler = process
      .listeners("uncaughtException")
      .find((fn) => !originalExceptions.includes(fn));
    expect(rejectionHandler).toBeDefined();
    expect(exceptionHandler).toBeDefined();
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("exit intercepted");
    });
    const err = new Error("Test failure");
    // Invoke only our listeners: do not emit process errors into Vitest.
    rejectionHandler!(err, Promise.resolve());
    expect(startup.logger.error).toHaveBeenCalledWith({ err }, "server.unhandled_rejection");
    expect(exit).not.toHaveBeenCalled();
    expect(() => exceptionHandler!(err, "uncaughtException")).toThrow("exit intercepted");
    expect(startup.logger.fatal).toHaveBeenCalledWith({ err }, "server.uncaught_exception");
    expect(exit).toHaveBeenCalledWith(1);
    expect(startup.logger.fatal.mock.invocationCallOrder[0]).toBeLessThan(
      exit.mock.invocationCallOrder[0],
    );
  });
});
