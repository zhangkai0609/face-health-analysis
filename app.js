(function () {
    const adminPages = new Set([
        "管理端口.html",
        "用户管理界面.html",
        "轮播图管理界面.html",
        "健康数据管理界面.html",
        "健康报告管理界面.html",
        "公告管理界面.html",
        "人脸识别记录管理界面.html"
    ]);

    const adminMenu = [
        ["管理端口", "fa-dashboard", "管理端口.html"],
        ["轮播图管理", "fa-picture-o", "轮播图管理界面.html"],
        ["健康数据管理", "fa-heartbeat", "健康数据管理界面.html"],
        ["健康报告管理", "fa-file-text-o", "健康报告管理界面.html"],
        ["公告管理", "fa-bullhorn", "公告管理界面.html"],
        ["人脸识别记录管理", "fa-camera", "人脸识别记录管理界面.html"],
        ["用户信息管理", "fa-users", "用户管理界面.html"]
    ];

    const pageMap = [
        [/^首页$|网站首页/, "首页管理.html"],
        [/用户管理/, "用户管理界面.html"],
        [/人脸识别管理|人脸识别记录管理/, "人脸识别记录管理界面.html"],
        [/健康报告管理/, "健康报告管理界面.html"],
        [/健康数据管理|数据分析统计/, "健康数据管理界面.html"],
        [/公告管理/, "公告管理界面.html"],
        [/轮播图管理|轮播图/, "轮播图管理界面.html"],
        [/历史报告|健康报告|快速健康分析|健康分析|立即分析|开始识别|开始人脸识别|个人中心|用户中心/, "用户中心界面.html"],
        [/系统公告|查看更多/, "首页管理.html#announcements"],
        [/管理员登录|后台管理/, "管理员登录界面.html"],
        [/管理端口/, "管理端口.html"],
        [/注册|立即注册|创建账号/, "用户注册.html"],
        [/登录|立即登录/, "login.html"]
    ];

    function qs(selector, root = document) {
        return root.querySelector(selector);
    }

    function qsa(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function cleanText(value) {
        return (value || "").replace(/\s+/g, "").trim();
    }

    function normalizeLinks() {
        qsa("a").forEach((link) => {
            if (link.dataset.page) {
                return;
            }

            const href = link.getAttribute("href") || "";
            const text = cleanText(link.textContent);

            if (href === "index.html") {
                link.href = "首页管理.html";
                return;
            }
            if (href === "register.html") {
                link.href = "用户注册.html";
                return;
            }
            if (href === "login.html") {
                link.href = "login.html";
                return;
            }
            if (href === "admin.html" || href === "admin-login.html") {
                link.href = "管理员登录界面.html";
                return;
            }

            if (href && href !== "#") {
                return;
            }

            const item = pageMap.find(([pattern]) => pattern.test(text));
            if (item) {
                link.href = item[1];
            }
        });
    }

    function protectPageLinks() {
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a");
            if (!link || link.dataset.page) {
                return;
            }
            const href = link.getAttribute("href") || "";
            if (!href || href === "#" || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
                return;
            }
            event.stopImmediatePropagation();
        }, true);
    }

    async function request(path, options = {}) {
        const response = await fetch(path, {
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.success === false) {
            throw new Error(data.message || "请求失败");
        }
        return data;
    }

    function toast(message, type = "success") {
        const oldToast = qs("#codexToast");
        if (oldToast) {
            oldToast.remove();
        }
        const box = document.createElement("div");
        box.id = "codexToast";
        box.textContent = message;
        box.className = [
            "fixed", "right-6", "top-20", "z-[9999]", "px-5", "py-3",
            "rounded-lg", "shadow-lg", "text-white", "text-sm", "font-medium",
            type === "error" ? "bg-red-500" : "bg-green-500"
        ].join(" ");
        document.body.appendChild(box);
        setTimeout(() => box.remove(), 2600);
    }

    function getGender() {
        const checked = qs('input[name="gender"]:checked');
        return checked ? checked.value : "male";
    }

    function getStoredUser() {
        const raw = localStorage.getItem("currentUser") || localStorage.getItem("user");
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function saveSession(user, token) {
        localStorage.setItem("currentUser", JSON.stringify(user));
        localStorage.setItem("user", JSON.stringify(user));
        if (token) {
            localStorage.setItem("token", token);
        }
    }

    function clearSession() {
        localStorage.removeItem("currentUser");
        localStorage.removeItem("user");
        localStorage.removeItem("token");
    }

    function currentFileName() {
        const name = decodeURIComponent(window.location.pathname.split("/").pop() || "首页管理.html");
        return name || "首页管理.html";
    }

    function getStoredAdmin() {
        const raw = localStorage.getItem("adminUser");
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function saveAdminSession(admin, token) {
        localStorage.setItem("adminUser", JSON.stringify(admin));
        if (token) {
            localStorage.setItem("adminToken", token);
        }
    }

    function clearAdminSession() {
        localStorage.removeItem("adminUser");
        localStorage.removeItem("adminToken");
    }

    function initRegister() {
        const form = qs("#registerForm");
        if (!form) {
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const password = qs("#password")?.value || "";
            const confirmPassword = qs("#confirmPassword")?.value || "";
            if (password !== confirmPassword) {
                toast("两次输入的密码不一致", "error");
                return;
            }
            if (!form.reportValidity()) {
                return;
            }

            try {
                const result = await request("/api/register", {
                    method: "POST",
                    body: JSON.stringify({
                        username: qs("#username")?.value.trim(),
                        password,
                        realName: qs("#realName")?.value.trim(),
                        gender: getGender(),
                        phone: qs("#phone")?.value.trim(),
                        email: qs("#email")?.value.trim() || ""
                    })
                });
                saveSession(result.user);
                toast("注册成功，已写入数据库");
                setTimeout(() => {
                    window.location.href = "首页管理.html";
                }, 700);
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);
    }

    function initLogin() {
        const form = qs("#loginForm");
        if (!form) {
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            try {
                const result = await request("/api/login", {
                    method: "POST",
                    body: JSON.stringify({
                        username: qs("#loginUsername")?.value.trim(),
                        password: qs("#loginPassword")?.value
                    })
                });
                saveSession(result.user, result.token);
                toast("登录成功，返回首页");
                setTimeout(() => {
                    window.location.href = "首页管理.html";
                }, 500);
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);
    }

    function initAdminLogin() {
        const form = qs("#adminLoginForm");
        if (!form) {
            return;
        }

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            try {
                const result = await request("/api/admin-login", {
                    method: "POST",
                    body: JSON.stringify({
                        username: qs("#adminUsername")?.value.trim(),
                        password: qs("#adminPassword")?.value
                    })
                });
                saveAdminSession(result.admin, result.token);
                toast("管理员登录成功");
                setTimeout(() => {
                    window.location.href = "管理端口.html";
                }, 500);
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);
    }

    function initAuthLinks() {
        const user = getStoredUser();
        if (!user) {
            return;
        }
        const registerLink = qsa("a").find((link) => cleanText(link.textContent) === "注册");
        const loginLink = qsa("a").find((link) => cleanText(link.textContent) === "登录");
        if (registerLink) {
            registerLink.textContent = "用户中心";
            registerLink.href = "用户中心界面.html";
        }
        if (loginLink) {
            loginLink.textContent = "退出登录";
            loginLink.href = "#";
            loginLink.addEventListener("click", (event) => {
                event.preventDefault();
                clearSession();
                toast("已退出登录");
                setTimeout(() => window.location.reload(), 400);
            }, true);
        }
    }

    function protectAdminPages() {
        const fileName = currentFileName();
        if (!adminPages.has(fileName)) {
            return true;
        }
        if (getStoredAdmin()) {
            return true;
        }
        window.location.href = "管理员登录界面.html";
        return false;
    }

    function initAdminNavigation() {
        const fileName = currentFileName();
        if (!adminPages.has(fileName)) {
            return;
        }

        document.body.classList.add("admin-page");
        const style = document.createElement("style");
        style.textContent = `
            .admin-page table th,
            .admin-page table td { white-space: nowrap; }
            .admin-page main { min-width: 0; }
            @media (max-width: 900px) {
                .admin-page aside { position: static !important; width: 100% !important; height: auto !important; }
                .admin-page main { margin-left: 0 !important; }
                .admin-page .flex.flex-1.pt-16 { flex-direction: column; }
            }
        `;
        document.head.appendChild(style);

        const asideNav = qs("aside nav");
        if (asideNav) {
            asideNav.innerHTML = `
                <div class="px-4 mb-4">
                    <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">管理员端口</h2>
                </div>
                <ul class="space-y-1">
                    ${adminMenu.map(([title, icon, href]) => {
                        const active = fileName === href;
                        const cls = active
                            ? "sidebar-item-active flex items-center px-4 py-3 text-sm"
                            : "flex items-center px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors";
                        return `
                            <li>
                                <a href="${href}" class="${cls}">
                                    <i class="fa ${icon} w-5 text-center mr-3"></i>
                                    <span>${title}</span>
                                </a>
                            </li>
                        `;
                    }).join("")}
                    <li class="pt-3 mt-3 border-t border-gray-200">
                        <a href="#" data-admin-logout class="flex items-center px-4 py-3 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                            <i class="fa fa-sign-out w-5 text-center mr-3"></i>
                            <span>退出管理员登录</span>
                        </a>
                    </li>
                </ul>
            `;
        }

        qsa("[data-admin-logout]").forEach((link) => {
            link.addEventListener("click", (event) => {
                event.preventDefault();
                clearAdminSession();
                toast("管理员已退出");
                setTimeout(() => {
                    window.location.href = "管理员登录界面.html";
                }, 500);
            }, true);
        });
    }

    function userRow(user) {
        const createdAt = (user.created_at || "").split(" ")[0] || "-";
        return `
            <tr class="border-b border-gray-200 table-row-hover">
                <td class="px-6 py-4 text-sm">${user.id}</td>
                <td class="px-6 py-4 text-sm">${user.username}</td>
                <td class="px-6 py-4 text-sm">${user.real_name || user.realName || ""}</td>
                <td class="px-6 py-4 text-sm">${user.phone || ""}</td>
                <td class="px-6 py-4 text-sm">${createdAt}</td>
                <td class="px-6 py-4 text-sm">${user.report_count || 0}</td>
                <td class="px-6 py-4 text-sm">${user.face_count || 0}</td>
                <td class="px-6 py-4 text-sm text-right">
                    <button class="edit-btn text-primary hover:text-primary/80 mr-3 transition-colors" data-id="${user.id}">
                        <i class="fa fa-pencil"></i> 编辑
                    </button>
                    <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${user.id}">
                        <i class="fa fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `;
    }

    async function loadUsers() {
        const tableBody = qs("main table tbody");
        if (!tableBody) {
            return;
        }

        try {
            const result = await request("/api/users");
            tableBody.innerHTML = result.data.length
                ? result.data.map(userRow).join("")
                : '<tr><td class="px-6 py-8 text-sm text-gray-500 text-center" colspan="8">暂无用户数据</td></tr>';

            const totalText = qs(".border-t .text-sm.text-gray-500");
            if (totalText) {
                totalText.innerHTML = `共 <span class="font-medium">${result.data.length}</span> 条记录，当前第 <span class="font-medium">1</span> 页 / 共 <span class="font-medium">1</span> 页`;
            }
        } catch (error) {
            toast(error.message, "error");
        }
    }

    function fillUserForm(user) {
        qs("#userId").value = user.id || "";
        qs("#username").value = user.username || "";
        qs("#realName").value = user.real_name || user.realName || "";
        qs("#phone").value = user.phone || "";
        if (qs("#password")) {
            qs("#password").value = "";
            qs("#password").required = !user.id;
        }
    }

    function initUserManage() {
        const tableBody = qs("main table tbody");
        const userModal = qs("#userModal");
        const deleteModal = qs("#deleteModal");
        const userForm = qs("#userForm");
        if (!tableBody || !userModal || !userForm) {
            return;
        }

        let deleteId = null;
        loadUsers();

        qs("#addUserBtn")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            qs("#modalTitle").textContent = "新增用户";
            userForm.reset();
            fillUserForm({});
            userModal.classList.remove("hidden");
        }, true);

        document.addEventListener("click", async (event) => {
            const editBtn = event.target.closest(".edit-btn");
            if (editBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                try {
                    const result = await request(`/api/users/${editBtn.dataset.id}`);
                    qs("#modalTitle").textContent = "编辑用户";
                    fillUserForm(result.data);
                    userModal.classList.remove("hidden");
                } catch (error) {
                    toast(error.message, "error");
                }
                return;
            }

            const deleteBtn = event.target.closest(".delete-btn");
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = deleteBtn.dataset.id;
                deleteModal?.classList.remove("hidden");
            }
        }, true);

        userForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();

            const userId = qs("#userId")?.value;
            const body = {
                username: qs("#username")?.value.trim(),
                password: qs("#password")?.value || "",
                realName: qs("#realName")?.value.trim(),
                phone: qs("#phone")?.value.trim(),
                gender: "male",
                role: "user",
                status: "正常"
            };
            const method = userId ? "PUT" : "POST";
            const url = userId ? `/api/users/${userId}` : "/api/users";

            try {
                await request(url, { method, body: JSON.stringify(body) });
                toast(userId ? "用户信息更新成功" : "用户添加成功");
                userModal.classList.add("hidden");
                await loadUsers();
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);

        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!deleteId) {
                return;
            }
            try {
                await request(`/api/users/${deleteId}`, { method: "DELETE" });
                toast("用户已删除");
                deleteModal?.classList.add("hidden");
                deleteId = null;
                await loadUsers();
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);
    }

    async function loadCurrentUser() {
        const storedUser = getStoredUser();
        if (storedUser?.id) {
            const result = await request(`/api/users/${storedUser.id}`);
            saveSession(result.data);
            return result.data;
        }

        throw new Error("请先登录用户账号");
    }

    function initUserCenter() {
        const profileForm = qs("#profileForm");
        if (!profileForm) {
            return;
        }

        let currentUser = null;
        loadCurrentUser()
            .then((user) => {
                currentUser = user;
                if (!user) {
                    return;
                }
                qs("#realName").value = user.real_name || "";
                qs("#phone").value = user.phone || "";
                qs("#email").value = user.email || "";
            })
            .catch((error) => {
                toast(error.message, "error");
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 700);
            });

        profileForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!currentUser) {
                toast("请先登录或创建用户", "error");
                return;
            }

            try {
                const result = await request(`/api/users/${currentUser.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        username: currentUser.username,
                        password: "",
                        realName: qs("#realName").value.trim(),
                        gender: currentUser.gender || "male",
                        phone: qs("#phone").value.trim(),
                        email: qs("#email").value.trim(),
                        role: currentUser.role || "user",
                        status: currentUser.status || "正常"
                    })
                });
                currentUser = result.user;
                saveSession(result.user);
                toast("个人信息已保存到数据库");
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);

        qs("#passwordForm")?.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (!currentUser) {
                toast("请先登录", "error");
                return;
            }
            const newPassword = qs("#newPassword")?.value || "";
            const confirmPassword = qs("#confirmNewPassword")?.value || "";
            if (newPassword !== confirmPassword) {
                toast("两次输入的新密码不一致", "error");
                return;
            }

            try {
                await request("/api/change-password", {
                    method: "POST",
                    body: JSON.stringify({
                        userId: currentUser.id,
                        oldPassword: qs("#oldPassword")?.value || "",
                        newPassword
                    })
                });
                toast("密码修改成功，请重新登录");
                clearSession();
                setTimeout(() => {
                    window.location.href = "login.html";
                }, 800);
            } catch (error) {
                toast(error.message, "error");
            }
        }, true);

        qs("#confirmLogout")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            clearSession();
            toast("已退出登录");
            setTimeout(() => {
                window.location.href = "首页管理.html";
            }, 500);
        }, true);
    }

    function esc(value) {
        return String(value ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#39;");
    }

    function shortDate(value) {
        return String(value || "").split(" ")[0] || "-";
    }

    function selectedIds() {
        return qsa(".record-checkbox:checked").map((item) => Number(item.dataset.id)).filter(Boolean);
    }

    function refreshSelectedCount() {
        const ids = selectedIds();
        const selectedCount = qs("#selectedCount");
        if (selectedCount) {
            selectedCount.textContent = ids.length;
        }
        qsa("#batchDeleteBtn,#batchEnableBtn,#batchDisableBtn").forEach((button) => {
            button.disabled = ids.length === 0;
            button.classList.toggle("btn-disabled", ids.length === 0);
        });
        return ids;
    }

    function bindSelectionEvents(root = document) {
        const selectAll = qs("#selectAll", root);
        if (selectAll) {
            selectAll.addEventListener("change", (event) => {
                event.stopImmediatePropagation();
                qsa(".record-checkbox", root).forEach((checkbox) => {
                    checkbox.checked = selectAll.checked;
                });
                refreshSelectedCount();
            }, true);
        }
        root.addEventListener("change", (event) => {
            if (!event.target.matches(".record-checkbox")) {
                return;
            }
            event.stopImmediatePropagation();
            refreshSelectedCount();
        }, true);
        refreshSelectedCount();
    }

    function setPagination(total) {
        const totalText = qs(".border-t .text-sm.text-gray-500");
        if (totalText) {
            totalText.innerHTML = `共 <span class="font-medium">${total}</span> 条记录，当前第 <span class="font-medium">1</span> 页 / 共 <span class="font-medium">1</span> 页`;
        }
    }

    function enabledBadge(status) {
        const enabled = !String(status || "").includes("禁");
        return enabled ? '<span class="status-enabled">已启用</span>' : '<span class="status-disabled">已禁用</span>';
    }

    function publishBadge(status) {
        const text = String(status || "已发布");
        if (text.includes("草稿")) {
            return '<span class="status-draft">草稿</span>';
        }
        if (text.includes("下架") || text.includes("禁")) {
            return '<span class="status-offline">已下架</span>';
        }
        return '<span class="status-published">已发布</span>';
    }

    function healthBadge(status) {
        const text = String(status || "正常");
        if (text.includes("需") || text.includes("高") || text.includes("危险")) {
            return '<span class="status-danger">异常</span>';
        }
        if (text.includes("待") || text.includes("中") || text.includes("异常")) {
            return '<span class="status-warning">待复查</span>';
        }
        return '<span class="status-success">正常</span>';
    }

    function reportStatusBadge(status) {
        const text = String(status || "已完成");
        if (text.includes("审核") || text.includes("待")) {
            return '<span class="status-warning">待审核</span>';
        }
        if (text.includes("失败") || text.includes("异常")) {
            return '<span class="status-danger">异常</span>';
        }
        return '<span class="status-success">已完成</span>';
    }

    function statusToSelect(value, enabledValue = "enabled", disabledValue = "disabled") {
        return String(value || "").includes("禁") || String(value || "").includes("下架") ? disabledValue : enabledValue;
    }

    function openEditModal(title) {
        const modal = qs("#editModal") || qs("#healthModal");
        if (qs("#editModalTitle")) {
            qs("#editModalTitle").textContent = title;
        }
        if (qs("#modalTitle")) {
            qs("#modalTitle").textContent = title;
        }
        modal?.classList.remove("hidden");
    }

    function closeAdminModals() {
        qsa("#editModal,#healthModal,#deleteModal,#previewModal,#detailModal,#batchConfirmModal").forEach((modal) => modal.classList.add("hidden"));
    }

    function initAdminModals() {
        // 通用弹窗关闭处理 - 为所有管理员页面绑定关闭按钮事件
        document.addEventListener("click", (event) => {
            const target = event.target;
            // 点击弹窗外部关闭
            const modals = qsa("#editModal,#healthModal,#deleteModal,#previewModal,#detailModal,#batchConfirmModal");
            modals.forEach((modal) => {
                if (target === modal) {
                    modal.classList.add("hidden");
                }
            });
            // 关闭按钮
            if (target.closest("#closeEditModal") || target.closest("#cancelEditBtn")) {
                qs("#editModal")?.classList.add("hidden");
            }
            if (target.closest("#closeModal") || target.closest("#cancelBtn")) {
                qs("#userModal")?.classList.add("hidden");
                qs("#healthModal")?.classList.add("hidden");
            }
            if (target.closest("#closePreviewModal") || target.closest("#closePreviewBtn")) {
                qs("#previewModal")?.classList.add("hidden");
            }
            if (target.closest("#closeDetailModal") || target.closest("#closeDetailBtn")) {
                qs("#detailModal")?.classList.add("hidden");
            }
            if (target.closest("#cancelDelete")) {
                qs("#deleteModal")?.classList.add("hidden");
            }
            if (target.closest("#cancelBatch")) {
                qs("#batchConfirmModal")?.classList.add("hidden");
            }
        }, true);
    }

    function initCarouselCrud() {
        const tbody = qs("#carouselTbody");
        const form = qs("#editForm");
        if (!tbody || !qs("#addCarouselBtn") || !form || currentFileName() !== "轮播图管理界面.html") {
            return;
        }
        let rows = [];
        let deleteId = null;

        const render = async () => {
            const result = await request("/api/carousel");
            rows = result.data;
            tbody.innerHTML = rows.map((item) => `
                <tr class="border-b border-gray-200 table-row-hover" data-id="${item.id}">
                    <td class="px-4 py-4"><input type="checkbox" class="record-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" data-id="${item.id}"></td>
                    <td class="px-4 py-4 text-gray-400"><i class="fa fa-bars"></i></td>
                    <td class="px-4 py-4"><img src="${esc(item.image_url || `https://picsum.photos/seed/carousel${item.id}/120/60`)}" alt="轮播图" class="w-24 h-12 object-cover rounded border border-gray-200"></td>
                    <td class="px-4 py-4 text-sm font-medium">${esc(item.title)}</td>
                    <td class="px-4 py-4 text-sm text-gray-400 truncate max-w-[150px]" title="${esc(item.link_url || "")}">${esc(item.link_url || "-")}</td>
                    <td class="px-4 py-4 text-sm">${item.sort_order || 1}</td>
                    <td class="px-4 py-4 text-sm">${enabledBadge(item.status)}</td>
                    <td class="px-4 py-4 text-sm">${shortDate(item.created_at)}</td>
                    <td class="px-4 py-4 text-sm text-right">
                        <button class="preview-btn text-primary hover:text-primary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-eye"></i> 预览</button>
                        <button class="edit-btn text-secondary hover:text-secondary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-pencil"></i> 编辑</button>
                        <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${item.id}"><i class="fa fa-trash"></i> 删除</button>
                    </td>
                </tr>
            `).join("");
            setPagination(rows.length);
            bindSelectionEvents(document);
        };

        qs("#addCarouselBtn").addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            form.reset();
            qs("#carouselId").value = "";
            qs("#carouselSort").value = rows.length + 1;
            qs("#carouselStatus").value = "enabled";
            openEditModal("添加轮播图");
        }, true);

        document.addEventListener("click", async (event) => {
            const editBtn = event.target.closest(".edit-btn");
            const previewBtn = event.target.closest(".preview-btn");
            const deleteBtn = event.target.closest(".delete-btn");
            if (!event.target.closest("#carouselTable") && !event.target.closest("#deleteModal") && !event.target.closest("#previewModal")) {
                return;
            }
            if (editBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(editBtn.dataset.id));
                if (!item) return;
                qs("#carouselId").value = item.id;
                qs("#carouselTitle").value = item.title || "";
                qs("#carouselLink").value = item.link_url || "";
                qs("#carouselSort").value = item.sort_order || 1;
                qs("#carouselStatus").value = statusToSelect(item.status);
                const preview = qs("#imagePreview img");
                if (preview) preview.src = item.image_url || `https://picsum.photos/seed/carousel${item.id}/120/60`;
                openEditModal("编辑轮播图");
            }
            if (previewBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(previewBtn.dataset.id));
                if (!item) return;
                qs("#previewImage").src = item.image_url || `https://picsum.photos/seed/carousel${item.id}/1920/500`;
                qs("#previewTitle").textContent = item.title || "";
                qs("#previewLink").textContent = item.link_url || "-";
                qs("#previewModal")?.classList.remove("hidden");
            }
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = Number(deleteBtn.dataset.id);
                qs("#deleteModalText").textContent = "确定删除这张轮播图吗？删除后首页将同步移除。";
                qs("#deleteModal")?.classList.remove("hidden");
            }
        }, true);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const id = qs("#carouselId").value;
            const image = qs("#imagePreview img")?.src || "";
            const body = {
                title: qs("#carouselTitle").value.trim(),
                linkUrl: qs("#carouselLink").value.trim(),
                sortOrder: Number(qs("#carouselSort").value || 1),
                status: qs("#carouselStatus").value === "disabled" ? "禁用" : "启用",
                imageUrl: image.includes("http") ? image : ""
            };
            await request(id ? `/api/carousel/${id}` : "/api/carousel", {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(body)
            });
            toast(id ? "轮播图已保存并同步展示" : "轮播图已添加并同步展示");
            closeAdminModals();
            await render();
        }, true);

        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "轮播图管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const ids = deleteId ? [deleteId] : selectedIds();
            if (ids.length > 1) {
                await request("/api/carousel/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
            } else if (ids[0]) {
                await request(`/api/carousel/${ids[0]}`, { method: "DELETE" });
            }
            deleteId = null;
            toast("轮播图已删除并同步展示");
            closeAdminModals();
            await render();
        }, true);

        qs("#batchDeleteBtn")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteId = null;
            qs("#deleteModalText").textContent = `确定删除选中的 ${selectedIds().length} 张轮播图吗？`;
            qs("#deleteModal")?.classList.remove("hidden");
        }, true);
        qs("#batchEnableBtn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            await request("/api/carousel/batch-status", { method: "POST", body: JSON.stringify({ ids: selectedIds(), status: "启用" }) });
            await render();
        }, true);
        qs("#batchDisableBtn")?.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            await request("/api/carousel/batch-status", { method: "POST", body: JSON.stringify({ ids: selectedIds(), status: "禁用" }) });
            await render();
        }, true);
        qs("#confirmBatch")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "轮播图管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const action = qs("#batchConfirmTitle")?.textContent || "";
            if (action.includes("删除")) {
                const ids = selectedIds();
                if (ids.length > 0) {
                    await request("/api/carousel/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
                    toast("轮播图已批量删除并同步展示");
                }
            } else if (action.includes("启用")) {
                await request("/api/carousel/batch-status", { method: "POST", body: JSON.stringify({ ids: selectedIds(), status: "启用" }) });
            } else if (action.includes("禁用")) {
                await request("/api/carousel/batch-status", { method: "POST", body: JSON.stringify({ ids: selectedIds(), status: "禁用" }) });
            }
            closeAdminModals();
            await render();
        }, true);
        render().catch((error) => toast(error.message, "error"));
    }

    function initAnnouncementCrud() {
        if (currentFileName() !== "公告管理界面.html") return;
        const tableBody = qs("main table tbody");
        const form = qs("#editForm");
        if (!tableBody || !form || !qs("#publishAnnouncementBtn")) return;
        let rows = [];
        let deleteId = null;

        const render = async () => {
            const result = await request("/api/announcements");
            rows = result.data;
            tableBody.innerHTML = rows.map((item) => `
                <tr class="border-b border-gray-200 table-row-hover">
                    <td class="px-4 py-4"><input type="checkbox" class="record-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" data-id="${item.id}"></td>
                    <td class="px-4 py-4 text-sm">${item.id}</td>
                    <td class="px-4 py-4 text-sm"><div class="flex items-center">${item.is_top ? '<span class="tag-top mr-2">置顶</span>' : ""}<span class="font-medium">${esc(item.title)}</span></div></td>
                    <td class="px-4 py-4 text-sm">${esc(item.published_at || "")}</td>
                    <td class="px-4 py-4 text-sm">${publishBadge(item.status)}</td>
                    <td class="px-4 py-4 text-sm">${item.is_top ? '<span class="text-danger">是</span>' : "否"}</td>
                    <td class="px-4 py-4 text-sm">${item.views || 0}</td>
                    <td class="px-4 py-4 text-sm text-right">
                        <button class="preview-btn text-primary hover:text-primary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-eye"></i> 预览</button>
                        <button class="edit-btn text-secondary hover:text-secondary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-pencil"></i> 编辑</button>
                        <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${item.id}"><i class="fa fa-trash"></i> 删除</button>
                    </td>
                </tr>
            `).join("");
            setPagination(rows.length);
            bindSelectionEvents(document);
        };

        qs("#publishAnnouncementBtn").addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            form.reset();
            qs("#announcementId").value = "";
            qs("#publishStatus").value = "published";
            openEditModal("发布公告");
        }, true);

        document.addEventListener("click", (event) => {
            if (currentFileName() !== "公告管理界面.html") return;
            const editBtn = event.target.closest(".edit-btn");
            const previewBtn = event.target.closest(".preview-btn");
            const deleteBtn = event.target.closest(".delete-btn");
            if (editBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(editBtn.dataset.id));
                if (!item) return;
                qs("#announcementId").value = item.id;
                qs("#announcementTitle").value = item.title || "";
                qs("#announcementContent").value = item.content || "";
                qs("#isTop").checked = Boolean(item.is_top);
                qs("#publishStatus").value = String(item.status || "").includes("草稿") ? "draft" : "published";
                openEditModal("编辑公告");
            }
            if (previewBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(previewBtn.dataset.id));
                if (!item) return;
                qs("#previewTitle").textContent = item.title || "";
                qs("#previewMeta").textContent = `发布时间：${item.published_at || ""} | 浏览量：${item.views || 0}`;
                qs("#previewContent").innerHTML = `<p>${esc(item.content || "").replaceAll("\n", "</p><p>")}</p>`;
                qs("#previewModal")?.classList.remove("hidden");
            }
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = Number(deleteBtn.dataset.id);
                qs("#deleteModalText").textContent = "确定删除这条公告吗？删除后用户端公告区域会同步更新。";
                qs("#deleteModal")?.classList.remove("hidden");
            }
        }, true);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const id = qs("#announcementId").value;
            await request(id ? `/api/announcements/${id}` : "/api/announcements", {
                method: id ? "PUT" : "POST",
                body: JSON.stringify({
                    title: qs("#announcementTitle").value.trim(),
                    content: qs("#announcementContent").value.trim(),
                    isTop: qs("#isTop").checked,
                    status: qs("#publishStatus").value === "draft" ? "草稿" : "已发布",
                    publishedAt: nowForInput().replace("T", " ")
                })
            });
            toast(id ? "公告已保存并同步展示" : "公告已发布并同步展示");
            closeAdminModals();
            await render();
        }, true);

        qs("#batchDeleteBtn")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteId = null;
            qs("#deleteModalText").textContent = `确定删除选中的 ${selectedIds().length} 条公告吗？`;
            qs("#deleteModal")?.classList.remove("hidden");
        }, true);
        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "公告管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const ids = deleteId ? [deleteId] : selectedIds();
            if (ids.length > 1) {
                await request("/api/announcements/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
            } else if (ids[0]) {
                await request(`/api/announcements/${ids[0]}`, { method: "DELETE" });
            }
            deleteId = null;
            toast("公告已删除并同步展示");
            closeAdminModals();
            await render();
        }, true);
        render().catch((error) => toast(error.message, "error"));
    }

    function nowForInput() {
        const d = new Date();
        const pad = (n) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }

    function riskText(value) {
        const text = String(value || "正常");
        if (text === "normal") return "正常";
        if (text === "warning") return "异常(待复查)";
        if (text === "danger") return "异常(需就医)";
        return text;
    }

    function initHealthDataCrud() {
        if (currentFileName() !== "健康数据管理界面.html") return;
        const tableBody = qs("main table tbody");
        const form = qs("#healthForm");
        if (!tableBody || !form || !qs("#addHealthBtn")) return;
        let rows = [];
        let deleteId = null;

        const render = async () => {
            const result = await request("/api/health-data");
            rows = result.data;
            tableBody.innerHTML = rows.map((item) => `
                <tr class="border-b border-gray-200 table-row-hover">
                    <td class="px-6 py-4 text-sm">${item.id}</td>
                    <td class="px-6 py-4 text-sm">${item.user_id}</td>
                    <td class="px-6 py-4 text-sm">${esc(item.user_name_display || item.user_name || "")}</td>
                    <td class="px-6 py-4 text-sm">${item.heart_rate || "-"} bpm</td>
                    <td class="px-6 py-4 text-sm">${item.systolic_bp || "-"}/${item.diastolic_bp || "-"} mmHg</td>
                    <td class="px-6 py-4 text-sm">${item.blood_oxygen || "-"}%</td>
                    <td class="px-6 py-4 text-sm">${item.temperature || "-"}°C</td>
                    <td class="px-6 py-4 text-sm">${healthBadge(item.risk_level)}</td>
                    <td class="px-6 py-4 text-sm">${esc(item.measured_at || "")}</td>
                    <td class="px-6 py-4 text-sm text-right">
                        <button class="edit-btn text-primary hover:text-primary/80 mr-3 transition-colors" data-id="${item.id}"><i class="fa fa-pencil"></i> 编辑</button>
                        <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${item.id}"><i class="fa fa-trash"></i> 删除</button>
                    </td>
                </tr>
            `).join("");
            setPagination(rows.length);
        };

        qs("#addHealthBtn").addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            form.reset();
            qs("#healthId").value = "";
            openEditModal("新增健康数据");
        }, true);

        document.addEventListener("click", (event) => {
            if (currentFileName() !== "健康数据管理界面.html") return;
            const editBtn = event.target.closest(".edit-btn");
            const deleteBtn = event.target.closest(".delete-btn");
            if (editBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(editBtn.dataset.id));
                if (!item) return;
                qs("#healthId").value = item.id;
                qs("#userId").value = item.user_id || "";
                qs("#userName").value = item.user_name_display || item.user_name || "";
                qs("#heartRate").value = item.heart_rate || "";
                qs("#systolic").value = item.systolic_bp || "";
                qs("#diastolic").value = item.diastolic_bp || "";
                qs("#bloodOxygen").value = item.blood_oxygen || "";
                qs("#temperature").value = item.temperature || "";
                qs("#healthStatus").value = String(item.risk_level || "").includes("需") ? "danger" : String(item.risk_level || "").includes("待") ? "warning" : "normal";
                qs("#faceId").value = item.face_id || "";
                qs("#analysisResult").value = item.analysis_result || "";
                qs("#remarks").value = item.remarks || "";
                openEditModal("编辑健康数据");
            }
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = Number(deleteBtn.dataset.id);
                qs("#deleteModal")?.classList.remove("hidden");
            }
        }, true);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const id = qs("#healthId").value;
            await request(id ? `/api/health-data/${id}` : "/api/health-data", {
                method: id ? "PUT" : "POST",
                body: JSON.stringify({
                    userId: qs("#userId").value,
                    userName: qs("#userName").value,
                    heartRate: qs("#heartRate").value,
                    systolic: qs("#systolic").value,
                    diastolic: qs("#diastolic").value,
                    bloodOxygen: qs("#bloodOxygen").value,
                    temperature: qs("#temperature").value,
                    riskLevel: riskText(qs("#healthStatus").value),
                    faceId: qs("#faceId").value,
                    analysisResult: qs("#analysisResult").value,
                    remarks: qs("#remarks").value
                })
            });
            toast(id ? "健康数据已保存" : "健康数据已添加");
            closeAdminModals();
            await render();
        }, true);

        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "健康数据管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            if (deleteId) {
                await request(`/api/health-data/${deleteId}`, { method: "DELETE" });
                toast("健康数据已删除");
                deleteId = null;
                closeAdminModals();
                await render();
            }
        }, true);
        render().catch((error) => toast(error.message, "error"));
    }

    function initHealthReportsCrud() {
        if (currentFileName() !== "健康报告管理界面.html") return;
        const tableBody = qs("main table tbody");
        const form = qs("#editForm");
        if (!tableBody || !form || !qs("#batchDeleteBtn")) return;
        let rows = [];
        let deleteId = null;

        const render = async () => {
            const result = await request("/api/health-reports");
            rows = result.data;
            tableBody.innerHTML = rows.map((item) => `
                <tr class="border-b border-gray-200 table-row-hover">
                    <td class="px-4 py-4"><input type="checkbox" class="record-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" data-id="${item.id}"></td>
                    <td class="px-4 py-4 text-sm">${item.id}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.report_no || "")}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.user_name_display || "")}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.report_title || "")}</td>
                    <td class="px-4 py-4 text-sm">${reportStatusBadge(item.status)}</td>
                    <td class="px-4 py-4 text-sm">${healthBadge(item.risk_level)}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.report_date || "")}</td>
                    <td class="px-4 py-4 text-sm text-right">
                        <button class="view-btn text-primary hover:text-primary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-eye"></i> 详情</button>
                        <button class="edit-btn text-secondary hover:text-secondary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-pencil"></i> 编辑</button>
                        <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${item.id}"><i class="fa fa-trash"></i> 删除</button>
                    </td>
                </tr>
            `).join("");
            setPagination(rows.length);
            bindSelectionEvents(document);
        };

        // 查看详情
        document.addEventListener("click", (event) => {
            if (currentFileName() !== "健康报告管理界面.html") return;
            const viewBtn = event.target.closest(".view-btn");
            const editBtn = event.target.closest(".edit-btn");
            const deleteBtn = event.target.closest(".delete-btn");
            if (viewBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(viewBtn.dataset.id));
                if (!item) return;
                qs("#detailReportNo").textContent = item.report_no || "";
                qs("#detailUsername").textContent = item.user_name_display || "";
                qs("#detailCreateTime").textContent = item.created_at || "";
                const isSuccess = String(item.status || "").includes("完成");
                qs("#detailStatus").textContent = item.status || "";
                qs("#detailStatus").className = isSuccess ? "status-success" : "status-warning";
                qs("#detailHeartRate").textContent = item.heart_rate ? item.heart_rate + " bpm" : "-";
                qs("#detailBloodPressure").textContent = item.blood_pressure || "-";
                qs("#detailBloodOxygen").textContent = item.blood_oxygen ? item.blood_oxygen + " %" : "-";
                qs("#detailTemperature").textContent = item.temperature ? item.temperature + " °C" : "-";
                qs("#detailAnalysisResult").textContent = item.summary || "";
                qs("#detailFaceId").textContent = item.face_id || "-";
                qs("#detailHealthDataId").textContent = item.health_data_id || "-";
                qs("#detailUpdateTime").textContent = item.updated_at || "";
                qs("#detailModal")?.classList.remove("hidden");
            }
            if (editBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(editBtn.dataset.id));
                if (!item) return;
                qs("#editReportId").value = item.id;
                qs("#editReportNo").value = item.report_no || "";
                qs("#editUsername").value = item.user_name_display || "";
                qs("#editHeartRate").value = item.heart_rate || "";
                qs("#editBloodPressure").value = item.blood_pressure || "";
                qs("#editBloodOxygen").value = item.blood_oxygen || "";
                qs("#editTemperature").value = item.temperature || "";
                qs("#editStatus").value = String(item.status || "").includes("完成") ? "success" : "warning";
                qs("#editAnalysisResult").value = item.summary || "";
                qs("#editSuggestions").value = item.suggestions || "";
                qs("#editModal")?.classList.remove("hidden");
            }
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = Number(deleteBtn.dataset.id);
                qs("#deleteModalText").textContent = "确定删除这份健康报告吗？删除后数据将同步移除。";
                qs("#deleteModal")?.classList.remove("hidden");
            }
        }, true);

        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            const id = qs("#editReportId").value;
            await request(id ? `/api/health-reports/${id}` : "/api/health-reports", {
                method: id ? "PUT" : "POST",
                body: JSON.stringify({
                    reportNo: qs("#editReportNo").value.trim(),
                    userName: qs("#editUsername").value.trim(),
                    heartRate: qs("#editHeartRate").value,
                    bloodPressure: qs("#editBloodPressure").value,
                    bloodOxygen: qs("#editBloodOxygen").value,
                    temperature: qs("#editTemperature").value,
                    status: qs("#editStatus").value === "success" ? "已完成" : "待审核",
                    analysisResult: qs("#editAnalysisResult").value.trim(),
                    suggestions: qs("#editSuggestions").value.trim()
                })
            });
            toast(id ? "健康报告已保存并同步展示" : "健康报告已添加并同步展示");
            closeAdminModals();
            await render();
        }, true);

        qs("#batchDeleteBtn")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteId = null;
            qs("#deleteModalText").textContent = `确定删除选中的 ${selectedIds().length} 份健康报告吗？`;
            qs("#deleteModal")?.classList.remove("hidden");
        }, true);
        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "健康报告管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const ids = deleteId ? [deleteId] : selectedIds();
            if (ids.length > 1) {
                await request("/api/health-reports/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
            } else if (ids[0]) {
                await request(`/api/health-reports/${ids[0]}`, { method: "DELETE" });
            }
            deleteId = null;
            toast("健康报告已删除并同步展示");
            closeAdminModals();
            await render();
        }, true);
        render().catch((error) => toast(error.message, "error"));
    }

    function initFaceRecordsCrud() {
        if (currentFileName() !== "人脸识别记录管理界面.html") return;
        const tableBody = qs("main table tbody");
        if (!tableBody || !qs("#batchDeleteBtn")) return;
        let rows = [];
        let deleteId = null;

        const render = async () => {
            const result = await request("/api/face-records");
            rows = result.data;
            tableBody.innerHTML = rows.map((item) => `
                <tr class="border-b border-gray-200 table-row-hover">
                    <td class="px-4 py-4"><input type="checkbox" class="record-checkbox w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary" data-id="${item.id}"></td>
                    <td class="px-4 py-4 text-sm">${item.id}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.user_name_display || "")}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.recognition_time || "")}</td>
                    <td class="px-4 py-4 text-sm">${reportStatusBadge(item.result)}</td>
                    <td class="px-4 py-4 text-sm">${item.similarity ? (Number(item.similarity).toFixed(1) + "%") : "-"}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.device_name || "-")}</td>
                    <td class="px-4 py-4 text-sm">${esc(item.location || "-")}</td>
                    <td class="px-4 py-4 text-sm text-right">
                        <button class="view-btn text-primary hover:text-primary/80 mr-2 transition-colors" data-id="${item.id}"><i class="fa fa-eye"></i> 详情</button>
                        <button class="delete-btn text-danger hover:text-danger/80 transition-colors" data-id="${item.id}"><i class="fa fa-trash"></i> 删除</button>
                    </td>
                </tr>
            `).join("");
            setPagination(rows.length);
            bindSelectionEvents(document);
        };

        document.addEventListener("click", (event) => {
            if (currentFileName() !== "人脸识别记录管理界面.html") return;
            const viewBtn = event.target.closest(".view-btn");
            const deleteBtn = event.target.closest(".delete-btn");
            if (viewBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                const item = rows.find((row) => Number(row.id) === Number(viewBtn.dataset.id));
                if (!item) return;
                qs("#detailId").textContent = item.id;
                qs("#detailUsername").textContent = item.user_name_display || "";
                qs("#detailTime").textContent = item.recognition_time || "";
                const isSuccess = String(item.result || "").includes("成功");
                qs("#detailStatus").textContent = item.result || "";
                qs("#detailStatus").className = isSuccess ? "status-success" : "status-warning";
                const conf = item.similarity ? Number(item.similarity).toFixed(1) + "%" : "-";
                qs("#detailConfidence").textContent = conf;
                qs("#detailConfidence").className = isSuccess ? "font-medium text-success" : "font-medium text-warning";
                qs("#detailDevice").textContent = item.device_name || "-";
                qs("#detailLocation").textContent = item.location || "-";
                qs("#detailPath").textContent = item.image_path || "-";
                qs("#detailModal")?.classList.remove("hidden");
            }
            if (deleteBtn) {
                event.preventDefault();
                event.stopImmediatePropagation();
                deleteId = Number(deleteBtn.dataset.id);
                qs("#deleteModalText").textContent = "确定删除这条人脸识别记录吗？删除后数据将同步移除。";
                qs("#deleteModal")?.classList.remove("hidden");
            }
        }, true);

        qs("#batchDeleteBtn")?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteId = null;
            qs("#deleteModalText").textContent = `确定删除选中的 ${selectedIds().length} 条人脸识别记录吗？`;
            qs("#deleteModal")?.classList.remove("hidden");
        }, true);
        qs("#confirmDelete")?.addEventListener("click", async (event) => {
            if (currentFileName() !== "人脸识别记录管理界面.html") return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const ids = deleteId ? [deleteId] : selectedIds();
            if (ids.length > 1) {
                await request("/api/face-records/batch-delete", { method: "POST", body: JSON.stringify({ ids }) });
            } else if (ids[0]) {
                await request(`/api/face-records/${ids[0]}`, { method: "DELETE" });
            }
            deleteId = null;
            toast("人脸识别记录已删除并同步展示");
            closeAdminModals();
            await render();
        }, true);
        render().catch((error) => toast(error.message, "error"));
    }

    function initStats() {
        request("/api/stats")
            .then((result) => {
                qsa("[data-stat]").forEach((item) => {
                    const key = item.dataset.stat;
                    if (result.data[key] !== undefined) {
                        item.textContent = result.data[key];
                    }
                });
            })
            .catch(() => {});
    }

    document.addEventListener("DOMContentLoaded", () => {
        normalizeLinks();
        protectPageLinks();
        initAuthLinks();
        initAdminLogin();
        if (!protectAdminPages()) {
            return;
        }
        initAdminNavigation();
        initRegister();
        initLogin();
        initAdminModals();
        initUserManage();
        initUserCenter();
        initCarouselCrud();
        initAnnouncementCrud();
        initHealthDataCrud();
        initHealthReportsCrud();
        initFaceRecordsCrud();
        initStats();
    });
})();
