import app from "../server";

function hasMiddlewareForPath(appInstance: any, name: string, path: string): boolean {
  const stack = appInstance?._router?.stack ?? [];

  return stack.some((layer: any) => {
    const layerName = layer?.name || layer?.handle?.name;
    if (!layerName || !layerName.includes(name)) {
      return false;
    }

    if (!layer.regexp) {
      return true;
    }

    return layer.regexp.test(path);
  });
}

describe("Session timeout routing", () => {
  it("applies session timeout middleware to /api routes", () => {
    expect(hasMiddlewareForPath(app, "sessionTimeoutMiddleware", "/api/llm")).toBe(true);
  });
});
