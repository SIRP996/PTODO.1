/**
 * ======================================================================================
 * MÃ NGUỒN CHO FIREBASE CLOUD FUNCTIONS (BACKEND CỦA ỨNG DỤNG)
 * ======================================================================================
 *
 * Quan trọng: Đây là "bộ não" chạy trên máy chủ của Google, không phải trên trình duyệt.
 * Nó xử lý các tác vụ yêu cầu bảo mật cao hoặc cần chạy tự động.
 *
 * Hướng dẫn triển khai chi tiết đã được cung cấp. Tóm tắt:
 * 1. Khởi tạo Firebase Functions trong dự án của bạn: `firebase init functions`
 * 2. `cd functions` và chạy `npm install` để cài đặt các gói cần thiết (xem file package.json).
 * 3. Cấu hình các biến môi trường BÍ MẬT: `firebase functions:config:set ...`
 * 4. Triển khai lên máy chủ: `firebase deploy --only functions`
 */

// --- KHU VỰC 1: KHỞI TẠO VÀ CẤU HÌNH CÁC DỊCH VỤ ---

// Các "thư viện" cần thiết để chạy backend
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");
const { GoogleGenAI, Type } = require("@google/genai");
const nodemailer = require("nodemailer");

// Kết nối với cơ sở dữ liệu và các dịch vụ Firebase