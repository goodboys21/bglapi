const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");

const upload = multer();

const runMiddleware = (req, res, fn) =>
  new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      return result instanceof Error ? reject(result) : resolve(result);
    });
  });

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Metode tidak diizinkan." });

  const apikey = req.query.apikey;
  if (apikey !== "bagus") return res.status(403).json({ success: false, message: "API key salah!" });

  await runMiddleware(req, res, upload.single("file"));

  if (!req.file) return res.status(400).json({ success: false, message: "File tidak ditemukan!" });

  try {
    // 1️⃣ Upload ke Pixnova
    const formPix = new FormData();
    formPix.append("image", req.file.buffer, req.file.originalname);

    const uploadResp = await axios.post("https://api.pixnova.ai/aitools/upload-img", formPix, {
      headers: {
        ...formPix.getHeaders(),
        fp: "9a604fbb530d015eaea97295739f2d5a",
        fp1: "o7sJx1/Cfd/tVH6xNuAn7gnZHrwIvgpAe4BSPi1jpsCEtSAtDCvK75lC1dHArs6a",
        "x-guide": "JUKkSnhDvj5EaXIXK9wz5lDAwMHyUvzmGMM/KStjDEPjghIU/V/R1a3oK/oeVV9BhTsRnUtrIrlJ32UJlSs1nZYyPxm0GYD/7qMCidH640jiYOZsDXsE+Vpj6hcDb0ApHHVmNH7DYP3NqG43ITiDPHkptzCS37MgUkY6T7aFtMY=",
        "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
        "X-code": "1757218138001",
      },
    });

    const uploadedPath = uploadResp.data.data.path;

    // 2️⃣ Buat task hijab (prompt default)
    const createResp = await axios.post(
      "https://api.pixnova.ai/aitools/of/create",
      {
        fn_name: "cloth-change",
        call_type: 3,
        input: {
          source_image: uploadedPath,
          prompt: "hijab",   // default
          cloth_type: "full_outfits",
          request_from: 2,
          type: 1,
        },
        request_from: 2,
        origin_from: "111977c0d5def647",
      },
      {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          fp: "9a604fbb530d015eaea97295739f2d5a",
          fp1: "7O5Dd7AKSx84602nAhDTnchaWe/BwGCEoOnP5Rk/z6VKo0IwmgiV0a3cw5FeLEpj",
          "x-guide": "D9Hv+qydFmZnw3Ht4HPKioxTnztv9474Jez5jrGy22dlMDQVbQRZ8v8T0srogOOI6LjfsmBgt1hHoOEX3G1FWNbePErzCErYNn4Qd0b2WyoY+AvC8xviBL3RqQa3alagSRCfziKDOvkwtg7vXhroqRnexN59n5Y1i70G9FX1pOk=",
          "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
          "X-code": "1757218138924",
        },
      }
    );

    const taskId = createResp.data.data.task_id;

    // 3️⃣ Polling status
    let status = 0;
    let resultImage = null;
    while (status !== 2) {
      await new Promise((r) => setTimeout(r, 2000));
      const statusResp = await axios.post(
        "https://api.pixnova.ai/aitools/of/check-status",
        {
          task_id: taskId,
          fn_name: "cloth-change",
          call_type: 3,
          request_from: 2,
          origin_from: "111977c0d5def647",
        },
        {
          headers: {
            Accept: "application/json, text/plain, */*",
            "Content-Type": "application/json",
            fp: "9a604fbb530d015eaea97295739f2d5a",
            fp1: "jWpwywPi1wjxxQCmw51PhtYquZ+xm0UwaMsUi+UQF7ZH4OhdqVKYocTk63RKuwNq",
            "x-guide": "k2Ke808ry019FMbn5w9wJd8gVt4ZLRWuulpRff0qDZIobdF2fhi+gy+Ff9TADASzE3/8+ZGm3XS6wYesq4dzDwEM7NsjLm+u9MCqEdLwK6ZEjRmdS+sB7bnesYimS5diKqpfSiu3EcP0he7Up5k9X8ckuxxY78SJOCLPARnqVkA=",
            "theme-version": "83EmcUoQTUv50LhNx0VrdcK8rcGexcP35FcZDcpgWsAXEyO4xqL5shCY6sFIWB2Q",
            "X-code": "1757218187493",
          },
        }
      );
      status = statusResp.data.data.status;
      if (status === 2) resultImage = statusResp.data.data.result_image;
    }

    // 4️⃣ Upload ke CloudGood
    const imageBuffer = (await axios.get(`https://api.pixnova.ai/${resultImage}`, { responseType: "arraybuffer" })).data;
    const formCloud = new FormData();
    formCloud.append("file", imageBuffer, "hijab_result.webp");

    const cloudResp = await axios.post("https://cloudgood.xyz/upload.php", formCloud, {
      headers: { ...formCloud.getHeaders() },
    });

    return res.json({
      success: true,
      creator: "Bagus Bahril",
      filename: req.file.originalname,
      uploaded_at: new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }),
      result_url: cloudResp.data.url || cloudResp.data.link || cloudResp.data,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Terjadi kesalahan.", error: err.message });
  }
};
