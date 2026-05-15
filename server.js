const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL } = require("node:url");
const { execSync } = require("node:child_process");
const { DatabaseSync } = require("node:sqlite");

const BASE_DIR = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(BASE_DIR, "app.db");
const HOST = "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123456";

// 存储公网 URL（由启动脚本或 API 设置）
let publicUrl = "";

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA foreign_keys = ON");

function ensureColumn(tableName, columnName, definition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name);
    if (!columns.includes(columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
    }
}

function nowText() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join("-") + " " + [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join(":");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const passwordHash = crypto.createHash("sha256").update(salt + password, "utf8").digest("hex");
    return { passwordHash, salt };
}

function publicUser(user) {
    if (!user) {
        return null;
    }
    const copy = { ...user };
    delete copy.password_hash;
    delete copy.salt;
    return copy;
}

function initDb() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            real_name TEXT NOT NULL,
            gender TEXT DEFAULT 'male',
            phone TEXT NOT NULL,
            email TEXT DEFAULT '',
            role TEXT DEFAULT 'user',
            status TEXT DEFAULT '正常',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS health_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            report_title TEXT NOT NULL,
            summary TEXT NOT NULL,
            risk_level TEXT DEFAULT '低风险',
            report_date TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS face_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            recognition_time TEXT NOT NULL,
            similarity REAL DEFAULT 0,
            device_name TEXT DEFAULT '',
            result TEXT DEFAULT '识别成功',
            health_status TEXT DEFAULT '正常',
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS health_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            height_cm REAL,
            weight_kg REAL,
            heart_rate INTEGER,
            systolic_bp INTEGER,
            diastolic_bp INTEGER,
            temperature REAL,
            risk_level TEXT DEFAULT '低风险',
            measured_at TEXT NOT NULL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS announcements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            category TEXT DEFAULT '系统公告',
            status TEXT DEFAULT '已发布',
            published_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS carousel_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            subtitle TEXT DEFAULT '',
            image_url TEXT DEFAULT '',
            sort_order INTEGER DEFAULT 0,
            status TEXT DEFAULT '启用'
        );

        CREATE TABLE IF NOT EXISTS app_meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
    `);

    ensureColumn("carousel_items", "link_url", "TEXT DEFAULT ''");
    ensureColumn("carousel_items", "created_at", "TEXT DEFAULT ''");
    ensureColumn("announcements", "is_top", "INTEGER DEFAULT 0");
    ensureColumn("announcements", "views", "INTEGER DEFAULT 0");
    ensureColumn("announcements", "updated_at", "TEXT DEFAULT ''");
    ensureColumn("health_data", "user_name", "TEXT DEFAULT ''");
    ensureColumn("health_data", "blood_oxygen", "INTEGER");
    ensureColumn("health_data", "face_id", "TEXT DEFAULT ''");
    ensureColumn("health_data", "analysis_result", "TEXT DEFAULT ''");
    ensureColumn("health_data", "remarks", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "report_no", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "status", "TEXT DEFAULT '已完成'");
    ensureColumn("health_reports", "heart_rate", "INTEGER");
    ensureColumn("health_reports", "blood_pressure", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "blood_oxygen", "INTEGER");
    ensureColumn("health_reports", "temperature", "REAL");
    ensureColumn("health_reports", "suggestions", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "face_id", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "health_data_id", "TEXT DEFAULT ''");
    ensureColumn("health_reports", "generate_method", "TEXT DEFAULT '自动生成'");
    ensureColumn("health_reports", "updated_at", "TEXT DEFAULT ''");
    ensureColumn("face_records", "user_name", "TEXT DEFAULT ''");
    ensureColumn("face_records", "location", "TEXT DEFAULT ''");
    ensureColumn("face_records", "image_path", "TEXT DEFAULT ''");

    const userCount = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
    if (userCount > 0 && !process.env.RENDER) {
        seedAdminSamples();
        return;
    }

    const insertUser = db.prepare(`
        INSERT INTO users
        (username, password_hash, salt, real_name, gender, phone, email, role, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
        ["zhangsan", "123456", "张三", "male", "13800138001", "zhangsan@example.com", "admin"],
        ["lisi", "123456", "李四", "female", "13900139002", "lisi@example.com", "user"],
        ["wangwu", "123456", "王五", "male", "13700137003", "wangwu@example.com", "user"]
    ].forEach(([username, password, realName, gender, phone, email, role]) => {
        const { passwordHash, salt } = hashPassword(password);
        insertUser.run(username, passwordHash, salt, realName, gender, phone, email, role, nowText(), nowText());
    });

    const insertReport = db.prepare(`
        INSERT INTO health_reports (user_id, report_title, summary, risk_level, report_date)
        VALUES (?, ?, ?, ?, ?)
    `);
    [
        [1, "2026年春季健康评估报告", "心率、血压与体温处于正常区间，建议保持规律作息。", "低风险", "2026-05-01"],
        [1, "运动恢复状态报告", "面部状态稳定，近期疲劳指数略有升高。", "中风险", "2026-05-10"],
        [2, "基础健康筛查报告", "基础指标正常，继续观察睡眠质量。", "低风险", "2026-04-22"]
    ].forEach((item) => insertReport.run(...item));

    const insertFace = db.prepare(`
        INSERT INTO face_records (user_id, recognition_time, similarity, device_name, result, health_status)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    [
        [1, "2026-05-12 08:30:12", 98.7, "前台摄像头A01", "识别成功", "正常"],
        [1, "2026-05-13 08:28:45", 97.9, "前台摄像头A01", "识别成功", "轻度疲劳"],
        [2, "2026-05-13 09:10:33", 96.5, "健康检测终端B02", "识别成功", "正常"]
    ].forEach((item) => insertFace.run(...item));

    const insertHealth = db.prepare(`
        INSERT INTO health_data
        (user_id, height_cm, weight_kg, heart_rate, systolic_bp, diastolic_bp, temperature, risk_level, measured_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    [
        [1, 175, 68.5, 76, 118, 76, 36.5, "低风险", "2026-05-12 08:32:00"],
        [1, 175, 68.8, 82, 123, 80, 36.7, "低风险", "2026-05-13 08:31:00"],
        [2, 162, 54.2, 74, 116, 75, 36.4, "低风险", "2026-05-13 09:12:00"]
    ].forEach((item) => insertHealth.run(...item));

    const insertAnnouncement = db.prepare(`
        INSERT INTO announcements (title, content, category, status, published_at)
        VALUES (?, ?, ?, ?, ?)
    `);
    [
        ["系统数据库已接入", "当前系统已使用 SQLite 数据库存储用户、健康报告与识别记录。", "系统公告", "已发布", "2026-05-14"],
        ["健康检测提醒", "请同学们保持摄像头光线充足，以提高人脸识别准确率。", "健康提醒", "已发布", "2026-05-12"]
    ].forEach((item) => insertAnnouncement.run(...item));

    const insertCarousel = db.prepare(`
        INSERT INTO carousel_items (title, subtitle, image_url, sort_order, status, link_url, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    [
        ["人脸识别健康分析", "融合身份识别与健康数据管理", "https://picsum.photos/seed/carousel1/1920/500", 1, "启用", "用户中心界面.html", "2026-05-14"],
        ["健康报告自动归档", "支持用户报告查询、统计与追踪", "https://picsum.photos/seed/carousel2/1920/500", 2, "启用", "健康报告管理界面.html", "2026-05-14"]
    ].forEach((item) => insertCarousel.run(...item));
    seedAdminSamples();
}

function seedAdminSamples() {
    const seeded = db.prepare("SELECT value FROM app_meta WHERE key = ?").get("admin_seed_v2");
    if (seeded) {
        return;
    }

    db.prepare("UPDATE carousel_items SET created_at = ? WHERE created_at IS NULL OR created_at = ''").run("2026-05-14");
    db.prepare("UPDATE carousel_items SET link_url = ? WHERE link_url IS NULL OR link_url = ''").run("用户中心界面.html");
    db.prepare("UPDATE carousel_items SET image_url = ? WHERE image_url IS NULL OR image_url = ''").run("https://picsum.photos/seed/carousel1/1920/500");

    const carouselCount = db.prepare("SELECT COUNT(*) AS total FROM carousel_items").get().total;
    if (carouselCount < 5) {
        const insertCarousel = db.prepare(`
            INSERT INTO carousel_items (title, subtitle, image_url, sort_order, status, link_url, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        [
            ["AI健康检测 一秒知健康", "非接触式采集，快速生成健康分析结果", "https://picsum.photos/seed/carousel2/1920/500", 2, "启用", "用户中心界面.html", "2026-05-14"],
            ["夏季健康防护指南", "关注体温、心率与日常健康数据变化", "https://picsum.photos/seed/carousel3/1920/500", 3, "禁用", "公告管理界面.html", "2026-05-14"],
            ["系统使用教程", "注册、登录、检测和查看报告的完整流程", "https://picsum.photos/seed/carousel4/1920/500", 4, "启用", "用户注册.html", "2026-05-14"],
            ["新版本功能预告", "管理员端支持数据增删改查和同步展示", "https://picsum.photos/seed/carousel5/1920/500", 5, "禁用", "管理员登录界面.html", "2026-05-14"]
        ].slice(0, 5 - carouselCount).forEach((item) => insertCarousel.run(...item));
    }

    db.prepare("UPDATE announcements SET updated_at = ? WHERE updated_at IS NULL OR updated_at = ''").run(nowText());
    db.prepare("UPDATE health_reports SET report_no = 'HR-' || strftime('%Y%m%d', report_date) || '-' || printf('%04d', id) WHERE report_no IS NULL OR report_no = ''").run();
    db.prepare("UPDATE health_reports SET status = '已完成' WHERE status IS NULL OR status = ''").run();
    db.prepare("UPDATE health_reports SET updated_at = ? WHERE updated_at IS NULL OR updated_at = ''").run(nowText());
    db.prepare("UPDATE face_records SET user_name = (SELECT real_name FROM users WHERE users.id = face_records.user_id) WHERE user_name IS NULL OR user_name = ''").run();
    db.prepare("UPDATE health_data SET user_name = (SELECT real_name FROM users WHERE users.id = health_data.user_id) WHERE user_name IS NULL OR user_name = ''").run();
    db.prepare("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)").run("admin_seed_v2", "1");
}

function sendJson(response, statusCode, payload) {
    const body = Buffer.from(JSON.stringify(payload), "utf8");
    response.writeHead(statusCode, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store"
    });
    response.end(body);
}

function errorJson(response, statusCode, message) {
    sendJson(response, statusCode, { success: false, message });
}

function readBody(request) {
    return new Promise((resolve, reject) => {
        let body = "";
        request.on("data", (chunk) => {
            body += chunk;
            if (body.length > 1024 * 1024) {
                request.destroy();
                reject(new Error("请求体过大"));
            }
        });
        request.on("end", () => {
            if (!body) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new Error("请求数据不是合法 JSON"));
            }
        });
        request.on("error", reject);
    });
}

