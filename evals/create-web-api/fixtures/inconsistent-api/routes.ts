router.get("/users/:userId", requireAuth, async (req, res) => {
  const user = await users.find(req.params.userId);
  if (!user) return res.status(404).json({ code: "not_found" });
  return res.json({ userId: user.id, email: user.email });
});

router.post("/users", async (req, res) => {
  const user = await users.create(req.body);
  return res.status(201).json({ id: user.id, email: user.email });
});

router.get("/reports", requireAuth, async (_req, res) => {
  return res.json(await reports.listAll());
});
