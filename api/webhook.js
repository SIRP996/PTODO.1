
import admin from "firebase-admin";
import fetch from "node-fetch";
import { GoogleGenAI, Type } from "@google/genai";

// --- CẤU HÌNH BIẾN MÔI TRƯỜNG (Sẽ lấy từ Vercel) ---
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIREBASE_SERVICE_ACCOUNT = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

// --- KHỞI TẠO CÁC DỊCH VỤ (Chỉ một lần để tối ưu) ---
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(FIREBASE_SERVICE_ACCOUNT),
  });
}
const db = admin.firestore();
const genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

// --- CÁC HÀM TRỢ GIÚP ---

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

async function setTelegramMenu() {
    const commands = [
        { command: 'add', description: 'Thêm công việc mới (vd: /add Họp team 9h mai)' },
        { command: 'list', description: 'Liệt kê công việc (vd: /list urgent)' },
        { command: 'schedule', description: 'Xem lịch trình hôm nay/ngày mai (vd: /schedule tomorrow)' },
        { command: 'help', description: 'Xem hướng dẫn các lệnh' }
    ];
    const url = `${TELEGRAM_API_URL}/setMyCommands`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ commands }),
        });
    } catch (error) {
        console.error("Failed to set Telegram menu:", error);
    }
}


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

function formatTaskList(tasks, title) {
  if (tasks.length === 0) {
    return `Anh không có công việc nào trong danh sách này.`;
  }
  let responseText = `*${title}*\n\n`;
  tasks.forEach(task => {
    let icon = '⚪️'; // todo
    if (task.status === 'inprogress') icon = '🔵';
    if (task.status === 'completed') icon = '✅';
    const urgentIcon = task.isUrgent && task.status !== 'completed' ? '🔥 ' : '';
    responseText += `${icon} ${urgentIcon}${task.text}\n`;
  });
  return responseText;
}

// --- HÀM XỬ LÝ CHÍNH CỦA VERCEL ---
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const update = req.body;
  const message = update.message;

  if (!message || !message.text) {
    return res.status(200).send("OK");
  }

  const chatId = message.chat.id;
  const text = message.text;

  try {
    if (text.startsWith("/start ")) {
      const userId = text.split(" ")[1];
      if (!userId) {
        await replyToTelegram(chatId, "Lỗi: Lệnh kết nối không hợp lệ. Vui lòng sao chép chính xác lệnh từ ứng dụng PTODO.");
        return res.status(200).send("OK");
      }

      const userDocRef = db.collection("users").doc(userId);
      await userDocRef.update({
        telegramChatId: chatId,
        telegramUsername: message.chat.username || "",
      });
      
      await setTelegramMenu(); // Set the menu for the user
      
      await replyToTelegram(chatId, "🎉 Kết nối thành công! Bây giờ anh có thể quản lý công việc PTODO ngay tại đây.\n\nBấm vào nút `/` để xem các lệnh có sẵn hoặc dùng lệnh /help.");
      return res.status(200).send("OK");
    }
    
    const usersQuery = await db.collection("users").where("telegramChatId", "==", chatId).limit(1).get();
    if (usersQuery.empty) {
      await replyToTelegram(chatId, "Tài khoản Telegram này chưa được kết nối. Vui lòng vào Cài đặt trong ứng dụng PTODO để lấy lệnh kết nối.");
      return res.status(200).send("OK");
    }
    const userId = usersQuery.docs[0].id;

    if (text.startsWith("/add ")) {
      const taskText = text.substring(5).trim();
      if (!taskText) {
          await replyToTelegram(chatId, "Vui lòng nhập nội dung công việc. Ví dụ: `/add Đi siêu thị mua sữa`");
          return res.status(200).send("OK");
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
      return res.status(200).send("OK");
    }

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
            return res.status(200).send("OK");
        }

        let scheduleText = `*Lịch trình của anh ${dayLabel}:*\n\n`;
        tasksForDay.forEach(task => {
            const time = new Date(task.dueDate.toDate()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
            scheduleText += `- *${time}*: ${task.text}\n`;
        });
        
        await replyToTelegram(chatId, scheduleText);
        return res.status(200).send("OK");
    }

    if (text.startsWith("/list")) {
        const args = text.split(" ")[1] || 'all';
        let tasksQuery;
        let title = "Danh sách công việc của anh";
        let tasks = [];

        switch(args) {
            case 'todo':
                title = "Danh sách việc cần làm";
                tasksQuery = db.collection("tasks").where("userId", "==", userId).where("status", "==", "todo").orderBy("createdAt", "desc");
                break;
            case 'inprogress':
                title = "Danh sách việc đang làm";
                tasksQuery = db.collection("tasks").where("userId", "==", userId).where("status", "==", "inprogress").orderBy("createdAt", "desc");
                break;
            case 'completed':
                title = "5 công việc hoàn thành gần nhất";
                tasksQuery = db.collection("tasks").where("userId", "==", userId).where("status", "==", "completed").orderBy("createdAt", "desc").limit(5);
                break;
            case 'urgent':
                title = "Danh sách việc khẩn cấp";
                tasksQuery = db.collection("tasks").where("userId", "==", userId).where("isUrgent", "==", true).orderBy("createdAt", "desc");
                break;
            case 'all':
            default:
                title = "Tất cả công việc chưa hoàn thành";
                tasksQuery = db.collection("tasks").where("userId", "==", userId).where("status", "in", ["todo", "inprogress"]).orderBy("createdAt", "desc");
                break;
        }

        const querySnapshot = await tasksQuery.get();
        querySnapshot.forEach(doc => tasks.push(doc.data()));

        if (args === 'urgent') {
            tasks = tasks.filter(task => task.status !== 'completed');
        }

        await replyToTelegram(chatId, formatTaskList(tasks, title));
        return res.status(200).send("OK");
    }
    
    if (text === "/help") {
        const helpText = `*Các lệnh có sẵn:*\n\n` +
                         `\`/add [nội dung]\` - Thêm công việc mới. AI sẽ tự phân tích ngày giờ, tags.\n` +
                         `*Ví dụ:* \`/add Họp team marketing 9h sáng mai #họp\`\n\n` +
                         `\`/list [bộ lọc]\` - Liệt kê công việc.\n` +
                         `*Bộ lọc:* \`all\`, \`todo\`, \`inprogress\`, \`completed\`, \`urgent\`\n` +
                         `*Ví dụ:* \`/list urgent\`\n\n` +
                         `\`/schedule [khi nào]\` - Xem lịch trình.\n` +
                         `*Khi nào:* \`today\` (mặc định), \`tomorrow\`\n` +
                         `*Ví dụ:* \`/schedule tomorrow\`\n\n` +
                         `\`/help\` - Hiển thị tin nhắn này.`;
        await replyToTelegram(chatId, helpText);
        return res.status(200).send("OK");
    }


    await replyToTelegram(chatId, "Em chưa hiểu lệnh này ạ. Anh có thể dùng /help để xem danh sách các lệnh.");
    return res.status(200).send("OK");

  } catch (error) {
    console.error("Lỗi webhook:", error);
    await replyToTelegram(chatId, "Đã có lỗi xảy ra phía máy chủ, em xin lỗi ạ.");
    return res.status(500).send("Internal Server Error");
  }
}