function parseUserPayload(data, requirePassword) {
    const username = String(data.username || "").trim();
    const password = String(data.password || "").trim();
    const realName = String(data.realName || data.real_name || "").trim();
    const gender = String(data.gender || "male").trim() || "male";
    const phone = String(data.phone || "").trim();
    const email = String(data.email || "").trim();
    const role = String(data.role || "user").trim() || "user";
    const status = String(data.status || "正常").trim() || "正常";

    if (username.length < 3) {
        throw new Error("用户名至少 3 位");
    }
    if (requirePassword && password.length < 6) {
        throw new Error("密码至少 6 位");
    }
    if (!realName) {
        throw new Error("真实姓名不能为空");
    }
    if (!phone) {
        throw new Error("手机号不能为空");
    }

    return { username, password, realName, gender, phone, email, role, status };
}

function createUser(data) {
    const payload = parseUserPayload(data, true);
    const { passwordHash, salt } = hashPassword(payload.password);
    const result = db.prepare(`
        INSERT INTO users
        (username, password_hash, salt, real_name, gender, phone, email, role, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        payload.username,
        passwordHash,
        salt,
        payload.realName,
        payload.gender,
        payload.phone,
        payload.email,
        payload.role,
        payload.status,
        nowText(),
        nowText()
    );
    return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(Number(result.lastInsertRowid)));
}

function updateUser(id, data) {
    const payload = parseUserPayload(data, false);
    let result;
    if (payload.password) {
        const { passwordHash, salt } = hashPassword(payload.password);
        result = db.prepare(`
            UPDATE users
            SET username = ?, real_name = ?, gender = ?, phone = ?, email = ?,
                role = ?, status = ?, updated_at = ?, password_hash = ?, salt = ?
            WHERE id = ?
        `).run(
            payload.username,
            payload.realName,
            payload.gender,
            payload.phone,
            payload.email,
            payload.role,
            payload.status,
            nowText(),
            passwordHash,
            salt,
            id
        );
    } else {
        result = db.prepare(`
            UPDATE users
            SET username = ?, real_name = ?, gender = ?, phone = ?, email = ?,
                role = ?, status = ?, updated_at = ?
            WHERE id = ?
        `).run(
            payload.username,
            payload.realName,
            payload.gender,
            payload.phone,
            payload.email,
            payload.role,
            payload.status,
            nowText(),
            id
        );
    }

    if (result.changes === 0) {
        return null;
    }
    return publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
}

function listUsers() {
    return db.prepare(`
        SELECT
            u.*,
            (SELECT COUNT(*) FROM health_reports r WHERE r.user_id = u.id) AS report_count,
            (SELECT COUNT(*) FROM face_records f WHERE f.user_id = u.id) AS face_count
        FROM users u
        ORDER BY u.id ASC
    `).all().map(publicUser);
}

function normalizeStatus(value, enabledText = "启用", disabledText = "禁用") {
    const text = String(value || enabledText).trim();
    if (text.includes("禁") || text.includes("下架")) {
        return disabledText;
    }
    if (text.includes("草稿")) {
        return "草稿";
    }
    if (text.includes("发布")) {
        return "已发布";
    }
    if (text.includes("完成")) {
        return "已完成";
    }
    if (text.includes("审核")) {
        return "待审核";
    }
    return text;
}

function getById(tableName, id) {
    return db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
}

function deleteById(tableName, id) {
    return db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id).changes;
}

function listCarouselItems() {
    return db.prepare("SELECT * FROM carousel_items ORDER BY sort_order ASC, id ASC").all();
}

function saveCarouselItem(data, id = null) {
    const title = String(data.title || "").trim();
    if (!title) {
        throw new Error("轮播图标题不能为空");
    }
    const subtitle = String(data.subtitle || "").trim();
    const imageUrl = String(data.imageUrl || data.image_url || "").trim() || `https://picsum.photos/seed/carousel${Date.now()}/1920/500`;
    const linkUrl = String(data.linkUrl || data.link_url || "").trim() || "用户中心界面.html";
    const sortOrder = Number(data.sortOrder || data.sort_order || 1);
    const status = normalizeStatus(data.status, "启用", "禁用");
    if (id) {
        db.prepare(`
            UPDATE carousel_items
            SET title = ?, subtitle = ?, image_url = ?, link_url = ?, sort_order = ?, status = ?
            WHERE id = ?
        `).run(title, subtitle, imageUrl, linkUrl, sortOrder, status, id);
        return getById("carousel_items", id);
    }
    const result = db.prepare(`
        INSERT INTO carousel_items (title, subtitle, image_url, link_url, sort_order, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(title, subtitle, imageUrl, linkUrl, sortOrder, status, nowText().slice(0, 10));
    return getById("carousel_items", Number(result.lastInsertRowid));
}

function listAnnouncements() {
    return db.prepare("SELECT * FROM announcements ORDER BY is_top DESC, published_at DESC, id DESC").all();
}

function saveAnnouncement(data, id = null) {
    const title = String(data.title || "").trim();
    const content = String(data.content || "").trim();
    if (!title || !content) {
        throw new Error("公告标题和内容不能为空");
    }
    const category = String(data.category || "系统公告").trim();
    const status = normalizeStatus(data.status || "已发布");
    const publishedAt = String(data.publishedAt || data.published_at || nowText()).trim();
    const isTop = data.isTop || data.is_top ? 1 : 0;
    const views = Number(data.views || 0);
    if (id) {
        db.prepare(`
            UPDATE announcements
            SET title = ?, content = ?, category = ?, status = ?, published_at = ?, is_top = ?, views = ?, updated_at = ?
            WHERE id = ?
        `).run(title, content, category, status, publishedAt, isTop, views, nowText(), id);
        return getById("announcements", id);
    }
    const result = db.prepare(`
        INSERT INTO announcements (title, content, category, status, published_at, is_top, views, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, content, category, status, publishedAt, isTop, views, nowText());
    return getById("announcements", Number(result.lastInsertRowid));
}

function listHealthData() {
    return db.prepare(`
        SELECT h.*, COALESCE(NULLIF(h.user_name, ''), u.real_name, u.username, '未知用户') AS user_name_display
        FROM health_data h
        LEFT JOIN users u ON u.id = h.user_id
        ORDER BY h.measured_at DESC, h.id DESC
    `).all();
}

function saveHealthData(data, id = null) {
    const userId = Number(data.userId || data.user_id || 1);
    const userName = String(data.userName || data.user_name || "").trim();
    const heartRate = Number(data.heartRate || data.heart_rate || 0) || null;
    const systolic = Number(data.systolic || data.systolic_bp || 0) || null;
    const diastolic = Number(data.diastolic || data.diastolic_bp || 0) || null;
    const bloodOxygen = Number(data.bloodOxygen || data.blood_oxygen || 0) || null;
    const temperature = Number(data.temperature || 0) || null;
    const riskLevel = String(data.riskLevel || data.risk_level || data.status || "低风险").trim();
    const faceId = String(data.faceId || data.face_id || "").trim();
    const analysisResult = String(data.analysisResult || data.analysis_result || "").trim();
    const remarks = String(data.remarks || "").trim();
    const measuredAt = String(data.measuredAt || data.measured_at || nowText()).trim();
    if (id) {
        db.prepare(`
            UPDATE health_data
            SET user_id = ?, user_name = ?, heart_rate = ?, systolic_bp = ?, diastolic_bp = ?,
                blood_oxygen = ?, temperature = ?, risk_level = ?, face_id = ?, analysis_result = ?,
                remarks = ?, measured_at = ?
            WHERE id = ?
        `).run(userId, userName, heartRate, systolic, diastolic, bloodOxygen, temperature, riskLevel, faceId, analysisResult, remarks, measuredAt, id);
        return getById("health_data", id);
    }
    const result = db.prepare(`
        INSERT INTO health_data
        (user_id, user_name, heart_rate, systolic_bp, diastolic_bp, blood_oxygen, temperature, risk_level, face_id, analysis_result, remarks, measured_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName, heartRate, systolic, diastolic, bloodOxygen, temperature, riskLevel, faceId, analysisResult, remarks, measuredAt);
    return getById("health_data", Number(result.lastInsertRowid));
}

function listHealthReports() {
    return db.prepare(`
        SELECT r.*, COALESCE(u.real_name, u.username, '未知用户') AS user_name_display
        FROM health_reports r
        LEFT JOIN users u ON u.id = r.user_id
        ORDER BY r.report_date DESC, r.id DESC
    `).all();
}

function saveHealthReport(data, id = null) {
    const userId = Number(data.userId || data.user_id || 1);
    const reportNo = String(data.reportNo || data.report_no || `HR-${Date.now()}`).trim();
    const title = String(data.title || data.report_title || "健康分析报告").trim();
    const summary = String(data.summary || data.analysisResult || data.analysis_result || "暂无分析结果").trim();
    const riskLevel = String(data.riskLevel || data.risk_level || "低风险").trim();
    const status = normalizeStatus(data.status || "已完成");
    const reportDate = String(data.reportDate || data.report_date || nowText().slice(0, 10)).trim();
    const heartRate = Number(data.heartRate || data.heart_rate || 0) || null;
    const bloodPressure = String(data.bloodPressure || data.blood_pressure || "").trim();
    const bloodOxygen = Number(data.bloodOxygen || data.blood_oxygen || 0) || null;
    const temperature = Number(data.temperature || 0) || null;
    const suggestions = String(data.suggestions || "").trim();
    const faceId = String(data.faceId || data.face_id || "").trim();
    const healthDataId = String(data.healthDataId || data.health_data_id || "").trim();
    if (id) {
        db.prepare(`
            UPDATE health_reports
            SET user_id = ?, report_no = ?, report_title = ?, summary = ?, risk_level = ?, status = ?,
                report_date = ?, heart_rate = ?, blood_pressure = ?, blood_oxygen = ?, temperature = ?,
                suggestions = ?, face_id = ?, health_data_id = ?, updated_at = ?
            WHERE id = ?
        `).run(userId, reportNo, title, summary, riskLevel, status, reportDate, heartRate, bloodPressure, bloodOxygen, temperature, suggestions, faceId, healthDataId, nowText(), id);
        return getById("health_reports", id);
    }
    const result = db.prepare(`
        INSERT INTO health_reports
        (user_id, report_no, report_title, summary, risk_level, status, report_date, heart_rate, blood_pressure,
         blood_oxygen, temperature, suggestions, face_id, health_data_id, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, reportNo, title, summary, riskLevel, status, reportDate, heartRate, bloodPressure, bloodOxygen, temperature, suggestions, faceId, healthDataId, nowText());
    return getById("health_reports", Number(result.lastInsertRowid));
}

function listFaceRecords() {
    return db.prepare(`
        SELECT f.*, COALESCE(NULLIF(f.user_name, ''), u.real_name, u.username, '未知用户') AS user_name_display
        FROM face_records f
        LEFT JOIN users u ON u.id = f.user_id
        ORDER BY f.recognition_time DESC, f.id DESC
    `).all();
}

function saveFaceRecord(data, id = null) {
    const userId = Number(data.userId || data.user_id || 1);
    const userName = String(data.userName || data.user_name || "").trim();
    const recognitionTime = String(data.recognitionTime || data.recognition_time || nowText()).trim();
    const similarity = Number(data.similarity || 0);
    const deviceName = String(data.deviceName || data.device_name || "").trim();
    const resultText = String(data.result || "识别成功").trim();
    const healthStatus = String(data.healthStatus || data.health_status || "正常").trim();
    const location = String(data.location || "").trim();
    const imagePath = String(data.imagePath || data.image_path || "").trim();
    if (id) {
        db.prepare(`
            UPDATE face_records
            SET user_id = ?, user_name = ?, recognition_time = ?, similarity = ?, device_name = ?,
                result = ?, health_status = ?, location = ?, image_path = ?
            WHERE id = ?
        `).run(userId, userName, recognitionTime, similarity, deviceName, resultText, healthStatus, location, imagePath, id);
        return getById("face_records", id);
    }
    const insert = db.prepare(`
        INSERT INTO face_records
        (user_id, user_name, recognition_time, similarity, device_name, result, health_status, location, image_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, userName, recognitionTime, similarity, deviceName, resultText, healthStatus, location, imagePath);
    return getById("face_records", Number(insert.lastInsertRowid));
}

function contentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const map = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".svg": "image/svg+xml; charset=utf-8",
        ".ico": "image/x-icon"
    };
    return map[ext] || "application/octet-stream";
}

function serveStatic(request, response, urlPath) {
    const aliases = new Map([
        ["/", "首页管理.html"],
        ["/index.html", "首页管理.html"],
        ["/register.html", "用户注册.html"],
        ["/用户注册.html", "用户注册.html"],
        ["/login.html", "login.html"],
        ["/登录.html", "login.html"],
        ["/admin.html", "管理员登录界面.html"],
        ["/admin-login.html", "管理员登录界面.html"],
        ["/管理员登录界面.html", "管理员登录界面.html"],
        ["/管理端口.html", "管理端口.html"]
    ]);
    const mapped = aliases.get(urlPath) || decodeURIComponent(urlPath).replace(/^\/+/, "");
    const filePath = path.normalize(path.join(BASE_DIR, mapped));

    if (!filePath.startsWith(BASE_DIR)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
    }

    fs.readFile(filePath, (error, data) => {
        if (error) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("页面不存在");
            return;
        }
        response.writeHead(200, {
            "Content-Type": contentType(filePath),
            "Cache-Control": "no-store"
        });
        response.end(data);
    });
}

function getLocalIp() {
    try {
        const interfaces = require("node:os").networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === "IPv4" && !iface.internal) {
                    return iface.address;
                }
            }
        }
    } catch {}
    return "127.0.0.1";
}

async function handleApi(request, response, pathname) {
    try {
        if (request.method === "GET" && pathname === "/api/health") {
            sendJson(response, 200, { success: true, message: "后端服务运行正常", database: DB_PATH });
            return;
        }
        if (request.method === "GET" && pathname === "/api/public-url") {
            sendJson(response, 200, {
                success: true,
                data: {
                    publicUrl: publicUrl || "",
                    localUrl: `http://${getLocalIp()}:${PORT}/`,
                    localhostUrl: `http://127.0.0.1:${PORT}/`,
                    port: PORT
                }
            });
            return;
        }
        if (request.method === "POST" && pathname === "/api/public-url") {
            const body = await readBody(request);
            if (body.url) {
                publicUrl = String(body.url).trim();
            }
            sendJson(response, 200, { success: true, data: { publicUrl } });
            return;
        }
        if (request.method === "GET" && pathname === "/api/users") {
            sendJson(response, 200, { success: true, data: listUsers() });
            return;
        }
        if (request.method === "GET" && /^\/api\/users\/\d+$/.test(pathname)) {
            const id = Number(pathname.split("/").pop());
            const user = publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(id));
            if (!user) {
                errorJson(response, 404, "用户不存在");
                return;
            }
            sendJson(response, 200, { success: true, data: user });
            return;
        }
        if (request.method === "POST" && pathname === "/api/register") {
            const user = createUser(await readBody(request));
            sendJson(response, 201, { success: true, message: "注册成功", user });
            return;
        }
        if (request.method === "POST" && pathname === "/api/users") {
            const user = createUser(await readBody(request));
            sendJson(response, 201, { success: true, message: "用户添加成功", user });
            return;
        }
        if (request.method === "POST" && pathname === "/api/login") {
            const body = await readBody(request);
            const username = String(body.username || "").trim();
            const password = String(body.password || "");
            const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);
            if (!user) {
                errorJson(response, 401, "用户名或密码错误");
                return;
            }
            const { passwordHash } = hashPassword(password, user.salt);
            if (passwordHash !== user.password_hash) {
                errorJson(response, 401, "用户名或密码错误");
                return;
            }
            sendJson(response, 200, {
                success: true,
                message: "登录成功",
                token: crypto.randomBytes(24).toString("base64url"),
                user: publicUser(user)
            });
            return;
        }
        if (request.method === "POST" && pathname === "/api/admin-login") {
            const body = await readBody(request);
            const username = String(body.username || "").trim();
            const password = String(body.password || "");
            if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
                errorJson(response, 401, "管理员账号或密码错误");
                return;
            }
            sendJson(response, 200, {
                success: true,
                message: "管理员登录成功",
                token: crypto.randomBytes(24).toString("base64url"),
                admin: {
                    username: ADMIN_USERNAME,
                    realName: "系统管理员",
                    role: "admin"
                }
            });
            return;
        }
        if (request.method === "PUT" && /^\/api\/users\/\d+$/.test(pathname)) {
            const id = Number(pathname.split("/").pop());
            const user = updateUser(id, await readBody(request));
            if (!user) {
                errorJson(response, 404, "用户不存在");
                return;
            }
            sendJson(response, 200, { success: true, message: "用户信息已更新", user });
            return;
        }
        if (request.method === "DELETE" && /^\/api\/users\/\d+$/.test(pathname)) {
            const id = Number(pathname.split("/").pop());
            const result = db.prepare("DELETE FROM users WHERE id = ?").run(id);
            if (result.changes === 0) {
                errorJson(response, 404, "用户不存在");
                return;
            }
            sendJson(response, 200, { success: true, message: "用户已删除" });
            return;
        }
        if (request.method === "POST" && pathname === "/api/change-password") {
            const body = await readBody(request);
            const userId = Number(body.userId || 0);
            const oldPassword = String(body.oldPassword || "");
            const newPassword = String(body.newPassword || "");
            if (newPassword.length < 6) {
                errorJson(response, 400, "新密码至少 6 位");
                return;
            }
            const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
            if (!user) {
                errorJson(response, 404, "用户不存在");
                return;
            }
            const oldHash = hashPassword(oldPassword, user.salt).passwordHash;
            if (oldHash !== user.password_hash) {
                errorJson(response, 401, "原密码不正确");
                return;
            }
            const { passwordHash, salt } = hashPassword(newPassword);
            db.prepare("UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?")
                .run(passwordHash, salt, nowText(), userId);
            sendJson(response, 200, { success: true, message: "密码修改成功" });
            return;
        }
        if (request.method === "GET" && pathname === "/api/stats") {
            sendJson(response, 200, {
                success: true,
                data: {
                    users: db.prepare("SELECT COUNT(*) AS total FROM users").get().total,
                    reports: db.prepare("SELECT COUNT(*) AS total FROM health_reports").get().total,
                    faceRecords: db.prepare("SELECT COUNT(*) AS total FROM face_records").get().total,
                    healthData: db.prepare("SELECT COUNT(*) AS total FROM health_data").get().total
                }
            });
            return;
        }

        const adminResources = {
            carousel: {
                table: "carousel_items",
                list: listCarouselItems,
                save: saveCarouselItem
            },
            announcements: {
                table: "announcements",
                list: listAnnouncements,
                save: saveAnnouncement
            },
            "health-data": {
                table: "health_data",
                list: listHealthData,
                save: saveHealthData
            },
            "health-reports": {
                table: "health_reports",
                list: listHealthReports,
                save: saveHealthReport
            },
            "face-records": {
                table: "face_records",
                list: listFaceRecords,
                save: saveFaceRecord
            }
        };

        for (const [resourceName, config] of Object.entries(adminResources)) {
            const basePath = `/api/${resourceName}`;
            const itemPattern = new RegExp(`^\\/api\\/${resourceName}\\/(\\d+)$`);
            const match = pathname.match(itemPattern);

            if (request.method === "GET" && pathname === basePath) {
                sendJson(response, 200, { success: true, data: config.list() });
                return;
            }
            if (request.method === "GET" && match) {
                const item = getById(config.table, Number(match[1]));
                if (!item) {
                    errorJson(response, 404, "记录不存在");
                    return;
                }
                sendJson(response, 200, { success: true, data: item });
                return;
            }
            if (request.method === "POST" && pathname === basePath) {
                const item = config.save(await readBody(request));
                sendJson(response, 201, { success: true, message: "添加成功", data: item });
                return;
            }
            if (request.method === "PUT" && match) {
                const item = config.save(await readBody(request), Number(match[1]));
                if (!item) {
                    errorJson(response, 404, "记录不存在");
                    return;
                }
                sendJson(response, 200, { success: true, message: "保存成功", data: item });
                return;
            }
            if (request.method === "DELETE" && match) {
                const changes = deleteById(config.table, Number(match[1]));
                if (!changes) {
                    errorJson(response, 404, "记录不存在");
                    return;
                }
                sendJson(response, 200, { success: true, message: "删除成功" });
                return;
            }
            if (request.method === "POST" && pathname === `${basePath}/batch-delete`) {
                const body = await readBody(request);
                const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
                const statement = db.prepare(`DELETE FROM ${config.table} WHERE id = ?`);
                ids.forEach((id) => statement.run(id));
                sendJson(response, 200, { success: true, message: "批量删除成功", deleted: ids.length });
                return;
            }
            if (request.method === "POST" && pathname === `${basePath}/batch-status`) {
                const body = await readBody(request);
                const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
                const status = normalizeStatus(body.status || "启用", "启用", "禁用");
                const statement = db.prepare(`UPDATE ${config.table} SET status = ? WHERE id = ?`);
                ids.forEach((id) => statement.run(status, id));
                sendJson(response, 200, { success: true, message: "状态更新成功", updated: ids.length });
                return;
            }
        }

        const tableMap = {
            "/api/announcements": "announcements",
            "/api/health-reports": "health_reports",
            "/api/face-records": "face_records",
            "/api/health-data": "health_data",
            "/api/carousel": "carousel_items"
        };
        if (request.method === "GET" && tableMap[pathname]) {
            const rows = db.prepare(`SELECT * FROM ${tableMap[pathname]} ORDER BY id DESC`).all();
            sendJson(response, 200, { success: true, data: rows });
            return;
        }

        errorJson(response, 404, "接口不存在");
    } catch (error) {
        const message = String(error.message || error);
        if (message.includes("UNIQUE")) {
            errorJson(response, 409, "用户名已存在，请换一个用户名");
            return;
        }
        errorJson(response, 400, message);
    }
}

initDb();

const server = http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/api/")) {
        handleApi(request, response, pathname);
        return;
    }
    serveStatic(request, response, pathname);
});

server.listen(PORT, HOST, () => {
    console.log(`服务已启动：http://${HOST}:${PORT}/`);
    console.log(`数据库文件：${DB_PATH}`);
    console.log("测试账号：zhangsan / 123456");
});
