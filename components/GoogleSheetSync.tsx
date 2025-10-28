
import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { Sheet, X, Save, CheckCircle, AlertTriangle, HelpCircle, Copy, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface GoogleSheetSyncProps {
    tasks: Task[];
}

const SCRIPT_CODE = `function doPost(e) {
  try {
    // Data is sent via FormData, so we access it from e.parameter
    var tasks = JSON.parse(e.parameter.payload);

    // Make sure to create a sheet named "PTODO"
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("PTODO");
    if (!sheet) {
      sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet("PTODO");
    }

    // Clear the entire sheet to perform a full re-sync
    sheet.clear();

    // Set headers for the columns
    var headers = ["ID", "Task Content", "Status", "Created At", "Due Date", "Tags", "Urgent"];
    sheet.appendRow(headers);
    sheet.getRange("A1:G1").setFontWeight("bold");

    if (tasks.length === 0) {
       return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "No tasks to sync. Sheet cleared." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Prepare all task data to be written in a single operation
    var rows = tasks.map(function(task) {
      var statusText;
      switch(task.status) {
        case 'completed': statusText = 'Completed'; break;
        case 'inprogress': statusText = 'In Progress'; break;
        default: statusText = 'Pending';
      }
      return [
        task.id,
        task.text,
        statusText,
        task.createdAt ? new Date(task.createdAt) : null,
        task.dueDate ? new Date(task.dueDate) : null,
        task.hashtags.join(", "),
        task.isUrgent ? "Yes" : "No"
      ];
    });

    // Write all rows at once for better performance
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    
    // Auto-resize columns to fit content
    for (var i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }

    return ContentService.createTextOutput(JSON.stringify({ "status": "success", "message": "Tasks synced successfully." }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "status": "error", "message": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

const GoogleSheetSync: React.FC<GoogleSheetSyncProps> = ({ tasks }) => {
    const { userSettings, updateUserSettings } = useAuth();
    const { addToast } = useToast();
    const [sheetUrl, setSheetUrl] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (userSettings?.googleSheetUrl) {
            setSheetUrl(userSettings.googleSheetUrl);
        } else {
            setSheetUrl('');
        }
    }, [userSettings]);

    const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newUrl = e.target.value;
        setSheetUrl(newUrl);
        if (updateUserSettings) {
            updateUserSettings({ googleSheetUrl: newUrl });
        }
    };
    
    const copyToClipboard = () => {
        navigator.clipboard.writeText(SCRIPT_CODE);
        addToast("Đã sao chép mã vào clipboard!", 'info');
    };

    const handleSync = async () => {
        if (!sheetUrl.trim()) {
            addToast('Vui lòng nhập URL Web App của bạn trước.', 'error');
            return;
        }

        setIsLoading(true);

        try {
            const formData = new FormData();
            formData.append('payload', JSON.stringify(tasks));

            const response = await fetch(sheetUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
               throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.status === 'success') {
                addToast('Đồng bộ thành công!', 'success');
            } else {
                throw new Error(result.message || 'Lỗi không xác định từ script.');
            }

        } catch (error) {
            addToast(`Lỗi đồng bộ. Hãy kiểm tra lại URL, đảm bảo bạn đã triển khai script với quyền truy cập "Anyone", và thử lại.`, 'error');
            console.error("Sync Error:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    return (
        <div>
            <h2 className="text-xl font-semibold mb-4 text-slate-100 flex items-center gap-2">
                <Sheet className="text-indigo-400" />
                Đồng bộ với Google Sheets
            </h2>

            <div className="space-y-4">
                <div>
                    <label htmlFor="sheet-url" className="block text-sm font-medium text-slate-400 mb-1">URL Web App</label>
                    <input
                        id="sheet-url"
                        type="url"
                        value={sheetUrl}
                        onChange={handleUrlChange}
                        placeholder="Dán URL Web App của bạn ở đây"
                        className="w-full bg-[#293548] text-slate-200 border border-indigo-600 focus:border-indigo-500 focus:ring-0 rounded-lg px-4 py-2 transition"
                    />
                </div>
                 <div className="flex justify-between items-center gap-2">
                    <button
                        onClick={handleSync}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center font-semibold py-2 px-4 rounded-lg transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-slate-600 disabled:text-slate-400 disabled:cursor-wait"
                    >
                        {isLoading ? (
                            <><Loader2 size={20} className="mr-2 animate-spin"/><span>Đang lưu...</span></>
                        ) : (
                            <><Save size={20} className="mr-2"/><span>Lưu vào Google Sheets</span></>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg"
                        title="Hướng dẫn cài đặt"
                    >
                        <HelpCircle size={20} />
                    </button>
                 </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
                    <div className="bg-[#1E293B] max-w-2xl w-full rounded-2xl shadow-2xl p-6 border border-slate-700 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white">Hướng dẫn cài đặt Google Sheets</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white"><X /></button>
                        </div>
                        <div className="text-slate-300 space-y-4 text-sm">
                            <p>Để đồng bộ dữ liệu một cách an toàn, bạn cần tạo một Web App riêng trên Google Apps Script được liên kết với một Google Sheet.</p>
                            <ol className="list-decimal list-inside space-y-2 pl-2">
                                <li>Tạo một Google Sheet mới (bạn có thể truy cập <a href="https://sheets.new" target="_blank" rel="noopener noreferrer" className="text-indigo-400 underline">sheets.new</a>).</li>
                                <li>Trong trang tính, đi tới <b className="text-white">Tiện ích mở rộng</b> (Extensions) &gt; <b className="text-white">Apps Script</b>.</li>
                                <li>Xóa mã mặc định và dán mã bên dưới vào trình soạn thảo.</li>
                                <li>Nhấn vào nút <b className="text-white">Triển khai</b> (Deploy) &gt; <b className="text-white">Lần triển khai mới</b> (New deployment).</li>
                                <li>Nhấp vào biểu tượng bánh răng (⚙️) bên cạnh "Chọn loại" và chọn <b className="text-white">Ứng dụng web</b> (Web app).</li>
                                <li>Trong phần "Ai có quyền truy cập" (Who has access), chọn <b className="text-white">Bất kỳ ai</b> (Anyone).</li>
                                <li>Nhấn <b className="text-white">Triển khai</b> (Deploy) và cấp quyền cho script khi được yêu cầu.</li>
                                <li>Sao chép <b className="text-white">URL ứng dụng web</b> được cung cấp và dán vào ô nhập bên trên.</li>
                            </ol>
                            <div className="relative bg-slate-900 rounded-lg p-4 font-mono text-xs">
                                <button onClick={copyToClipboard} className="absolute top-2 right-2 p-1.5 bg-slate-700 hover:bg-slate-600 rounded-md" title="Sao chép mã"><Copy size={14} /></button>
                                <pre><code>{SCRIPT_CODE}</code></pre>
                            </div>
                            <p className="text-xs text-slate-500">Lưu ý: Lần đầu tiên chạy, script sẽ tự động tạo một sheet mới có tên là "PTODO" trong trang tính của bạn.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GoogleSheetSync;