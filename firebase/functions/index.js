
/**
 * Quan trọng: Đây là mã nguồn cho Firebase Cloud Functions (backend).
 * Nó cần được triển khai riêng biệt với ứng dụng frontend.
 *
 * Hướng dẫn triển khai:
 * 1. Cài đặt Firebase CLI: `npm install -g firebase-tools`
 * 2. Đăng nhập: `firebase login`
 * 3. Trong thư mục gốc của dự án, khởi tạo Functions: `firebase init functions`
 *    - Chọn TypeScript hoặc JavaScript (mã này là JS).
 *    - Chọn dự án Firebase của bạn.
 *    - Cài đặt các dependencies: `cd functions && npm install node-fetch @google/genai firebase-admin firebase-functions`
 * 4. Dán mã này vào file `functions/index.js`.
 * 5. Cấu hình biến môi trường (Rất quan trọng cho bảo mật):
 *    `firebase functions:config:set telegram.token="YOUR_TELEGRAM_BOT_TOKEN"`
 *    `firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"`
 * 6. Triển khai: `firebase deploy --only functions`
 * 7. Sau khi triển khai, Firebase sẽ cung cấp một URL cho hàm `telegramWebhook`.
 *    Sử dụng URL đó để đăng ký webhook với Telegram Bot thông qua API của Telegram.
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { GoogleGenAI, Type } = require("@google/genai");

admin.initializeApp();
const db = admin.firestore();

// Lấy biến môi trường đã cấu hình
const TELEGRAM_TOKEN = functions.config().telegram.token;
const GEMINI_API_KEY = functions.config().gemini.key;

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// --- HÀM TRỢ GIÚP ---

// Gửi tin nhắn trả lời về Telegram
async function replyToTelegram(chatId, text) {
  const url = `${TELEGRAM_API_URL}/sendMessage`;
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown',
    }),
  });
}

// Phân tích văn bản bằng Gemini để tạo công việc
async function parseTaskWithGemini(text) {
  const systemInstruction = `Bạn là một trợ lý AI thông minh cho ứng dụng PTODO. Nhiệm vụ của bạn là phân tích một chuỗi văn bản từ người dùng Việt Nam và chuyển đổi nó thành một đối tượng JSON có cấu trúc để tạo công việc.

  Bối cảnh hiện tại:
  - Ngày hiện tại (UTC): ${new Date().toISOString()}
  - Múi giờ của người dùng: Asia/Ho_Chi_Minh (UTC+7)

  Yêu cầu nghiêm ngặt:
  1.  **Phân tích ngày/giờ:** Nhận diện các mốc thời gian như "ngày mai", "9h sáng thứ 3 tuần sau", "20/11".
  2.  **Logic về năm (QUAN TRỌNG):** Nếu không có năm, phải dùng năm hiện tại. Nếu ngày đã qua trong năm nay, phải dùng năm sau. Ví dụ: Hôm nay là tháng 12/2024, người dùng nói "15/1", bạn phải hiểu là 15/01/2025.
  3.  **Chuyển đổi múi giờ:** Mọi thời gian người dùng nhập đều ở múi giờ UTC+7. Bạn PHẢI chuyển đổi nó sang giờ UTC và trả về ở định dạng ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ).
  4.  **Mặc định:** Nếu không có giờ cụ thể, mặc định là 17:00 (UTC+7). Nếu không có ngày, 'dueDate' phải là null.
  5.  **Trích xuất nội dung:** Lấy nội dung chính của công việc, loại bỏ thông tin ngày giờ.
  6.  **Hashtag:** Tìm các từ bắt đầu bằng '#', loại bỏ dấu '#' và chuyển thành chữ thường.
  7.  **Khẩn cấp:** Tìm các từ khóa như "gấp", "khẩn", "ngay", "ASAP" và đặt 'isUrgent' thành true.
  8.  **Output:** CHỈ trả về một đối tượng JSON hợp lệ.`;

  const response = await genAI.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Văn bản của người dùng: "${text}"`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          content: { type: Type.STRING, description: "Nội dung chính của công việc." },
          tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Danh sách các thẻ, không có dấu '#', chữ thường." },
          dueDate: { type: Type.STRING, description: "Ngày hết hạn ở định dạng ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ) hoặc null." },
          isUrgent: { type: Type.BOOLEAN, description: "Công việc có khẩn cấp hay không." },
        },
        required: ["content", "dueDate", "isUrgent", "tags"],
      },
    }
  });

  const jsonString = response.text.trim();
  return JSON.parse(jsonString);
}


// --- CLOUD FUNCTIONS ---

/**
 * Webhook để nhận các cập nhật từ Telegram.
 */
