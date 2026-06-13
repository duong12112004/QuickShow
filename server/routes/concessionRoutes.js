import express from "express";
import { getActiveConcessions } from "../controllers/concessionController.js";

const concessionRouter = express.Router();

// Trả các món ăn/combo đang mở bán cho khách hàng chọn khi đặt vé.
concessionRouter.get("/", getActiveConcessions);

export default concessionRouter;
