
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


// --- ĐỊNH NGHĨA CÁC MENU KEYBOARD ---

const MAIN_MENU_KEYBOARD = {
  inline_keyboard: [
    [{ text: "➕ Thêm công việc", callback_data: "add_task_prompt" }],
    [{ text: "📋 Xem danh sách công việc", callback_data: "list_tasks_menu" }],
    [{ text: "📅 Xem lịch trình", callback_data: "schedule_menu" }],
    [{ text: "💡 Trợ giúp", callback_data: "show_help" }],
  ],
};

const LIST_MENU_KEYBOARD = {
  inline_keyboard: [
    [
        { text: "⚪️ Cần làm", callback_data: "list_todo" },
        { text: "🔵 Đang làm", callback_data: "list_inprogress" },
    ],
    [
        { text: "🔥 Khẩn cấp", callback_data: "list_urgent" },
        { text: "✅ Đã xong", callback_data: "list_completed" },
    ],
    [{ text: "⬅️ Quay lại Menu chính", callback_data: "main_menu" }],
  ],
};

const SCHEDULE_MENU_KEYBOARD = {
    inline_keyboard: [
        [
            { text: "Hôm nay", callback_data: "schedule_today" },
            { text: "Ngày mai", callback_data: "schedule_tomorrow" },
        ],
        [{ text: "⬅️ Quay lại Menu chính", callback_data: "main_menu" }],
    ],
};


// --- CÁC HÀM TRỢ GIÚP API TELEGRAM ---

async function sendTelegramRequest(endpoint, body) {
    const url = `${TELEGRAM_API_URL}/${endpoint}`;
    return fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function replyToTelegram(chatId, text, replyMarkup = null) {
  return sendTelegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...(replyMarkup && { reply_markup: replyMarkup }),
  });
}

async function editTelegramMessage(chatId, messageId, text, replyMarkup = null) {
    return sendTelegramRequest("editMessageText", {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'Markdown',
        ...(replyMarkup && { reply_markup: replyMarkup }),
    });
}

async function answerCallbackQuery(callbackQueryId) {
    return sendTelegramRequest("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
    });
}


async function setTelegramMenu() {
    const commands = [
        { command: 'start', description: 'Bắt đầu và hiển thị menu chính' },
        { command: 'menu', description: 'Hiển thị menu chính' },
        { command: 'add', description: 'Thêm công việc mới (vd: /add Họp team 9h mai)' },
        { command: 'list', description: 'Liệt kê công việc (vd: /list urgent)' },
        { command: 'schedule', description: 'Xem lịch trình hôm nay/ngày mai' },
        { command: 'help', description: 'Xem hướng dẫn các lệnh' }
    ];
    try {
        await sendTelegramRequest("setMyCommands", { commands });
    } catch (error) {
        console.error("Failed to set Telegram menu:", error);
    }
}


// --- CÁC HÀM LOGIC CỦA BOT ---

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

async function handleGetSchedule(chatId, userId, day) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    let startDate = today;
    let endDate = tomorrow;
    let dayLabel = "hôm nay";

    if (day === "tomorrow") {
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
        return;
    }

    let scheduleText = `*Lịch trình của anh ${dayLabel}:*\n\n`;
    tasksForDay.forEach(task => {
        const time = new Date(task.dueDate.toDate()).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
        scheduleText += `- *${time}*: ${task.text}\n`;
    });
    
    await replyToTelegram(chatId, scheduleText);
}


async function handleListTasks(chatId, userId, filter) {
    let tasksQuery;
    let title = "Danh sách công việc của anh";
    let tasks = [];

    switch(filter) {
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

    if (filter === 'urgent') {
        tasks = tasks.filter(task => task.status !== 'completed');
    }

    await replyToTelegram(chatId, formatTaskList(tasks, title));
}

function getHelpText() {
    return `*Các lệnh có sẵn:*\n\n` +
           `*/menu* - Hiển thị menu chính để thao tác bằng nút bấm.\n\n` +
           `*/add [nội dung]* - Thêm nhanh công việc. AI sẽ tự phân tích ngày giờ, tags.\n` +
           `*Ví dụ:* \`/add Họp team marketing 9h sáng mai #họp\`\n\n` +
           `*/list [bộ lọc]* - Liệt kê công việc.\n` +
           `*Bộ lọc:* \`all\`, \`todo\`, \`inprogress\`, \`completed\`, \`urgent\`\n` +
           `*Ví dụ:* \`/list urgent\`\n\n` +
           `*/schedule [khi nào]* - Xem lịch trình.\n` +
           `*Khi nào:* \`today\` (mặc định), \`tomorrow\`\n` +
           `*Ví dụ:* \`/schedule tomorrow\``;
}


// --- HÀM XỬ LÝ CHÍNH CỦA VERCEL ---
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const update = req.body;

    // Xử lý Callback Query (bấm nút)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
      return res.status(200).send("OK");
    }
    
    // Xử lý tin nhắn văn bản
    if (update.message && update.message.text) {
      await handleTextMessage(update.message);
      return res.status(200).send("OK");
    }

    return res.status(200).send("OK"); // Bỏ qua các loại update khác

  } catch (error) {
    console.error("Lỗi webhook:", error);
    // Tránh gửi lỗi cho người dùng cuối nếu không cần thiết
    return res.status(500).send("Internal Server Error");
  }
}

