<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Phản hồi yêu cầu hỗ trợ</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; background:#f6f8fb; padding:24px; color:#1f2937;">
    <div style="max-width: 720px; margin: 0 auto; background:#ffffff; border-radius:16px; padding:32px; border:1px solid #e5e7eb;">
        <h1 style="margin-top:0; color:#111827;">JDM World đã phản hồi yêu cầu hỗ trợ của bạn</h1>

        <p>Xin chào <strong>{{ $ticket->name }}</strong>,</p>
        <p>Chúng tôi đã nhận được yêu cầu hỗ trợ của bạn và gửi phản hồi như sau:</p>

        <div style="margin:24px 0; padding:20px; border-radius:12px; background:#f9fafb; border-left:4px solid #6366f1;">
            <h3 style="margin-top:0;">Thông tin yêu cầu gốc</h3>
            <p><strong>Chủ đề:</strong> {{ $ticket->subject }}</p>
            <p style="margin-bottom:0;"><strong>Nội dung:</strong><br>{{ $ticket->message }}</p>
        </div>

        <div style="margin:24px 0; padding:20px; border-radius:12px; background:#eff6ff; border-left:4px solid #2563eb;">
            <h3 style="margin-top:0;">Phản hồi từ đội ngũ hỗ trợ</h3>
            <p style="white-space: pre-line; margin-bottom:0;">{{ $replyMessage }}</p>
        </div>

        <p>Nếu bạn cần hỗ trợ thêm, vui lòng trả lời email này hoặc gửi thêm yêu cầu mới qua website JDM World.</p>

        <p style="margin-top:32px;">Trân trọng,<br><strong>Đội ngũ hỗ trợ JDM World</strong></p>
    </div>
</body>
</html>