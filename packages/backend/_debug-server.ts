process.on("uncaughtException", (err) => {
  const errCode =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code?: unknown }).code
      : undefined;

  console.error(">>> UNCAUGHT EXCEPTION <<<");
  console.error("name:", err?.name);
  console.error("message:", err?.message);
  console.error("code:", errCode);
  console.error("stack:", err?.stack);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(">>> UNHANDLED REJECTION <<<");
  console.error(reason);
  process.exit(1);
});
import("./src/server.ts");
