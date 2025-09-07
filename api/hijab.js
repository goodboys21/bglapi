import axios from "axios";
import formidable from "formidable";
import fs from "fs";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = new formidable.IncomingForm();
    form.keepExtensions = true;

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    let sourceImage;

    if (fields.imageUrl) {
      const uploadResp = await axios.post(
        "https://api.pixnova.ai/aitools/upload-img",
        {},
        {
          headers: {
            Accept: "application/json",
            fp: "9a604fbb530d015eaea97295739f2d5a",
            fp1: "o7sJx1/Cfd/tVH6xNuAn7gnZHrwIvgpAe4BSPi1jpsCEtSAtDCvK75lC1dHArs6a",
            "x-guide":
              "JUKkSnhDvj5EaXIXK9wz5lDAwMHyUvzmGMM/KStjDEPjghIU/V/R1a3oK/oeVV9BhTsRnUtrIrlJ32UJlSs1nZYyPxm0GYD/7qMCidH640jiYOZsDXsE+Vpj6hcDb0ApHHVmNH7DYP3NqG43ITiDPHkptzCS37MgUkY6T7aFtMY=",
            "X-code": Date.now(),
          },
          params: { url: fields.imageUrl },
        }
      );
      sourceImage = uploadResp.data.data.path;
    } else if (files.image) {
      const fileBuffer = fs.readFileSync(files.image.filepath);
      const formData = new FormData();
      formData.append("file", fileBuffer, files.image.originalFilename);

      const uploadResp = await axios.post(
        "https://api.pixnova.ai/aitools/upload-img",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            Accept: "application/json",
            fp: "9a604fbb530d015eaea97295739f2d5a",
            fp1: "o7sJx1/Cfd/tVH6xNuAn7gnZHrwIvgpAe4BSPi1jpsCEtSAtDCvK75lC1dHArs6a",
            "x-guide":
              "JUKkSnhDvj5EaXIXK9wz5lDAwMHyUvzmGMM/KStjDEPjghIU/V/R1a3oK/oeVV9BhTsRnUtrIrlJ32UJlSs1nZYyPxm0GYD/7qMCidH640jiYOZsDXsE+Vpj6hcDb0ApHHVmNH7DYP3NqG43ITiDPHkptzCS37MgUkY6T7aFtMY=",
            "X-code": Date.now(),
          },
        }
      );
      sourceImage = uploadResp.data.data.path;
    } else {
      return res.status(400).json({ error: "No image provided" });
    }

    // Buat task cloth-change (prompt default: hijab)
    const createResp = await axios.post(
      "https://api.pixnova.ai/aitools/of/create",
      {
        fn_name: "cloth-change",
        call_type: 3,
        input: {
          source_image: sourceImage,
          prompt: "hijab",
          cloth_type: "full_outfits",
          request_from: 2,
          type: 1,
        },
        request_from: 2,
        origin_from: "111977c0d5def647",
      },
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          fp: "9a604fbb530d015eaea97295739f2d5a",
          fp1: "7O5Dd7AKSx84602nAhDTnchaWe/BwGCEoOnP5Rk/z6VKo0IwmgiV0a3cw5FeLEpj",
          "x-guide":
            "D9Hv+qydFmZnw3Ht4HPKioxTnztv9474Jez5jrGy22dlMDQVbQRZ8v8T0srogOOI6LjfsmBgt1hHoOEX3G1FWNbePErzCErYNn4Qd0b2WyoY+AvC8xviBL3RqQa3alagSRCfziKDOvkwtg7vXhroqRnexN59n5Y1i70G9FX1pOk=",
          "X-code": Date.now(),
        },
      }
    );

    const taskId = createResp.data.data.task_id;

    // Polling status
    let result = null;
    for (let i = 0; i < 15; i++) {
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
            Accept: "application/json",
            "Content-Type": "application/json",
            fp: "9a604fbb530d015eaea97295739f2d5a",
            fp1: "fCB4twaIbzC+VSy5dny5UDCvHTJp/7X3Ki5iMYhWrdZy500e1yd8L3sbSQ1/gji+",
            "x-guide":
              "DOHIouUw6qus6Zrup3JvlcY8zT4Zt/prKkhOgLwGLpf5lbfoT1hLrLlm+9/xRtkSSytbjCQlIhZn/T/Y0rolIYnEpXPSQTOc3RwqJKF14MyZbs8aWP1O/Nbsc2OakNnJV5HhhXMJ/V95lxrEpz/752wVXyvPDbq4fgOOedujW20=",
            "X-code": Date.now(),
          },
        }
      );

      if (statusResp.data.data.status === 2) {
        result = statusResp.data.data.result_image;
        break;
      }

      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!result) {
      return res
        .status(202)
        .json({ message: "Processing, try again later", taskId });
    }

    // Ambil file hasil dari Pixnova
    const imageBuffer = await axios.get(
      `https://api.pixnova.ai/${result}`,
      { responseType: "arraybuffer" }
    );

    // Upload ke cloudgood.xyz
    const formData = new FormData();
    formData.append("file", Buffer.from(imageBuffer.data), "result.webp");

    const cloudResp = await axios.post(
      "https://cloudgood.xyz/upload.php",
      formData,
      { headers: formData.getHeaders() }
    );

    res.json({
      code: 200,
      message: "Success",
      result: cloudResp.data.url || cloudResp.data, // asumsi cloudgood balikin { url: ... }
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
