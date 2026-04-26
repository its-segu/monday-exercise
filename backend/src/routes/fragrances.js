import { Router } from "express";
import {
  createFragrance,
  deleteFragrance,
  getFragrance,
  listFragrances,
  updateFragrance,
} from "../services/fragranceStore.js";

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const fragrances = await listFragrances();
    res.json(fragrances);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const fragrance = await getFragrance(req.params.id);
    if (!fragrance) return res.status(404).json({ error: "Not found" });
    res.json(fragrance);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const fragrance = await createFragrance(req.body || {});
    res.status(201).json(fragrance);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const fragrance = await updateFragrance(req.params.id, req.body || {});
    res.json(fragrance);
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const ok = await deleteFragrance(req.params.id);
    if (!ok) return res.status(404).json({ error: "Not found" });
    res.status(204).send();
  })
);

export default router;
