import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, "public")));




// ❗ KHÔNG CÓ DẤU "/" CUỐI
const WORKER_URL = "https://1.doanngocminhquy.workers.dev";

function sanitize(s) {
  return String(s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r/g, "")
    .trim();
}

app.post("/api/orders", async (req, res) => {
  try {
    let { cookies } = req.body;
    if (!Array.isArray(cookies)) cookies = [cookies];
    cookies = cookies.map(sanitize).filter(Boolean);

    if (!cookies.length) {
      return res.status(400).json({ error: "Chưa có cookie" });
    }

    const r = await axios.post(
      WORKER_URL + "/orders",
      { cookies },
      {
        headers: { "Content-Type": "application/json" },
        timeout: 15000,
        responseType: "text"
      }
    );

    const html = r.data;

    if (typeof html === "string" && html.trim().startsWith("{")) {
      return res.status(502).json({
        error: "Worker trả lỗi JSON",
        detail: html
      });
    }

    const $ = cheerio.load(html);
    const orders = [];

    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length === 0) return;

      orders.push({
        stt: $(tds[0]).text().trim(),
        mvd: $(tds[1]).text().trim(),
        status: $(tds[2]).text().trim(),
        receiver: $(tds[3]).text().trim(),
        receiverPhone: $(tds[4]).text().trim(),
        address:
          $(tds[5]).attr("title")?.trim() || $(tds[5]).text().trim(),
        productImg: $(tds[6]).find("img.product").attr("src") || null,
        shipperName: $(tds[7]).text().trim(),
        shipperPhone: $(tds[8]).text().trim()
      });
    });

    return res.json({ count: orders.length, orders });

  } catch (e) {
    return res.status(500).json({
      error: "Lỗi lấy đơn qua Worker",
      detail: e?.response?.data || e.message
    });
  }
});

app.listen(3000, () =>
  console.log("Server A chạy tại: http://localhost:3000")
);
