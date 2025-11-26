import express from "express";
import axios from "axios";
import * as cheerio from "cheerio";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Public folder
app.use(express.static(path.join(__dirname, "public")));

// Website đích (không dùng Worker)
const WEB_B = "https://www.nganmiu.store/";

// sanitize
function sanitize(s) {
  return String(s || "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\r/g, "")
    .trim();
}

// API chính
app.post("/api/orders", async (req, res) => {
  try {
    let { cookies } = req.body;

    if (!Array.isArray(cookies)) cookies = [cookies];
    cookies = cookies.map(sanitize).filter(Boolean);
    if (!cookies.length) {
      return res.status(400).json({ error: "Chưa có cookie" });
    }

    // POST thẳng lên web Nganmiu
    const form = new URLSearchParams();
    form.append("cookies", cookies.join("\n"));
    form.append("action", "check");

    const r = await axios.post(WEB_B, form.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0",
        "Referer": WEB_B,
      },
      responseType: "text",
      timeout: 20000
    });

    const html = r.data;
    const $ = cheerio.load(html);
    const orders = [];

    $("table tbody tr").each((_, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;

      orders.push({
        stt: $(tds[0]).text().trim(),
        mvd: $(tds[1]).text().trim(),
        status: $(tds[2]).text().trim(),
        receiver: $(tds[3]).text().trim(),
        receiverPhone: $(tds[4]).text().trim(),
        address: $(tds[5]).attr("title")?.trim() || $(tds[5]).text().trim(),
        productImg: $(tds[6]).find("img").attr("src") || null,
        shipperName: $(tds[7]).text().trim(),
        shipperPhone: $(tds[8]).text().trim(),
      });
    });

    return res.json({ count: orders.length, orders });

  } catch (e) {
    return res.status(500).json({
      error: "Lỗi đọc dữ liệu từ web",
      detail: e?.response?.data || e.message
    });
  }
});

// Render PORT
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server đang chạy tại PORT:", PORT);
});
