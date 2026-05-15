const crypto = require("node:crypto");

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123456";
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const jsonHeaders = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS"
};

function send(statusCode, payload) {
    return {
        statusCode,
        headers: jsonHeaders,
        body: JSON.stringify(payload)
    };
}

function fail(statusCode, message) {
    return send(statusCode, { success: false, message });
}

function nowText() {
    const now = new Date();
    const pad = (value) => String(value).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function todayText() {
    return nowText().slice(0, 10);
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

function bodyFromEvent(event) {
    if (!event.body) {
        return {};
    }
    const text = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    try {
        return JSON.parse(text);
    } catch {
        const error = new Error("请求数据不是合法 JSON");
        error.statusCode = 400;
        throw error;
    }
}

function normalizePath(event) {
    let pathname = decodeURIComponent(event.path || "/api");
    const marker = "/.netlify/functions/api";
    if (pathname.startsWith(marker)) {
        pathname = `/api${pathname.slice(marker.length)}`;
    }
    if (!pathname.startsWith("/api")) {
        pathname = `/api${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
    }
    return pathname.replace(/\/+$/, "") || "/api";
}

function ensureSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const error = new Error("Netlify 环境变量未配置：请设置 SUPABASE_URL 和 SUPABASE_SECRET_KEY（或 SUPABASE_SERVICE_ROLE_KEY）");
        error.statusCode = 500;
        throw error;
    }
}

async function rest(endpoint, options = {}) {
    ensureSupabase();
    const headers = {
        apikey: SUPABASE_KEY,
        "Content-Type": "application/json",
        ...(options.prefer ? { Prefer: options.prefer } : {}),
        ...(options.headers || {})
    };
    if (!SUPABASE_KEY.startsWith("sb_secret_")) {
        headers.Authorization = `Bearer ${SUPABASE_KEY}`;
    }

    const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, {
        method: options.method || "GET",
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok) {
        const message = data?.message || data?.error || text || "Supabase 请求失败";
        const error = new Error(message.includes("relation") ? "Supabase 数据表不存在，请先执行 supabase/schema.sql 建表脚本" : message);
        error.statusCode = response.status;
        error.code = data?.code;
        throw error;
    }
    return data;
}

function idFilter(id) {
    return `id=eq.${encodeURIComponent(String(id))}`;
}

function idsFilter(ids) {
    return `id=in.(${ids.map((id) => Number(id)).filter(Boolean).join(",")})`;
}

async function all(table, query = "select=*") {
    return await rest(`${table}?${query}`);
}

async function getById(table, id) {
    const rows = await rest(`${table}?${idFilter(id)}&select=*&limit=1`);
    return rows[0] || null;
}

async function insertRow(table, row) {
    const rows = await rest(table, {
        method: "POST",
        prefer: "return=representation",
        body: row
    });
    return rows[0] || null;
}

async function updateRow(table, id, row) {
    const rows = await rest(`${table}?${idFilter(id)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: row
    });
    return rows[0] || null;
}

async function deleteById(table, id) {
    const existing = await getById(table, id);
    if (!existing) {
        return false;
    }
    await rest(`${table}?${idFilter(id)}`, {
        method: "DELETE",
        prefer: "return=minimal"
    });
    return true;
}

function asNumber(value, fallback = null) {
    const number = Number(value);
    return Number.isFinite(number) && number !== 0 ? number : fallback;
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

async function createUser(data) {
    const payload = parseUserPayload(data, true);
    const { passwordHash, salt } = hashPassword(payload.password);
    const user = await insertRow("users", {
        username: payload.username,
        password_hash: passwordHash,
        salt,
        real_name: payload.realName,
        gender: payload.gender,
        phone: payload.phone,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        created_at: nowText(),
        updated_at: nowText()
    });
    return publicUser(user);
}

async function updateUser(id, data) {
    const payload = parseUserPayload(data, false);
    const row = {
        username: payload.username,
        real_name: payload.realName,
        gender: payload.gender,
        phone: payload.phone,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        updated_at: nowText()
    };
    if (payload.password) {
        const { passwordHash, salt } = hashPassword(payload.password);
        row.password_hash = passwordHash;
        row.salt = salt;
    }
    return publicUser(await updateRow("users", id, row));
}

async function userByUsername(username) {
    const rows = await rest(`users?username=eq.${encodeURIComponent(username)}&select=*&limit=1`);
    return rows[0] || null;
}

async function listUsers() {
    const [users, reports, faces] = await Promise.all([
        all("users", "select=*&order=id.asc"),
        all("health_reports", "select=user_id"),
        all("face_records", "select=user_id")
    ]);
    const countByUser = (rows) => rows.reduce((acc, row) => {
        acc[row.user_id] = (acc[row.user_id] || 0) + 1;
        return acc;
    }, {});
    const reportCounts = countByUser(reports);
    const faceCounts = countByUser(faces);
    return users.map((user) => publicUser({
        ...user,
        report_count: reportCounts[user.id] || 0,
        face_count: faceCounts[user.id] || 0
    }));
}

function normalizeStatus(value, enabledText = "启用", disabledText = "禁用") {
    const text = String(value || enabledText).trim();
    if (["disabled", "offline"].includes(text) || text.includes("禁") || text.includes("下架")) {
        return disabledText;
    }
    if (["enabled", "online"].includes(text)) {
        return enabledText;
    }
    if (text === "draft" || text.includes("草稿")) {
        return "草稿";
    }
    if (text === "published" || text.includes("发布")) {
        return "已发布";
    }
    if (text === "success" || text.includes("完成")) {
        return "已完成";
    }
    if (text === "warning" || text.includes("审核")) {
        return "待审核";
    }
    return text;
}

async function listCarouselItems() {
    return await all("carousel_items", "select=*&order=sort_order.asc,id.asc");
}

async function saveCarouselItem(data, id = null) {
    const title = String(data.title || "").trim();
    if (!title) {
        throw new Error("轮播图标题不能为空");
    }
    const row = {
        title,
        subtitle: String(data.subtitle || "").trim(),
        image_url: String(data.imageUrl || data.image_url || "").trim() || `https://picsum.photos/seed/carousel${Date.now()}/1920/500`,
        link_url: String(data.linkUrl || data.link_url || "").trim() || "用户中心界面.html",
        sort_order: asNumber(data.sortOrder || data.sort_order, 1),
        status: normalizeStatus(data.status, "启用", "禁用")
    };
    return id ? await updateRow("carousel_items", id, row) : await insertRow("carousel_items", { ...row, created_at: todayText() });
}

async function listAnnouncements() {
    return await all("announcements", "select=*&order=is_top.desc,published_at.desc,id.desc");
}

async function saveAnnouncement(data, id = null) {
    const title = String(data.title || "").trim();
    const content = String(data.content || "").trim();
    if (!title || !content) {
        throw new Error("公告标题和内容不能为空");
    }
    const row = {
        title,
        content,
        category: String(data.category || "系统公告").trim(),
        status: normalizeStatus(data.status || "已发布"),
        published_at: String(data.publishedAt || data.published_at || nowText()).trim(),
        is_top: data.isTop || data.is_top ? 1 : 0,
        views: asNumber(data.views, 0) || 0,
        updated_at: nowText()
    };
    return id ? await updateRow("announcements", id, row) : await insertRow("announcements", row);
}

async function usersByIdMap() {
    const users = await all("users", "select=id,username,real_name");
    return users.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
    }, {});
}

async function listHealthData() {
    const [rows, userMap] = await Promise.all([
        all("health_data", "select=*&order=measured_at.desc,id.desc"),
        usersByIdMap()
    ]);
    return rows.map((row) => ({
        ...row,
        user_name_display: row.user_name || userMap[row.user_id]?.real_name || userMap[row.user_id]?.username || "未知用户"
    }));
}

async function saveHealthData(data, id = null) {
    const old = id ? await getById("health_data", id) : null;
    const row = {
        user_id: asNumber(data.userId || data.user_id, old?.user_id || 1),
        user_name: String(data.userName || data.user_name || old?.user_name || "").trim(),
        heart_rate: asNumber(data.heartRate || data.heart_rate),
        systolic_bp: asNumber(data.systolic || data.systolic_bp),
        diastolic_bp: asNumber(data.diastolic || data.diastolic_bp),
        blood_oxygen: asNumber(data.bloodOxygen || data.blood_oxygen),
        temperature: asNumber(data.temperature),
        risk_level: String(data.riskLevel || data.risk_level || data.status || old?.risk_level || "正常").trim(),
        face_id: String(data.faceId || data.face_id || old?.face_id || "").trim(),
        analysis_result: String(data.analysisResult || data.analysis_result || old?.analysis_result || "").trim(),
        remarks: String(data.remarks || old?.remarks || "").trim(),
        measured_at: String(data.measuredAt || data.measured_at || old?.measured_at || nowText()).trim()
    };
    return id ? await updateRow("health_data", id, row) : await insertRow("health_data", row);
}

async function listHealthReports() {
    const [rows, userMap] = await Promise.all([
        all("health_reports", "select=*&order=report_date.desc,id.desc"),
        usersByIdMap()
    ]);
    return rows.map((row) => ({
        ...row,
        user_name_display: userMap[row.user_id]?.real_name || userMap[row.user_id]?.username || "未知用户"
    }));
}

async function saveHealthReport(data, id = null) {
    const old = id ? await getById("health_reports", id) : null;
    const row = {
        user_id: asNumber(data.userId || data.user_id, old?.user_id || 1),
        report_no: String(data.reportNo || data.report_no || old?.report_no || `HR-${Date.now()}`).trim(),
        report_title: String(data.title || data.report_title || old?.report_title || "健康分析报告").trim(),
        summary: String(data.summary || data.analysisResult || data.analysis_result || old?.summary || "暂无分析结果").trim(),
        risk_level: String(data.riskLevel || data.risk_level || old?.risk_level || "正常").trim(),
        status: normalizeStatus(data.status || old?.status || "已完成"),
        report_date: String(data.reportDate || data.report_date || old?.report_date || todayText()).trim(),
        heart_rate: asNumber(data.heartRate || data.heart_rate || old?.heart_rate),
        blood_pressure: String(data.bloodPressure || data.blood_pressure || old?.blood_pressure || "").trim(),
        blood_oxygen: asNumber(data.bloodOxygen || data.blood_oxygen || old?.blood_oxygen),
        temperature: asNumber(data.temperature || old?.temperature),
        suggestions: String(data.suggestions || old?.suggestions || "").trim(),
        face_id: String(data.faceId || data.face_id || old?.face_id || "").trim(),
        health_data_id: String(data.healthDataId || data.health_data_id || old?.health_data_id || "").trim(),
        updated_at: nowText()
    };
    return id ? await updateRow("health_reports", id, row) : await insertRow("health_reports", { ...row, created_at: nowText() });
}

async function listFaceRecords() {
    const [rows, userMap] = await Promise.all([
        all("face_records", "select=*&order=recognition_time.desc,id.desc"),
        usersByIdMap()
    ]);
    return rows.map((row) => ({
        ...row,
        user_name_display: row.user_name || userMap[row.user_id]?.real_name || userMap[row.user_id]?.username || "未知用户"
    }));
}

async function saveFaceRecord(data, id = null) {
    const old = id ? await getById("face_records", id) : null;
    const row = {
        user_id: asNumber(data.userId || data.user_id, old?.user_id || 1),
        user_name: String(data.userName || data.user_name || old?.user_name || "").trim(),
        recognition_time: String(data.recognitionTime || data.recognition_time || old?.recognition_time || nowText()).trim(),
        similarity: asNumber(data.similarity, 0) || 0,
        device_name: String(data.deviceName || data.device_name || old?.device_name || "").trim(),
        result: String(data.result || old?.result || "识别成功").trim(),
        health_status: String(data.healthStatus || data.health_status || old?.health_status || "正常").trim(),
        location: String(data.location || old?.location || "").trim(),
        image_path: String(data.imagePath || data.image_path || old?.image_path || "").trim()
    };
    return id ? await updateRow("face_records", id, row) : await insertRow("face_records", row);
}

async function stats() {
    const [users, reports, faceRecords, healthData] = await Promise.all([
        all("users", "select=id"),
        all("health_reports", "select=id"),
        all("face_records", "select=id"),
        all("health_data", "select=id")
    ]);
    return {
        users: users.length,
        reports: reports.length,
        faceRecords: faceRecords.length,
        healthData: healthData.length
    };
}

async function handleResource(event, pathname, body) {
    const resources = {
        carousel: { table: "carousel_items", list: listCarouselItems, save: saveCarouselItem },
        announcements: { table: "announcements", list: listAnnouncements, save: saveAnnouncement },
        "health-data": { table: "health_data", list: listHealthData, save: saveHealthData },
        "health-reports": { table: "health_reports", list: listHealthReports, save: saveHealthReport },
        "face-records": { table: "face_records", list: listFaceRecords, save: saveFaceRecord }
    };

    for (const [resourceName, config] of Object.entries(resources)) {
        const basePath = `/api/${resourceName}`;
        const match = pathname.match(new RegExp(`^\\/api\\/${resourceName}\\/(\\d+)$`));

        if (event.httpMethod === "GET" && pathname === basePath) {
            return send(200, { success: true, data: await config.list() });
        }
        if (event.httpMethod === "GET" && match) {
            const item = await getById(config.table, Number(match[1]));
            return item ? send(200, { success: true, data: item }) : fail(404, "记录不存在");
        }
        if (event.httpMethod === "POST" && pathname === basePath) {
            return send(201, { success: true, message: "添加成功", data: await config.save(body) });
        }
        if (event.httpMethod === "PUT" && match) {
            const item = await config.save(body, Number(match[1]));
            return item ? send(200, { success: true, message: "保存成功", data: item }) : fail(404, "记录不存在");
        }
        if (event.httpMethod === "DELETE" && match) {
            const ok = await deleteById(config.table, Number(match[1]));
            return ok ? send(200, { success: true, message: "删除成功" }) : fail(404, "记录不存在");
        }
        if (event.httpMethod === "POST" && pathname === `${basePath}/batch-delete`) {
            const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
            if (ids.length) {
                await rest(`${config.table}?${idsFilter(ids)}`, { method: "DELETE", prefer: "return=minimal" });
            }
            return send(200, { success: true, message: "批量删除成功", deleted: ids.length });
        }
        if (event.httpMethod === "POST" && pathname === `${basePath}/batch-status`) {
            const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean) : [];
            const status = normalizeStatus(body.status || "启用", "启用", "禁用");
            if (ids.length) {
                await rest(`${config.table}?${idsFilter(ids)}`, {
                    method: "PATCH",
                    prefer: "return=minimal",
                    body: { status }
                });
            }
            return send(200, { success: true, message: "状态更新成功", updated: ids.length });
        }
    }

    return null;
}

