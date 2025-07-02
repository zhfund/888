import puppeteer from "puppeteer";
import fs from "fs";
import plimit from "p-limit";
import crypto from "crypto";

// 配置
const MAGICNEWTON_URL = "https://www.magicnewton.com/portal/rewards";
// 确保32字节密钥
const ENCRYPTION_KEY = Buffer.from("mysecret32charlongkey1234567890!", "utf8"); // 32字节
const RANDOM_EXTRA_DELAY = () =>
  Math.floor(Math.random() * (60 - 20 + 1) + 20) * 60 * 1000; // 20-60 mins random delay
let maxDelayTime = "00:00:00";

// 工具函数
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const showTime = (totalMs) => {
  const hours = Math.floor(totalMs / (1000 * 60 * 60));
  const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((totalMs % (1000 * 60)) / 1000);
  return `${hours}:${minutes}:${seconds}`;
};

function totalMs(timeStr) {
  const parts = timeStr.split(":").map(Number);
  if (parts.length !== 3) return null;
  return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
}

// Cookies 加密/解密
function encryptCookies(cookies) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(cookies), "utf8", "hex");
  encrypted += cipher.final("hex");
  return { iv: iv.toString("hex"), data: encrypted };
}

function decryptCookies(encrypted) {
  try {
    console.log("Decryption Key Length:", ENCRYPTION_KEY.length);
    const decipher = crypto.createDecipheriv(
      "aes-256-cbc",
      ENCRYPTION_KEY,
      Buffer.from(encrypted.iv, "hex")
    );
    let decrypted = decipher.update(encrypted.data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (error) {
    console.error("❌ 解密失败:", error.message);
    throw error;
  }
}

// 主任务
const index = async (cookies, retries = 3) => {
  let browser;
  try {
    console.log("🔄 新周期开始...");
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();

    // 设置伪装
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    if (!cookies || !Array.isArray(cookies)) {
      throw new Error("无效的 Cookies 数据");
    }

    // 修复：确保每个cookie有domain或url
    const fixedCookies = cookies.map((cookie) => ({
      ...cookie,
      domain: cookie.domain || ".magicnewton.com", // 默认域名
      url: cookie.url || MAGICNEWTON_URL, // 默认URL
    }));
    console.log("🔍 准备设置的Cookies:", fixedCookies); // 调试输出
    await page.setCookie(...fixedCookies);
    console.log("✅ Cookies 加载成功。\n⏳ 网页加载中：可能需要最多60秒...");

    await page.goto(MAGICNEWTON_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });
    console.log(" 🌐 页面加载完成.");

    // 模拟人类行为
    await page.mouse.move(Math.random() * 100, Math.random() * 100);

    const userEmail = await page
      .$eval("p.gGRRlH.WrOCw.AEdnq.hGQgmY.jdmPpC", (el) => el.innerText)
      .catch(() => "Unknown");
    console.log(`📧 登录用户： ${userEmail.split("@")[0]}@****`);

    let userCredits = await page
      .$eval("#creditBalance", (el) => el.innerText)
      .catch(() => "Unknown");
    console.log(`💰 当前积分：${userCredits}`);

    await page.waitForSelector("button", { timeout: 30000 });
    const rollNowClicked = await page.$$eval("button", (buttons) => {
      const target = buttons.find(
        (btn) => btn.innerText && btn.innerText.includes("Roll now")
      );
      if (target) {
        target.click();
        return true;
      }
      return false;
    });

    if (rollNowClicked) {
      console.log("✅ 点击了“Roll now”按钮！");
      await delay(5000);

      const letsRollClicked = await page.$$eval("button", (buttons) => {
        const target = buttons.find(
          (btn) => btn.innerText && btn.innerText.includes("Let's roll")
        );
        if (target) {
          target.click();
          return true;
        }
        return false;
      });

      if (letsRollClicked) {
        console.log("✅ 点击了“Let’s roll”按钮！");
        await delay(5000);
        const throwDiceClicked = await page.$$eval("button", (buttons) => {
          const target = buttons.find(
            (btn) => btn.innerText && btn.innerText.includes("Throw Dice")
          );
          if (target) {
            target.click();
            return true;
          }
          return false;
        });

        if (throwDiceClicked) {
          console.log("✅ 点击了“Throw Dice”按钮！");
          console.log("⏳ 等待60秒骰子动画...");
          await delay(60000);
          userCredits = await page
            .$eval("#creditBalance", (el) => el.innerText)
            .catch(() => "Unknown");
          console.log(`💰 更新后的积分： ${userCredits}`);
          maxDelayTime = "24:00:00";
        } else {
          console.log("⚠️ 未找到“Throw Dice”按钮。");
        }
      } else {
        console.log("⚠️ 未找到“Let’s roll”按钮。");
      }
    } else {
      console.log("👇 等待！ROLL尚不可用。");
      const timerText = await page.evaluate(() => {
        const h2Elements = Array.from(document.querySelectorAll("h2"));
        for (let h2 of h2Elements) {
          const text = h2.innerText.trim();
          if (/^\d{2}:\d{2}:\d{2}$/.test(text)) {
            return text;
          }
        }
        return null;
      });

      if (timerText) {
        console.log(`⏱ 距离下一次ROLL的剩余时间：${timerText}`);
        if (maxDelayTime < timerText) {
          maxDelayTime = timerText;
        }
      } else {
        console.log("⚠️ 未找到计时器。使用默认休眠时间。");
      }
    }
  } catch (error) {
    console.error("❌ 错误:", error);
    if (retries > 0) {
      console.log(`🔄 重试剩余次数：${retries}...`);
      await delay(5000);
      return index(cookies, retries - 1);
    }
  } finally {
    if (browser) await browser.close();
    console.log(`🔄 完成.`);
  }
};

// 主函数
const main = async () => {
  console.log("🚀 启动机器人..");
  const limit = plimit(1);

  // 读取并解密 Cookies
  let encryptedCookies;
  try {
    encryptedCookies = JSON.parse(fs.readFileSync("cookies.json", "utf8"));
    if (!encryptedCookies.iv || !encryptedCookies.data) {
      throw new Error("Cookies 文件格式错误");
    }
  } catch (error) {
    console.error("❌ 读取 Cookies 失败:", error);
    return;
  }

  const cookies = decryptCookies(encryptedCookies);
  const tasks = cookies.map((item) => limit(() => index([item])));

  await Promise.all(tasks);
  const extraDelay = RANDOM_EXTRA_DELAY();
  const total = totalMs(maxDelayTime) || 0;
  const time = total + extraDelay;
  console.log(
    `本轮所有任务已结束，当前时间 ${new Date()}, 下轮时间：${new Date(
      Date.now() + time
    )}`
  );

  // 设置下一次运行
  setTimeout(main, time);
};

// 启动
main().catch((err) => console.error("启动失败:", err));

// 示例：生成加密的 cookies.json（仅用于初始化，实际应从登录流程获取）
const generateEncryptedCookies = (cookies) => {
  const encrypted = encryptCookies(cookies);
  fs.writeFileSync("cookies.json", JSON.stringify(encrypted, null, 2));
  console.log("✅ 已生成加密的 cookies.json");
};

// generateEncryptedCookies([{ name: "example", value: "123", domain: ".magicnewton.com" }]); // 取消注释以生成示例文件