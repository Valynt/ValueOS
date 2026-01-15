import express from "express";

const healthRouter = express.Router();

healthRouter.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

let shuttingDown = false;

function markAsShuttingDown() {
  shuttingDown = true;
}

export { healthRouter as default, markAsShuttingDown };