exports.handler = async (event) => {
    if (event.httpMethod === "OPTIONS") {
        return { statusCode: 204, headers: jsonHeaders, body: "" };
    }

    const pathname = normalizePath(event);
    try {
        const body = ["POST", "PUT", "PATCH"].includes(event.httpMethod) ? bodyFromEvent(event) : {};

        if (event.httpMethod === "GET" && pathname === "/api/health") {
            ensureSupabase();
            return send(200, { success: true, message: "Netlify Functions 运行正常", database: "Supabase" });
        }

        if (event.httpMethod === "GET" && pathname === "/api/public-url") {
            const protocol = event.headers["x-forwarded-proto"] || "https";
            const host = event.headers.host || "";
            const url = host ? `${protocol}://${host}/` : "";
            return send(200, { success: true, data: { publicUrl: url, localUrl: url, localhostUrl: url, port: 443 } });
        }

        if (event.httpMethod === "POST" && pathname === "/api/public-url") {
            return send(200, { success: true, data: { publicUrl: String(body.url || "").trim() } });
        }

        if (event.httpMethod === "GET" && pathname === "/api/users") {
            return send(200, { success: true, data: await listUsers() });
        }

        if (event.httpMethod === "GET" && /^\/api\/users\/\d+$/.test(pathname)) {
            const user = publicUser(await getById("users", Number(pathname.split("/").pop())));
            return user ? send(200, { success: true, data: user }) : fail(404, "用户不存在");
        }

        if (event.httpMethod === "POST" && pathname === "/api/register") {
            return send(201, { success: true, message: "注册成功", user: await createUser(body) });
        }

        if (event.httpMethod === "POST" && pathname === "/api/users") {
            return send(201, { success: true, message: "用户添加成功", user: await createUser(body) });
        }

        if (event.httpMethod === "PUT" && /^\/api\/users\/\d+$/.test(pathname)) {
            const user = await updateUser(Number(pathname.split("/").pop()), body);
            return user ? send(200, { success: true, message: "用户信息已更新", user }) : fail(404, "用户不存在");
        }

        if (event.httpMethod === "DELETE" && /^\/api\/users\/\d+$/.test(pathname)) {
            const ok = await deleteById("users", Number(pathname.split("/").pop()));
            return ok ? send(200, { success: true, message: "用户已删除" }) : fail(404, "用户不存在");
        }

        if (event.httpMethod === "POST" && pathname === "/api/login") {
            const username = String(body.username || "").trim();
            const password = String(body.password || "");
            const user = await userByUsername(username);
            if (!user || hashPassword(password, user.salt).passwordHash !== user.password_hash) {
                return fail(401, "用户名或密码错误");
            }
            return send(200, {
                success: true,
                message: "登录成功",
                token: crypto.randomBytes(24).toString("base64url"),
                user: publicUser(user)
            });
        }

        if (event.httpMethod === "POST" && pathname === "/api/admin-login") {
            const username = String(body.username || "").trim();
            const password = String(body.password || "");
            if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
                return fail(401, "管理员账号或密码错误");
            }
            return send(200, {
                success: true,
                message: "管理员登录成功",
                token: crypto.randomBytes(24).toString("base64url"),
                admin: { username: ADMIN_USERNAME, realName: "系统管理员", role: "admin" }
            });
        }

        if (event.httpMethod === "POST" && pathname === "/api/change-password") {
            const userId = Number(body.userId || 0);
            const oldPassword = String(body.oldPassword || "");
            const newPassword = String(body.newPassword || "");
            if (newPassword.length < 6) {
                return fail(400, "新密码至少 6 位");
            }
            const user = await getById("users", userId);
            if (!user) {
                return fail(404, "用户不存在");
            }
            if (hashPassword(oldPassword, user.salt).passwordHash !== user.password_hash) {
                return fail(401, "原密码不正确");
            }
            const { passwordHash, salt } = hashPassword(newPassword);
            await updateRow("users", userId, { password_hash: passwordHash, salt, updated_at: nowText() });
            return send(200, { success: true, message: "密码修改成功" });
        }

        if (event.httpMethod === "GET" && pathname === "/api/stats") {
            return send(200, { success: true, data: await stats() });
        }

        const resourceResponse = await handleResource(event, pathname, body);
        if (resourceResponse) {
            return resourceResponse;
        }

        return fail(404, "接口不存在");
    } catch (error) {
        const message = String(error.message || error);
        if (error.code === "23505" || message.includes("duplicate key")) {
            return fail(409, "用户名已存在，请换一个用户名");
        }
        return fail(error.statusCode || 400, message);
    }
};
