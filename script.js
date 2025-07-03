import fs from "fs";
import crypto from "crypto";

const ENCRYPTION_KEY = "mysecret32charlongkey1234567890!";

function encryptCookies(cookies) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(cookies), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), data: encrypted };
}

const generateEncryptedCookies = (cookies) => {
  const encrypted = encryptCookies(cookies);
  fs.writeFileSync("cookies.json", JSON.stringify(encrypted, null, 2));
  console.log("✅ 已生成加密的 cookies.json");
};

// 调用生成
generateEncryptedCookies([
  
]);
