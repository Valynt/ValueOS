import { Router, type Request, type Response } from "express";

const router = Router();

router.get("/client-capabilities", (_req: Request, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    llm: {
      togetherConfigured: Boolean(process.env.TOGETHER_API_KEY),
    },
  });
});

export default router;