exports.telegramWebhook = functions.https.onRequest(async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const update = req.body;
  const message = update.message;

  if (!message || !message.text) {
    return res.sendStatus(200);
  }

  const chatId = message.chat.id;
  const text = message.text;

  try {
    // 1. Xử lý lệnh /start để kết nối tài khoản
    if (text.startsWith("/start ")) {
      const userId = text.split(" ")[1];
      if (!userId) {
        await replyToTelegram(chatId, "Lỗi: Lệnh kết nối không hợp lệ. Vui lòng sao chép chính xác lệnh từ ứng dụng PTODO.");
        return res.sendStatus(200);
      }

      const userDocRef = db.collection("users").doc(userId);
      await userDocRef.update({
        telegramChatId: chatId,
        telegramUsername: message.chat.username || "",
      });
      await replyToTelegram(chatId, "🎉 Kết nối thành công! Bây giờ anh có thể quản lý công việc PTODO ngay tại đây.\n\nThử ra lệnh:\n`/add Họp với team marketing 9h sáng mai #họp`");
      return res.sendStatus(200);
    }
    
    // Tìm người dùng Firebase dựa trên chatId
    const usersQuery = await db.collection("users").where("telegramChatId", "==", chatId).limit(1).get();
    if (usersQuery.empty) {
      await replyToTelegram(chatId, "Tài khoản Telegram này chưa được kết nối. Vui lòng vào Cài đặt trong ứng dụng PTODO để lấy lệnh kết nối.");
      return res.sendStatus(200);
    }
    const user = usersQuery.docs[0];
    const userId = user.id;

    // 2. Xử lý lệnh /add để thêm công việc
    if (text.startsWith("/add ")) {
      const taskText = text.substring(5).trim();
      if (!taskText) {
          await replyToTelegram(chatId, "Vui lòng nhập nội dung công việc. Ví dụ: `/add Đi siêu thị mua sữa`");
          return res.sendStatus(200);
      }
      
      await replyToTelegram(chatId, "Em đang phân tích, anh chờ chút nhé...");
      const parsedTask = await parseTaskWithGemini(taskText);

      await db.collection("tasks").add({
          text: parsedTask.content,
          hashtags: parsedTask.tags || [],
          dueDate: parsedTask.dueDate ? new Date(parsedTask.dueDate) : null,
          isUrgent: parsedTask.isUrgent || false,
          status: 'todo',
          reminderSent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          userId: userId,
      });

      await replyToTelegram(chatId, `✅ Đã thêm công việc mới: "${parsedTask.content}"`);
      return res.sendStatus(200);
    }

    // 3. Xử lý lệnh /schedule để xem lịch
    if (text.startsWith("/schedule")) {
        const today = new Date();
        today.setHours(0,0,0,0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const dayAfterTomorrow = new Date(tomorrow);
        dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

        let startDate = today;
        let endDate = tomorrow;
        let dayLabel = "hôm nay";

        if (text.includes("tomorrow")) {
            startDate = tomorrow;
            endDate = dayAfterTomorrow;
            dayLabel = "ngày mai";
        }
        
        const tasksQuery = await db.collection("tasks")
            .where("userId", "==", userId)
            .where("dueDate", ">=", startDate)
            .where("dueDate", "<", endDate)
            .orderBy("dueDate")
            .get();

        const tasksForDay = [];
        tasksQuery.forEach(doc => {
            const task = doc.data();
            if (task.status !== 'completed') {
                tasksForDay.push(task);
            }
        });

        if (tasksForDay.length === 0) {
            await replyToTelegram(chatId, `Anh không có công việc nào cho ${dayLabel}.`);
            return res.sendStatus(200);
        }

        let scheduleText = `*Lịch trình của anh ${dayLabel}:*\n\n`;
        tasksForDay.forEach(task => {
            const time = new Date(task.dueDate.toDate()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            scheduleText += `- *${time}*: ${task.text}\n`;
        });
        
        await replyToTelegram(chatId, scheduleText);
        return res.sendStatus(200);
    }

    // Mặc định, trả lời nếu không hiểu lệnh
    await replyToTelegram(chatId, "Em chưa hiểu lệnh này ạ. Anh có thể thử:\n- `/add [nội dung công việc]`\n- `/schedule [today|tomorrow]`");
    return res.sendStatus(200);

  } catch (error) {
    console.error("Lỗi webhook:", error);
    await replyToTelegram(chatId, "Đã có lỗi xảy ra phía máy chủ, em xin lỗi ạ. Vui lòng thử lại sau.");
    return res.status(500).send("Internal Server Error");
  }
});


/**
 * Chạy mỗi 5 phút để kiểm tra các công việc sắp đến hạn và gửi thông báo.
 */
exports.checkDueTasks = functions.pubsub.schedule('every 5 minutes').onRun(async (context) => {
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60 * 1000);

    const tasksToRemindQuery = await db.collection("tasks")
        .where('dueDate', '>', now)
        .where('dueDate', '<=', fifteenMinutesFromNow)
        .where('reminderSent', '==', false)
        .where('status', '!=', 'completed')
        .get();

    if (tasksToRemindQuery.empty) {
        console.log("Không có công việc nào cần nhắc nhở.");
        return null;
    }

    const tasksByChatId = {};
    for (const doc of tasksToRemindQuery.docs) {
        const task = doc.data();
        const userSnapshot = await db.collection('users').doc(task.userId).get();
        const userData = userSnapshot.data();

        if (userData && userData.telegramChatId) {
            if (!tasksByChatId[userData.telegramChatId]) {
                tasksByChatId[userData.telegramChatId] = [];
            }
            tasksByChatId[userData.telegramChatId].push({ id: doc.id, ...task });
        }
    }
    
    const promises = [];
    for (const chatId in tasksByChatId) {
        const userTasks = tasksByChatId[chatId];
        userTasks.forEach(task => {
            const dueDate = task.dueDate.toDate();
            const timeString = dueDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            const message = `🔔 *Nhắc nhở:* Công việc "${task.text}" của anh sắp đến hạn vào lúc *${timeString}*!`;
            
            promises.push(replyToTelegram(chatId, message));
            
            // Đánh dấu đã gửi thông báo để không gửi lại
            promises.push(db.collection('tasks').doc(task.id).update({ reminderSent: true }));
        });
    }

    await Promise.all(promises);
    console.log(`Đã gửi ${promises.length / 2} thông báo.`);
    return null;
});