// --- BỘ ĐIỀU HƯỚNG CHO CÁC HÀNH ĐỘNG ---

async function handleTextMessage(message) {
  const chatId = message.chat.id;
  const text = message.text;

  if (text.startsWith("/start ")) {
    const userId = text.split(" ")[1];
    if (!userId) {
      await replyToTelegram(chatId, "Lỗi: Lệnh kết nối không hợp lệ. Vui lòng sao chép chính xác lệnh từ ứng dụng PTODO.");
      return;
    }
    const userDocRef = db.collection("users").doc(userId);
    await userDocRef.update({
      telegramChatId: chatId,
      telegramUsername: message.chat.username || "",
    });
    await setTelegramMenu();
    await replyToTelegram(chatId, "🎉 Kết nối thành công! Em đã sẵn sàng nhận lệnh từ anh.", MAIN_MENU_KEYBOARD);
    return;
  }

  const usersQuery = await db.collection("users").where("telegramChatId", "==", chatId).limit(1).get();
  if (usersQuery.empty) {
    await replyToTelegram(chatId, "Tài khoản Telegram này chưa được kết nối. Vui lòng vào Cài đặt trong ứng dụng PTODO để lấy lệnh kết nối.");
    return;
  }
  const userId = usersQuery.docs[0].id;

  if (text.startsWith("/start") || text.startsWith("/menu")) {
    await replyToTelegram(chatId, "Chào anh, em có thể giúp gì ạ?", MAIN_MENU_KEYBOARD);
    return;
  }

  if (text.startsWith("/add ")) {
    const taskText = text.substring(5).trim();
    if (!taskText) {
      await replyToTelegram(chatId, "Vui lòng nhập nội dung công việc. Ví dụ: `/add Đi siêu thị mua sữa`");
      return;
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
    return;
  }

  if (text.startsWith("/schedule")) {
    const day = text.includes("tomorrow") ? "tomorrow" : "today";
    await handleGetSchedule(chatId, userId, day);
    return;
  }

  if (text.startsWith("/list")) {
    const filter = text.split(" ")[1] || 'all';
    await handleListTasks(chatId, userId, filter);
    return;
  }
  
  if (text === "/help") {
    await replyToTelegram(chatId, getHelpText());
    return;
  }

  await replyToTelegram(chatId, "Em chưa hiểu lệnh này ạ. Anh có thể dùng /menu hoặc /help để xem các lệnh có sẵn.");
}


async function handleCallbackQuery(callbackQuery) {
  const { id: callbackQueryId, message, data } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  // Luôn trả lời callback query để tắt trạng thái loading trên nút bấm
  await answerCallbackQuery(callbackQueryId);

  const usersQuery = await db.collection("users").where("telegramChatId", "==", chatId).limit(1).get();
  if (usersQuery.empty) {
    await replyToTelegram(chatId, "Tài khoản của anh đã bị ngắt kết nối. Vui lòng kết nối lại từ ứng dụng.");
    return;
  }
  const userId = usersQuery.docs[0].id;

  switch (data) {
    case 'main_menu':
      await editTelegramMessage(chatId, messageId, "Chào anh, em có thể giúp gì ạ?", MAIN_MENU_KEYBOARD);
      break;
    case 'add_task_prompt':
      await replyToTelegram(chatId, "Dạ, anh vui lòng nhập nội dung công việc bắt đầu bằng lệnh `/add`.\n*Ví dụ:* `/add Gặp khách hàng lúc 2h chiều mai #họp`");
      break;
    case 'list_tasks_menu':
      await editTelegramMessage(chatId, messageId, "Anh muốn xem danh sách công việc nào ạ?", LIST_MENU_KEYBOARD);
      break;
    case 'schedule_menu':
        await editTelegramMessage(chatId, messageId, "Anh muốn xem lịch trình cho ngày nào?", SCHEDULE_MENU_KEYBOARD);
        break;
    case 'show_help':
      await replyToTelegram(chatId, getHelpText());
      break;
    case 'schedule_today':
        await handleGetSchedule(chatId, userId, "today");
        break;
    case 'schedule_tomorrow':
        await handleGetSchedule(chatId, userId, "tomorrow");
        break;
    case 'list_todo':
    case 'list_inprogress':
    case 'list_completed':
    case 'list_urgent':
    case 'list_all':
        const filter = data.split('_')[1];
        await handleListTasks(chatId, userId, filter);
        break;
    default:
      break;
  }
}
