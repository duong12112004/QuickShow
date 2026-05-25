import express from "express";
import { getActiveConcessions } from "../controllers/concessionController.js";

const concessionRouter = express.Router();

concessionRouter.get("/", getActiveConcessions);

export default concessionRouter;
